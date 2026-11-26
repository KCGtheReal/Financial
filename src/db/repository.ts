import { db, recalculateAllAccountBalances } from './db';
import { Transaction, Account, Category, SavedFilter, LedgerFilter, UserProfile } from '@contracts/api';
import { historyManager } from '../utils/history';
import { CloudSyncService } from './supabase';

export class LedgerRepository {
  /**
   * Resolves the currently active user ID (used for multi-device ownership & sync).
   */
  private static async getActiveUserId(): Promise<string | undefined> {
    const profile = await this.getUserProfile();
    if (profile?.id) return profile.id;
    const rec = await db.settings.get('activeCloudUserId');
    return rec?.value as string | undefined;
  }

  private static async syncAccountNowOrQueue(accountId: string, explicitUserId?: string): Promise<void> {
    if (!CloudSyncService.isConfigured()) return;
    const userId = explicitUserId || (await this.getActiveUserId());
    if (!userId) return;

    const acc = await db.accounts.get(accountId);
    if (!acc) return;

    const accWithOwner = acc.userId ? acc : { ...acc, userId };
    if (!acc.userId) {
      await db.accounts.put(accWithOwner);
    }

    const res = await CloudSyncService.syncAccount(accWithOwner, userId);
    if (!res.success) {
      await CloudSyncService.enqueueOperation('accounts', accountId, 'upsert', userId);
    }
  }

  private static async syncAffectedAccounts(accountIds: Array<string | undefined>, explicitUserId?: string): Promise<void> {
    const unique = Array.from(new Set(accountIds.filter((id): id is string => Boolean(id))));
    await Promise.all(unique.map((id) => this.syncAccountNowOrQueue(id, explicitUserId)));
  }

  private static async syncTransactionNowOrQueue(tx: Transaction, explicitUserId?: string): Promise<void> {
    if (!CloudSyncService.isConfigured()) return;
    const userId = explicitUserId || tx.userId || (await this.getActiveUserId());
    if (!userId) return;

    // Guarantee parent account exists in cloud before syncing transaction (FK constraint)
    await this.syncAffectedAccounts([tx.accountId, tx.toAccountId], userId);

    const acc = await db.accounts.get(tx.accountId);
    const res = await CloudSyncService.syncTransaction({ ...tx, userId }, userId, acc?.currency);
    if (!res.success) {
      await CloudSyncService.enqueueOperation('transactions', tx.id, 'upsert', userId);
    }
  }

  private static async deleteTransactionNowOrQueue(txId: string, explicitUserId?: string): Promise<void> {
    if (!CloudSyncService.isConfigured()) return;
    const userId = explicitUserId || (await this.getActiveUserId());
    const res = await CloudSyncService.deleteCloudTransaction(txId, userId);
    if (!res.success && userId) {
      await CloudSyncService.enqueueOperation('transactions', txId, 'delete', userId);
    }
  }

  private static async syncCategoryNowOrQueue(cat: Category, explicitUserId?: string): Promise<void> {
    if (!CloudSyncService.isConfigured() || cat.isSystem) return;
    const userId = explicitUserId || cat.userId || (await this.getActiveUserId());
    if (!userId) return;

    const res = await CloudSyncService.syncCategory({ ...cat, userId }, userId);
    if (!res.success) {
      await CloudSyncService.enqueueOperation('categories', cat.id, 'upsert', userId);
    }
  }

  /**
   * Triggers bidirectional synchronization with Supabase for the active logged-in user.
   */
  static async syncWithCloud(options?: { onProfileUpdated?: (profile: UserProfile) => void }): Promise<{ success: boolean; error?: string }> {
    if (!CloudSyncService.isConfigured()) {
      return { success: false, error: 'Cloud sync is not configured' };
    }
    const profile = await this.getUserProfile();
    if (!profile || !profile.isLoggedIn || !profile.id) {
      return { success: false, error: 'No active authenticated user' };
    }
    return CloudSyncService.syncWithCloud(profile.id, options);
  }

  /**
   * Creates a transaction and automatically logs an undo action + syncs with cloud.
   */
  static async createTransaction(tx: Transaction): Promise<void> {
    const userId = tx.userId || (await this.getActiveUserId());
    const finalTx: Transaction = {
      ...tx,
      userId,
      createdAt: tx.createdAt || new Date().toISOString(),
      updatedAt: tx.updatedAt || new Date().toISOString(),
    };

    await db.transactions.add(finalTx);
    await recalculateAllAccountBalances();
    await this.syncTransactionNowOrQueue(finalTx, userId);

    historyManager.push({
      description: `Create ${finalTx.type}: ${finalTx.merchant}`,
      undo: async () => {
        await db.transactions.delete(finalTx.id);
        await recalculateAllAccountBalances();
        await this.deleteTransactionNowOrQueue(finalTx.id, userId);
        await this.syncAffectedAccounts([finalTx.accountId, finalTx.toAccountId], userId);
      },
      redo: async () => {
        await db.transactions.add(finalTx);
        await recalculateAllAccountBalances();
        await this.syncTransactionNowOrQueue(finalTx, userId);
      },
    });
  }

  /**
   * Updates an existing transaction and logs undo action with previous state + syncs with cloud.
   */
  static async updateTransaction(updatedTx: Transaction): Promise<void> {
    const existing = await db.transactions.get(updatedTx.id);
    if (!existing) throw new Error(`Transaction ${updatedTx.id} not found`);

    const userId = updatedTx.userId || existing.userId || (await this.getActiveUserId());
    const finalTx: Transaction = {
      ...updatedTx,
      userId,
      updatedAt: updatedTx.updatedAt || new Date().toISOString(),
    };

    await db.transactions.put(finalTx);
    await recalculateAllAccountBalances();

    await this.syncTransactionNowOrQueue(finalTx, userId);
    // If user changed source/destination account on edit, also sync old accounts' recalculated balances
    await this.syncAffectedAccounts(
      [existing.accountId, existing.toAccountId, finalTx.accountId, finalTx.toAccountId],
      userId
    );

    historyManager.push({
      description: `Edit transaction: ${finalTx.merchant}`,
      undo: async () => {
        await db.transactions.put(existing);
        await recalculateAllAccountBalances();
        await this.syncTransactionNowOrQueue(existing, userId);
        await this.syncAffectedAccounts(
          [existing.accountId, existing.toAccountId, finalTx.accountId, finalTx.toAccountId],
          userId
        );
      },
      redo: async () => {
        await db.transactions.put(finalTx);
        await recalculateAllAccountBalances();
        await this.syncTransactionNowOrQueue(finalTx, userId);
        await this.syncAffectedAccounts(
          [existing.accountId, existing.toAccountId, finalTx.accountId, finalTx.toAccountId],
          userId
        );
      },
    });
  }

  /**
   * Deletes a transaction and logs undo action to restore it + syncs with cloud.
   */
  static async deleteTransaction(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;

    const userId = existing.userId || (await this.getActiveUserId());

    await db.transactions.delete(id);
    await recalculateAllAccountBalances();
    await this.deleteTransactionNowOrQueue(id, userId);
    await this.syncAffectedAccounts([existing.accountId, existing.toAccountId], userId);

    historyManager.push({
      description: `Delete ${existing.merchant}`,
      undo: async () => {
        await db.transactions.add(existing);
        await recalculateAllAccountBalances();
        await this.syncTransactionNowOrQueue(existing, userId);
      },
      redo: async () => {
        await db.transactions.delete(id);
        await recalculateAllAccountBalances();
        await this.deleteTransactionNowOrQueue(id, userId);
        await this.syncAffectedAccounts([existing.accountId, existing.toAccountId], userId);
      },
    });
  }

  /**
   * Bulk deletes transactions with single grouped undo action + syncs with cloud.
   */
  static async bulkDelete(ids: string[]): Promise<void> {
    const items = await db.transactions.where('id').anyOf(ids).toArray();
    if (items.length === 0) return;

    const userId = await this.getActiveUserId();
    const affectedAccounts = items.flatMap((i) => [i.accountId, i.toAccountId]);

    await db.transactions.bulkDelete(ids);
    await recalculateAllAccountBalances();

    if (CloudSyncService.isConfigured()) {
      const delRes = await CloudSyncService.deleteCloudTransactionsBatch(ids, userId);
      if (!delRes.success && userId) {
        for (const id of ids) {
          await CloudSyncService.enqueueOperation('transactions', id, 'delete', userId);
        }
      }
      await this.syncAffectedAccounts(affectedAccounts, userId);
    }

    historyManager.push({
      description: `Bulk delete ${items.length} transactions`,
      undo: async () => {
        await db.transactions.bulkAdd(items);
        await recalculateAllAccountBalances();
        if (CloudSyncService.isConfigured() && userId) {
          await this.syncAffectedAccounts(affectedAccounts, userId);
          await CloudSyncService.syncTransactionsBatch(items, userId);
        }
      },
      redo: async () => {
        await db.transactions.bulkDelete(ids);
        await recalculateAllAccountBalances();
        if (CloudSyncService.isConfigured()) {
          const delRes = await CloudSyncService.deleteCloudTransactionsBatch(ids, userId);
          if (!delRes.success && userId) {
            for (const id of ids) {
              await CloudSyncService.enqueueOperation('transactions', id, 'delete', userId);
            }
          }
          await this.syncAffectedAccounts(affectedAccounts, userId);
        }
      },
    });
  }

  /**
   * Bulk recategorizes or updates transactions + syncs with cloud.
   */
  static async bulkUpdate(
    ids: string[],
    updates: Partial<Pick<Transaction, 'categoryId' | 'subcategoryId' | 'status'>> & {
      addTag?: string;
      removeTag?: string;
    }
  ): Promise<void> {
    const items = await db.transactions.where('id').anyOf(ids).toArray();
    if (items.length === 0) return;

    const userId = await this.getActiveUserId();
    const originalItems = items.map((i) => ({ ...i }));
    const modifiedItems: Transaction[] = items.map((item) => {
      const updated = { ...item, userId: item.userId || userId };
      if (updates.categoryId !== undefined) updated.categoryId = updates.categoryId;
      if ('subcategoryId' in updates) updated.subcategoryId = updates.subcategoryId;
      if (updates.status !== undefined) updated.status = updates.status;

      if (updates.addTag && !updated.tags.includes(updates.addTag)) {
        updated.tags = [...updated.tags, updates.addTag];
      }
      if (updates.removeTag) {
        updated.tags = updated.tags.filter((t) => t !== updates.removeTag);
      }
      updated.updatedAt = new Date().toISOString();
      return updated;
    });

    await db.transactions.bulkPut(modifiedItems);
    await recalculateAllAccountBalances();

    if (CloudSyncService.isConfigured() && userId) {
      const affected = modifiedItems.flatMap((t) => [t.accountId, t.toAccountId]);
      await this.syncAffectedAccounts(affected, userId);
      await CloudSyncService.syncTransactionsBatch(modifiedItems, userId);
    }

    historyManager.push({
      description: `Bulk update ${items.length} transactions`,
      undo: async () => {
        await db.transactions.bulkPut(originalItems);
        await recalculateAllAccountBalances();
        if (CloudSyncService.isConfigured() && userId) {
          await CloudSyncService.syncTransactionsBatch(originalItems, userId);
        }
      },
      redo: async () => {
        await db.transactions.bulkPut(modifiedItems);
        await recalculateAllAccountBalances();
        if (CloudSyncService.isConfigured() && userId) {
          await CloudSyncService.syncTransactionsBatch(modifiedItems, userId);
        }
      },
    });
  }

  /**
   * Filter and search transactions with high performance (matches both categoryId & subcategoryId).
   */
  static filterTransactions(transactions: Transaction[], filter: LedgerFilter): Transaction[] {
    return transactions.filter((tx) => {
      // Free text query: matches merchant, notes, tags
      if (filter.query) {
        const q = filter.query.toLowerCase().trim();
        const matchesMerchant = tx.merchant.toLowerCase().includes(q);
        const matchesNotes = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
        const matchesTags = tx.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesMerchant && !matchesNotes && !matchesTags) return false;
      }

      // Accounts
      if (filter.accountIds && filter.accountIds.length > 0) {
        const matchesSource = filter.accountIds.includes(tx.accountId);
        const matchesDest = tx.toAccountId ? filter.accountIds.includes(tx.toAccountId) : false;
        if (!matchesSource && !matchesDest) return false;
      }

      // Categories & Subcategories (supports single & split)
      if (filter.categoryIds && filter.categoryIds.length > 0) {
        if (tx.splits && tx.splits.length > 0) {
          const splitMatches = tx.splits.some(
            (s) =>
              filter.categoryIds!.includes(s.categoryId) ||
              (s.subcategoryId ? filter.categoryIds!.includes(s.subcategoryId) : false)
          );
          if (!splitMatches) return false;
        } else {
          const matchesParent = tx.categoryId ? filter.categoryIds.includes(tx.categoryId) : false;
          const matchesSub = tx.subcategoryId ? filter.categoryIds.includes(tx.subcategoryId) : false;
          if (!matchesParent && !matchesSub) return false;
        }
      }

      // Transaction Types
      if (filter.types && filter.types.length > 0) {
        if (!filter.types.includes(tx.type)) return false;
      }

      // Status
      if (filter.statuses && filter.statuses.length > 0) {
        if (!filter.statuses.includes(tx.status)) return false;
      }

      // Tags
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((t) => tx.tags.includes(t));
        if (!hasTag) return false;
      }

      // Date Range
      if (filter.dateFrom && tx.date < filter.dateFrom) return false;
      if (filter.dateTo && tx.date > filter.dateTo) return false;

      // Amount Range (minor units)
      if (filter.amountMin !== undefined && tx.amount < filter.amountMin) return false;
      if (filter.amountMax !== undefined && tx.amount > filter.amountMax) return false;

      // Payment method
      if (filter.paymentMethods && filter.paymentMethods.length > 0) {
        if (!filter.paymentMethods.includes(tx.paymentMethod)) return false;
      }

      return true;
    });
  }

  // Account operations (synced immediately to Supabase)
  static async createAccount(acc: Account): Promise<void> {
    const userId = acc.userId || (await this.getActiveUserId());
    const finalAcc: Account = {
      ...acc,
      userId,
      createdAt: acc.createdAt || new Date().toISOString(),
      updatedAt: acc.updatedAt || new Date().toISOString(),
    };
    await db.accounts.add(finalAcc);
    await recalculateAllAccountBalances();
    await this.syncAccountNowOrQueue(finalAcc.id, userId);
  }

  static async updateAccount(acc: Account): Promise<void> {
    const existing = await db.accounts.get(acc.id);
    const userId = acc.userId || existing?.userId || (await this.getActiveUserId());
    const finalAcc: Account = {
      ...acc,
      userId,
      updatedAt: acc.updatedAt || new Date().toISOString(),
    };
    await db.accounts.put(finalAcc);
    await recalculateAllAccountBalances();
    await this.syncAccountNowOrQueue(finalAcc.id, userId);
  }

  static async archiveAccount(id: string, isArchived: boolean): Promise<void> {
    await db.accounts.update(id, { isArchived, updatedAt: new Date().toISOString() });
    await this.syncAccountNowOrQueue(id);
  }

  static async deleteAccount(id: string): Promise<void> {
    const existing = await db.accounts.get(id);
    const userId = existing?.userId || (await this.getActiveUserId());

    const srcTxs = await db.transactions.where('accountId').equals(id).toArray();
    const dstTxs = await db.transactions.where('toAccountId').equals(id).toArray();
    const affectedOtherAccounts = Array.from(
      new Set([
        ...srcTxs.map((t) => t.toAccountId),
        ...dstTxs.map((t) => t.accountId),
      ].filter((accId): accId is string => Boolean(accId && accId !== id)))
    );

    await db.transactions.where('accountId').equals(id).delete();
    await db.transactions.where('toAccountId').equals(id).delete();
    await db.accounts.delete(id);
    await recalculateAllAccountBalances();

    if (CloudSyncService.isConfigured()) {
      const delRes = await CloudSyncService.deleteCloudAccount(id, userId);
      if (!delRes.success && userId) {
        await CloudSyncService.enqueueOperation('accounts', id, 'delete', userId);
      }
      await this.syncAffectedAccounts(affectedOtherAccounts, userId);
    }
  }

  // Categories (custom categories synced immediately to Supabase)
  static async createCategory(cat: Category): Promise<void> {
    const userId = cat.userId || (await this.getActiveUserId());
    const finalCat: Category = {
      ...cat,
      userId: cat.isSystem ? undefined : userId,
      createdAt: cat.createdAt || new Date().toISOString(),
    };
    await db.categories.add(finalCat);
    await this.syncCategoryNowOrQueue(finalCat, userId);
  }

  static async updateCategory(cat: Category): Promise<void> {
    const userId = cat.userId || (await this.getActiveUserId());
    const finalCat: Category = {
      ...cat,
      userId: cat.isSystem ? undefined : userId,
    };
    await db.categories.put(finalCat);
    await this.syncCategoryNowOrQueue(finalCat, userId);
  }

  static async deleteCategory(id: string): Promise<void> {
    const existing = await db.categories.get(id);
    const userId = existing?.userId || (await this.getActiveUserId());

    await db.categories.where('parentId').equals(id).delete();
    await db.categories.delete(id);

    if (CloudSyncService.isConfigured() && !existing?.isSystem) {
      const res = await CloudSyncService.deleteCloudCategory(id, userId);
      if (!res.success && userId) {
        await CloudSyncService.enqueueOperation('categories', id, 'delete', userId);
      }
    }
  }

  // Saved Filters
  static async saveFilter(saved: SavedFilter): Promise<void> {
    await db.savedFilters.put(saved);
  }

  static async deleteFilter(id: string): Promise<void> {
    await db.savedFilters.delete(id);
  }

  // User Profile & Authentication
  static async getUserProfile(): Promise<UserProfile | null> {
    const record = await db.settings.get('userProfile');
    if (record && record.value) {
      return record.value as UserProfile;
    }
    return null;
  }

  static async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const cleanEmail = profile.email.toLowerCase().trim();
    const [totalUsers, existingById, existingByEmail] = await Promise.all([
      db.users.count(),
      db.users.get(profile.id),
      db.users.where('email').equalsIgnoreCase(cleanEmail).first(),
    ]);

    if (existingByEmail && existingByEmail.id !== profile.id) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    let finalProfile: UserProfile = {
      ...profile,
      email: cleanEmail,
      role: profile.role || existingById?.role || (totalUsers === 0 ? 'admin' : 'user'),
      updatedAt: new Date().toISOString(),
    };

    if (CloudSyncService.isConfigured()) {
      const cloudRes = await CloudSyncService.saveOrUpdateUser(finalProfile);
      if (!cloudRes.success) {
        throw new Error(cloudRes.error || 'Failed to save account in cloud');
      }
      if (cloudRes.user) {
        finalProfile = cloudRes.user;
      }
      await CloudSyncService.prepareDeviceForUser(finalProfile.id);
      await CloudSyncService.syncWithCloud(finalProfile.id);
    }

    await db.settings.put({ key: 'userProfile', value: finalProfile });
    await db.users.put(finalProfile);
    return finalProfile;
  }

  static async loginUser(email: string, pinCode: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. If Cloud Sync is active, authenticate against cloud first
    if (CloudSyncService.isConfigured()) {
      const cloudRes = await CloudSyncService.loginUser(cleanEmail, pinCode);
      if (cloudRes.success && cloudRes.user) {
        await db.settings.put({ key: 'userProfile', value: cloudRes.user });
        await db.users.put(cloudRes.user);
        return { success: true, user: cloudRes.user };
      } else if (cloudRes.error && !cloudRes.error.toLowerCase().includes('network') && !cloudRes.error.toLowerCase().includes('fetch')) {
        return { success: false, error: cloudRes.error };
      }
    }

    // 2. Fall back to local Dexie search (offline / local device mode)
    let user = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();

    if (!user) {
      const current = await this.getUserProfile();
      if (current && current.email.toLowerCase().trim() === cleanEmail) {
        user = current;
      }
    }

    if (!user) {
      if (!CloudSyncService.isConfigured()) {
        return {
          success: false,
          error: 'User with this email not found on this device.',
        };
      }
      return { success: false, error: 'User with this email not found' };
    }
    if (user.pinCode && user.pinCode !== pinCode) {
      return { success: false, error: 'Invalid PIN code' };
    }

    const updated: UserProfile = { ...user, isLoggedIn: true, updatedAt: new Date().toISOString() };
    await db.settings.put({ key: 'userProfile', value: updated });
    await db.users.put(updated);
    return { success: true, user: updated };
  }

  static async logoutUser(): Promise<UserProfile | null> {
    const current = await this.getUserProfile();
    if (current) {
      const updated: UserProfile = { ...current, isLoggedIn: false, updatedAt: new Date().toISOString() };
      await db.settings.put({ key: 'userProfile', value: updated });
      await db.users.put(updated);
      if (CloudSyncService.isConfigured()) {
        await CloudSyncService.setCloudLoggedInState(current.id, false);
      }
      return updated;
    }
    return null;
  }

  // Admin & Multi-User Management
  static async getAllUsers(): Promise<UserProfile[]> {
    const current = await this.getUserProfile();
    // Enforce least privilege in cloud multi-user environment: non-admins can only view their own profile
    if (CloudSyncService.isConfigured()) {
      if (current && current.role !== 'admin') {
        return [current];
      }
      const cloudUsers = await CloudSyncService.getAllUsers();
      if (cloudUsers.length > 0) {
        await db.users.bulkPut(cloudUsers);
        return cloudUsers;
      }
    }
    const users = await db.users.toArray();
    if (users.length === 0) {
      if (current) {
        const adminCurrent: UserProfile = { ...current, role: current.role || 'admin' };
        await db.users.put(adminCurrent);
        await db.settings.put({ key: 'userProfile', value: adminCurrent });
        return [adminCurrent];
      }
    }
    return users;
  }

  static async deleteUser(userId: string): Promise<void> {
    if (CloudSyncService.isConfigured()) {
      await CloudSyncService.deleteUser(userId);
    }
    await db.users.delete(userId);
    const current = await this.getUserProfile();
    if (current && current.id === userId) {
      await db.settings.delete('userProfile');
    }
  }

  static async updateUserPin(userId: string, newPin: string): Promise<void> {
    if (CloudSyncService.isConfigured()) {
      await CloudSyncService.updateUserPin(userId, newPin);
    }
    let user = await db.users.get(userId);
    const current = await this.getUserProfile();
    if (!user && current && current.id === userId) {
      user = current;
    }
    if (!user) throw new Error('User not found');

    const updated: UserProfile = {
      ...user,
      pinCode: newPin,
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(updated);
    if (current && current.id === userId) {
      await db.settings.put({ key: 'userProfile', value: updated });
    }
  }

  static async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    if (CloudSyncService.isConfigured()) {
      await CloudSyncService.updateUserRole(userId, role);
    }
    const user = await db.users.get(userId);
    if (!user) throw new Error('User not found');
    const updated: UserProfile = {
      ...user,
      role,
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(updated);
    const current = await this.getUserProfile();
    if (current && current.id === userId) {
      await db.settings.put({ key: 'userProfile', value: updated });
    }
  }

  static async getSystemMetrics(): Promise<{
    totalUsers: number;
    totalAccounts: number;
    totalTransactions: number;
    totalCategories: number;
  }> {
    if (CloudSyncService.isConfigured()) {
      const cloudMetrics = await CloudSyncService.getSystemMetrics();
      if (cloudMetrics) return cloudMetrics;
    }
    const [totalUsers, totalAccounts, totalTransactions, totalCategories] = await Promise.all([
      db.users.count(),
      db.accounts.count(),
      db.transactions.count(),
      db.categories.count(),
    ]);
    return {
      totalUsers: Math.max(totalUsers, 1),
      totalAccounts,
      totalTransactions,
      totalCategories,
    };
  }

  /**
   * Device-to-Device Data Transfer: Exports full ledger and user profile as portable JSON.
   */
  static async exportAllData(): Promise<string> {
    const [userProfile, accounts, transactions, categories, savedFilters] = await Promise.all([
      this.getUserProfile(),
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.categories.toArray(),
      db.savedFilters.toArray(),
    ]);

    const backupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      userProfile,
      accounts,
      transactions,
      categories,
      savedFilters,
    };

    return JSON.stringify(backupPayload, null, 2);
  }

  /**
   * Device-to-Device Data Transfer: Imports ledger and user profile from portable JSON and pushes to cloud.
   */
  static async importAllData(jsonString: string): Promise<{ success: boolean; accountsCount: number; txCount: number }> {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup file format');
    }

    const activeUserId = (data.userProfile?.id as string | undefined) || (await this.getActiveUserId());

    if (data.userProfile) {
      await db.users.put(data.userProfile);
      await db.settings.put({ key: 'userProfile', value: data.userProfile });
    }

    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      await db.accounts.bulkPut(data.accounts.map((a: Account) => ({ ...a, userId: a.userId || activeUserId })));
    }

    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
      await db.transactions.bulkPut(data.transactions.map((t: Transaction) => ({ ...t, userId: t.userId || activeUserId })));
    }

    if (Array.isArray(data.categories) && data.categories.length > 0) {
      await db.categories.bulkPut(data.categories);
    }

    await recalculateAllAccountBalances();

    if (CloudSyncService.isConfigured() && activeUserId) {
      await CloudSyncService.syncWithCloud(activeUserId);
    }

    return {
      success: true,
      accountsCount: Array.isArray(data.accounts) ? data.accounts.length : 0,
      txCount: Array.isArray(data.transactions) ? data.transactions.length : 0,
    };
  }
}
