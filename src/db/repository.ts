import { db, recalculateAllAccountBalances } from './db';
import { Transaction, Account, Category, SavedFilter, LedgerFilter, UserProfile } from '@contracts/api';
import { historyManager } from '../utils/history';
import { CloudSyncService } from './supabase';

export class LedgerRepository {
  /**
   * Creates a transaction and automatically logs an undo action.
   */
  static async createTransaction(tx: Transaction): Promise<void> {
    await db.transactions.add(tx);
    await recalculateAllAccountBalances();

    historyManager.push({
      description: `Create ${tx.type}: ${tx.merchant}`,
      undo: async () => {
        await db.transactions.delete(tx.id);
        await recalculateAllAccountBalances();
      },
      redo: async () => {
        await db.transactions.add(tx);
        await recalculateAllAccountBalances();
      },
    });
  }

  /**
   * Updates an existing transaction and logs undo action with previous state.
   */
  static async updateTransaction(updatedTx: Transaction): Promise<void> {
    const existing = await db.transactions.get(updatedTx.id);
    if (!existing) throw new Error(`Transaction ${updatedTx.id} not found`);

    await db.transactions.put(updatedTx);
    await recalculateAllAccountBalances();

    historyManager.push({
      description: `Edit transaction: ${updatedTx.merchant}`,
      undo: async () => {
        await db.transactions.put(existing);
        await recalculateAllAccountBalances();
      },
      redo: async () => {
        await db.transactions.put(updatedTx);
        await recalculateAllAccountBalances();
      },
    });
  }

  /**
   * Deletes a transaction and logs undo action to restore it.
   */
  static async deleteTransaction(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;

    await db.transactions.delete(id);
    await recalculateAllAccountBalances();

    historyManager.push({
      description: `Delete ${existing.merchant}`,
      undo: async () => {
        await db.transactions.add(existing);
        await recalculateAllAccountBalances();
      },
      redo: async () => {
        await db.transactions.delete(id);
        await recalculateAllAccountBalances();
      },
    });
  }

  /**
   * Bulk deletes transactions with single grouped undo action.
   */
  static async bulkDelete(ids: string[]): Promise<void> {
    const items = await db.transactions.where('id').anyOf(ids).toArray();
    if (items.length === 0) return;

    await db.transactions.bulkDelete(ids);
    await recalculateAllAccountBalances();

    historyManager.push({
      description: `Bulk delete ${items.length} transactions`,
      undo: async () => {
        await db.transactions.bulkAdd(items);
        await recalculateAllAccountBalances();
      },
      redo: async () => {
        await db.transactions.bulkDelete(ids);
        await recalculateAllAccountBalances();
      },
    });
  }

  /**
   * Bulk recategorizes or updates transactions.
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

    const originalItems = items.map((i) => ({ ...i }));
    const modifiedItems: Transaction[] = items.map((item) => {
      const updated = { ...item };
      if (updates.categoryId !== undefined) updated.categoryId = updates.categoryId;
      if (updates.subcategoryId !== undefined) updated.subcategoryId = updates.subcategoryId;
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

    historyManager.push({
      description: `Bulk update ${items.length} transactions`,
      undo: async () => {
        await db.transactions.bulkPut(originalItems);
        await recalculateAllAccountBalances();
      },
      redo: async () => {
        await db.transactions.bulkPut(modifiedItems);
        await recalculateAllAccountBalances();
      },
    });
  }

  /**
   * Filter and search transactions with high performance.
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

      // Categories
      if (filter.categoryIds && filter.categoryIds.length > 0) {
        if (tx.splits && tx.splits.length > 0) {
          const splitMatches = tx.splits.some((s) => filter.categoryIds!.includes(s.categoryId));
          if (!splitMatches) return false;
        } else if (!tx.categoryId || !filter.categoryIds.includes(tx.categoryId)) {
          return false;
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

  // Account operations
  static async createAccount(acc: Account): Promise<void> {
    await db.accounts.add(acc);
    await recalculateAllAccountBalances();
  }

  static async updateAccount(acc: Account): Promise<void> {
    await db.accounts.put(acc);
    await recalculateAllAccountBalances();
  }

  static async archiveAccount(id: string, isArchived: boolean): Promise<void> {
    await db.accounts.update(id, { isArchived, updatedAt: new Date().toISOString() });
  }

  static async deleteAccount(id: string): Promise<void> {
    // Also remove associated transactions or reassign
    await db.transactions.where('accountId').equals(id).delete();
    await db.transactions.where('toAccountId').equals(id).delete();
    await db.accounts.delete(id);
    await recalculateAllAccountBalances();
  }

  // Categories
  static async createCategory(cat: Category): Promise<void> {
    await db.categories.add(cat);
  }

  static async updateCategory(cat: Category): Promise<void> {
    await db.categories.put(cat);
  }

  static async deleteCategory(id: string): Promise<void> {
    // Delete subcategories as well
    await db.categories.where('parentId').equals(id).delete();
    await db.categories.delete(id);
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

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const totalUsers = await db.users.count();
    const finalProfile: UserProfile = {
      ...profile,
      role: profile.role || (totalUsers === 0 ? 'admin' : 'user'),
      updatedAt: new Date().toISOString(),
    };

    // If Cloud Sync is configured, register to central cloud first
    if (CloudSyncService.isConfigured()) {
      const cloudRes = await CloudSyncService.registerUser(finalProfile);
      if (!cloudRes.success) {
        throw new Error(cloudRes.error || 'Failed to register account in cloud');
      }
    }

    await db.settings.put({ key: 'userProfile', value: finalProfile });
    await db.users.put(finalProfile);
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
      } else if (cloudRes.error && !cloudRes.error.includes('Network')) {
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
          error: 'Account not found on this device. (Cloud sync is not connected yet — accounts are stored on the phone where they were created).',
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
      return updated;
    }
    return null;
  }

  // Admin & Multi-User Management
  static async getAllUsers(): Promise<UserProfile[]> {
    const users = await db.users.toArray();
    if (users.length === 0) {
      const current = await this.getUserProfile();
      if (current) {
        const adminCurrent: UserProfile = { ...current, role: 'admin' };
        await db.users.put(adminCurrent);
        await db.settings.put({ key: 'userProfile', value: adminCurrent });
        return [adminCurrent];
      }
    }
    return users;
  }

  static async deleteUser(userId: string): Promise<void> {
    await db.users.delete(userId);
    const current = await this.getUserProfile();
    if (current && current.id === userId) {
      await db.settings.delete('userProfile');
    }
  }

  static async updateUserPin(userId: string, newPin: string): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) throw new Error('User not found');
    const updated: UserProfile = {
      ...user,
      pinCode: newPin,
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(updated);
    const current = await this.getUserProfile();
    if (current && current.id === userId) {
      await db.settings.put({ key: 'userProfile', value: updated });
    }
  }

  static async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
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
   * Device-to-Device Data Transfer: Imports ledger and user profile from portable JSON.
   */
  static async importAllData(jsonString: string): Promise<{ success: boolean; accountsCount: number; txCount: number }> {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup file format');
    }

    if (data.userProfile) {
      await db.users.put(data.userProfile);
      await db.settings.put({ key: 'userProfile', value: data.userProfile });
    }

    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      await db.accounts.bulkPut(data.accounts);
    }

    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
      await db.transactions.bulkPut(data.transactions);
    }

    if (Array.isArray(data.categories) && data.categories.length > 0) {
      await db.categories.bulkPut(data.categories);
    }

    await recalculateAllAccountBalances();

    return {
      success: true,
      accountsCount: Array.isArray(data.accounts) ? data.accounts.length : 0,
      txCount: Array.isArray(data.transactions) ? data.transactions.length : 0,
    };
  }
}
