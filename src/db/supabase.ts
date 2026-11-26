import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Account, Category, SyncEntityTable, SyncQueueItem, Transaction, UserProfile } from '@contracts/api';
import { db, recalculateAllAccountBalances } from './db';

// Read Vite / Vercel environment variables safely, with fallback to the configured project
const metaEnv = (import.meta as any).env || {};
const isTestEnv = Boolean(
  (typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test')) ||
  metaEnv.MODE === 'test' ||
  metaEnv.VITEST
);

const defaultSupabaseUrl = 'https://dxscschllqdmewwaaagq.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_r5-toHA19_fRSCTAKEWXqw_-zhy7gu2';

const supabaseUrl = isTestEnv
  ? ''
  : ((metaEnv.VITE_SUPABASE_URL || defaultSupabaseUrl) as string).trim();
const supabaseAnonKey = isTestEnv
  ? ''
  : ((metaEnv.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey) as string).trim();

export const isCloudSyncConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20
);

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export const supabase: SupabaseClient | null = isCloudSyncConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: noStoreFetch },
    })
  : null;

interface SyncedIdsSnapshot {
  accounts: string[];
  transactions: string[];
  categories: string[];
  lastSyncAt: string;
}

function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || msg.includes('does not exist') || msg.includes('schema cache');
}

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  return error.code === 'PGRST205';
}

function toTimestampMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Cloud Synchronization and Multi-Device Authentication Engine
 */
export class CloudSyncService {
  // Detect per-table whether optional extended columns from latest schema.sql exist in live Supabase
  private static usersHasExtendedCols = true;
  private static accountsHasExtendedCols = true;
  private static transactionsHasExtendedCols = true;

  // Serialize concurrent syncWithCloud calls per user
  private static activeSyncs = new Map<string, Promise<{ success: boolean; error?: string }>>();

  /**
   * Check if Cloud Sync is active and reachable
   */
  static isConfigured(): boolean {
    return isCloudSyncConfigured && supabase !== null;
  }

  /**
   * Map a Supabase `users` row to local UserProfile contract
   */
  private static mapUserRow(u: any): UserProfile {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      pinCode: u.pin_code,
      role: (u.role || 'user') as 'admin' | 'user',
      avatar: u.avatar || 'User',
      avatarColor: u.avatar_color || '#09090B',
      currency: u.currency || 'USD',
      bio: u.bio || undefined,
      isLoggedIn: Boolean(u.is_logged_in),
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    };
  }

  private static buildUserPayload(profile: UserProfile, includeExtended: boolean, overrideRole?: 'admin' | 'user') {
    const base: Record<string, any> = {
      id: profile.id,
      name: profile.name,
      email: profile.email.toLowerCase().trim(),
      pin_code: profile.pinCode || '1234',
      role: overrideRole || profile.role || 'user',
      avatar: profile.avatar || 'User',
      avatar_color: profile.avatarColor || '#09090B',
      currency: profile.currency || 'USD',
      is_logged_in: Boolean(profile.isLoggedIn),
      created_at: profile.createdAt || new Date().toISOString(),
      updated_at: profile.updatedAt || new Date().toISOString(),
    };
    if (includeExtended && profile.bio !== undefined) {
      base.bio = profile.bio || null;
    }
    return base;
  }

  private static buildAccountPayload(account: Account, userId: string, includeExtended: boolean) {
    const payload: Record<string, any> = {
      id: account.id,
      user_id: userId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.currentBalance,
      initial_balance: account.initialBalance || 0,
      is_archived: Boolean(account.isArchived),
      color: account.color || '#18181B',
      icon: account.icon || 'Landmark',
      created_at: account.createdAt || new Date().toISOString(),
      updated_at: account.updatedAt || new Date().toISOString(),
    };
    if (includeExtended) {
      payload.institution_name = account.institutionName || null;
      payload.account_number_mask = account.accountNumberMask || null;
      payload.notes = account.notes || null;
    }
    return payload;
  }

  private static buildTransactionPayload(
    tx: Transaction,
    userId: string,
    currency: string,
    includeExtended: boolean
  ) {
    const payload: Record<string, any> = {
      id: tx.id,
      user_id: userId,
      type: tx.type,
      amount: tx.amount,
      currency: currency || 'USD',
      date: tx.date,
      account_id: tx.accountId,
      to_account_id: tx.type === 'transfer' ? (tx.toAccountId || null) : null,
      category_id: tx.type === 'transfer' ? null : (tx.categoryId || null),
      sub_category_id: tx.type === 'transfer' ? null : (tx.subcategoryId || null),
      merchant: tx.merchant,
      notes: tx.notes || null,
      status: tx.status || 'cleared',
      tags: Array.isArray(tx.tags) ? tx.tags : [],
      payment_method: tx.paymentMethod || 'cash',
      is_split: Boolean(tx.splits && tx.splits.length > 0),
      created_at: tx.createdAt || new Date().toISOString(),
      updated_at: tx.updatedAt || new Date().toISOString(),
    };
    if (includeExtended) {
      payload.time = tx.time || null;
      payload.splits = tx.splits && tx.splits.length > 0 ? tx.splits : null;
      payload.attachment_data = tx.attachmentData || null;
      payload.attachment_name = tx.attachmentName || null;
    }
    return payload;
  }

  /**
   * Queue an offline / failed operation into local syncQueue for retry on reconnect.
   */
  static async enqueueOperation(
    table: SyncEntityTable,
    entityId: string,
    operation: 'upsert' | 'delete',
    userId: string
  ): Promise<void> {
    if (!userId) return;
    try {
      const item: SyncQueueItem = {
        id: `${table}:${entityId}`,
        table,
        entityId,
        operation,
        userId,
        timestamp: Date.now(),
      };
      await db.syncQueue.put(item);
    } catch (err) {
      console.error('Failed to enqueue sync operation:', err);
    }
  }

  /**
   * Remove a completed operation from syncQueue if it matches.
   */
  static async clearQueuedOperation(table: SyncEntityTable, entityId: string): Promise<void> {
    try {
      await db.syncQueue.delete(`${table}:${entityId}`);
    } catch {
      // ignore if table/store unavailable
    }
  }

  private static async getSyncedSnapshot(userId: string): Promise<SyncedIdsSnapshot> {
    const rec = await db.settings.get(`cloudSyncedState_${userId}`);
    if (rec?.value) {
      return {
        accounts: Array.isArray(rec.value.accounts) ? rec.value.accounts : [],
        transactions: Array.isArray(rec.value.transactions) ? rec.value.transactions : [],
        categories: Array.isArray(rec.value.categories) ? rec.value.categories : [],
        lastSyncAt: rec.value.lastSyncAt || '',
      };
    }
    return { accounts: [], transactions: [], categories: [], lastSyncAt: '' };
  }

  private static async saveSyncedSnapshot(userId: string, snapshot: SyncedIdsSnapshot): Promise<void> {
    await db.settings.put({ key: `cloudSyncedState_${userId}`, value: snapshot });
  }

  static async markEntitySynced(table: SyncEntityTable, entityId: string, userId: string): Promise<void> {
    if (!userId) return;
    const snap = await this.getSyncedSnapshot(userId);
    const list = snap[table];
    if (!list.includes(entityId)) {
      list.push(entityId);
      snap.lastSyncAt = new Date().toISOString();
      await this.saveSyncedSnapshot(userId, snap);
    }
  }

  static async unmarkEntitySynced(table: SyncEntityTable, entityId: string, userId: string): Promise<void> {
    if (!userId) return;
    const snap = await this.getSyncedSnapshot(userId);
    snap[table] = snap[table].filter((id) => id !== entityId);
    snap.lastSyncAt = new Date().toISOString();
    await this.saveSyncedSnapshot(userId, snap);
  }

  /**
   * Ensure a device switching from User A -> User B clears User A's local accounts/txs/categories cleanly
   * so User A's private data never leaks into User B's session.
   */
  static async prepareDeviceForUser(nextUserId: string): Promise<void> {
    const prevRec = await db.settings.get('activeCloudUserId');
    const prevUserId = prevRec?.value as string | undefined;

    if (prevUserId && prevUserId !== nextUserId) {
      const customCats = (await db.categories.toArray()).filter((c) => !c.isSystem).map((c) => c.id);
      await db.transaction('rw', [db.accounts, db.transactions, db.savedFilters, db.categories, db.syncQueue, db.settings], async () => {
        await db.accounts.clear();
        await db.transactions.clear();
        await db.savedFilters.clear();
        if (customCats.length > 0) {
          await db.categories.bulkDelete(customCats);
        }
        await db.syncQueue.clear();
        await db.settings.delete(`cloudSyncedState_${prevUserId}`);
      });
    }

    await db.settings.put({ key: 'activeCloudUserId', value: nextUserId });
  }

  /**
   * Cloud Registration: Registers user profile in central Supabase database
   */
  static async registerUser(profile: UserProfile): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };

    try {
      const cleanEmail = profile.email.toLowerCase().trim();

      // 1. Check if email already registered
      const { data: existing, error: checkErr } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (checkErr) {
        if (isMissingTableError(checkErr)) {
          return {
            success: false,
            error: 'Cloud database tables not initialized yet. Please run the SQL schema in your Supabase dashboard SQL Editor.',
          };
        }
        return { success: false, error: checkErr.message };
      }

      if (existing) {
        return { success: false, error: 'An account with this email already exists in the cloud. Please sign in.' };
      }

      // 2. First user in cloud becomes admin automatically; subsequent signups are standard users
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      const assignedRole: 'admin' | 'user' =
        (userCount ?? 0) === 0 ? 'admin' : (profile.role || 'user');

      // 3. Insert new user into cloud database (resilient fallback if bio col missing)
      let payload = this.buildUserPayload(profile, this.usersHasExtendedCols, assignedRole);
      let { error } = await supabase.from('users').insert(payload);

      if (error && this.usersHasExtendedCols && isMissingColumnError(error)) {
        this.usersHasExtendedCols = false;
        payload = this.buildUserPayload(profile, false, assignedRole);
        ({ error } = await supabase.from('users').insert(payload));
      }

      if (error) {
        console.error('Supabase registration error:', error);
        if (isMissingTableError(error)) {
          return {
            success: false,
            error: 'Cloud database tables not initialized yet. Please run the SQL schema in your Supabase dashboard SQL Editor.',
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: { ...profile, email: cleanEmail, role: assignedRole },
      };
    } catch (err: any) {
      console.error('Cloud register exception:', err);
      return { success: false, error: err.message || 'Failed to connect to cloud database' };
    }
  }

  /**
   * Updates an existing user's profile in Supabase (or inserts if only created offline before).
   */
  static async saveOrUpdateUser(profile: UserProfile): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };

    try {
      const cleanEmail = profile.email.toLowerCase().trim();

      // Check if user row already exists by ID
      const { data: existingById, error: byIdErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle();

      if (byIdErr) {
        if (isMissingTableError(byIdErr)) {
          return {
            success: false,
            error: 'Cloud database tables not initialized yet. Please run the SQL schema in your Supabase dashboard SQL Editor.',
          };
        }
        return { success: false, error: byIdErr.message };
      }

      if (!existingById) {
        return this.registerUser(profile);
      }

      // Ensure email doesn't belong to a DIFFERENT user ID
      const { data: conflict } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .neq('id', profile.id)
        .maybeSingle();

      if (conflict) {
        return { success: false, error: 'An account with this email already exists in the cloud.' };
      }

      const buildUpdate = (withExtended: boolean) => {
        const upd: Record<string, any> = {
          name: profile.name,
          email: cleanEmail,
          pin_code: profile.pinCode || existingById.pin_code,
          avatar: profile.avatar || 'User',
          avatar_color: profile.avatarColor || '#09090B',
          currency: profile.currency || 'USD',
          role: profile.role || existingById.role || 'user',
          is_logged_in: Boolean(profile.isLoggedIn),
          updated_at: profile.updatedAt || new Date().toISOString(),
        };
        if (withExtended) {
          upd.bio = profile.bio || null;
        }
        return upd;
      };

      let { error: updErr } = await supabase
        .from('users')
        .update(buildUpdate(this.usersHasExtendedCols))
        .eq('id', profile.id);

      if (updErr && this.usersHasExtendedCols && isMissingColumnError(updErr)) {
        this.usersHasExtendedCols = false;
        ({ error: updErr } = await supabase
          .from('users')
          .update(buildUpdate(false))
          .eq('id', profile.id));
      }

      if (updErr) {
        console.error('Supabase profile update error:', updErr);
        return { success: false, error: updErr.message };
      }

      return {
        success: true,
        user: { ...profile, email: cleanEmail, role: (profile.role || existingById.role || 'user') as 'admin' | 'user' },
      };
    } catch (err: any) {
      console.error('Cloud saveOrUpdateUser exception:', err);
      return { success: false, error: err.message || 'Network error connecting to cloud' };
    }
  }

  /**
   * Cloud Login: Verifies credentials against Supabase from ANY phone or browser
   */
  static async loginUser(email: string, pin: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };

    try {
      const cleanEmail = email.toLowerCase().trim();
      const { data: userRow, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.error('Supabase query error:', error);
        if (isMissingTableError(error)) {
          return {
            success: false,
            error: 'Cloud database tables not initialized yet. Please run the SQL schema in your Supabase dashboard SQL Editor.',
          };
        }
        return { success: false, error: error.message };
      }

      if (!userRow) {
        return { success: false, error: 'No account found with this email in the cloud.' };
      }

      if (userRow.pin_code !== pin) {
        return { success: false, error: 'Invalid PIN code.' };
      }

      // If no admins exist in cloud yet, promote the sole/earliest owner cleanly
      let resolvedRole = (userRow.role || 'user') as 'admin' | 'user';
      if (resolvedRole !== 'admin') {
        const { count: adminCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
        if ((adminCount ?? 0) === 0) {
          resolvedRole = 'admin';
          await supabase.from('users').update({ role: 'admin', is_logged_in: true }).eq('id', userRow.id);
        } else {
          await supabase.from('users').update({ is_logged_in: true }).eq('id', userRow.id);
        }
      } else {
        await supabase.from('users').update({ is_logged_in: true }).eq('id', userRow.id);
      }

      const userProfile: UserProfile = {
        ...this.mapUserRow(userRow),
        role: resolvedRole,
        isLoggedIn: true,
      };

      // Isolate previous user's device storage if switching to a different account
      await this.prepareDeviceForUser(userProfile.id);

      // Bidirectional cloud sync (pushes any pre-existing same-user offline items & pulls latest cloud items)
      await this.syncWithCloud(userProfile.id);

      return { success: true, user: userProfile };
    } catch (err: any) {
      console.error('Cloud login exception:', err);
      return { success: false, error: err.message || 'Network error connecting to cloud' };
    }
  }

  /**
   * Legacy alias preserved for compatibility — triggers full bidirectional sync.
   */
  static async pullCloudData(userId: string): Promise<void> {
    await this.syncWithCloud(userId);
  }

  /**
   * Bidirectional Cloud Sync Reconciler:
   * 1. Flushes any queued offline/pending upserts & deletes in dependency order
   * 2. Reconciles active user profile & role with Supabase
   * 3. Reconciles Accounts, Custom Categories, and Transactions (pushes local pre-sync/unsynced items, pulls cloud updates, removes remotely deleted items)
   * 4. Recomputes exact integer balances without mutating unchanged timestamps
   */
  static async syncWithCloud(
    userId: string,
    options?: { onProfileUpdated?: (profile: UserProfile) => void }
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !userId) return { success: false, error: 'Cloud sync is not configured' };

    const existing = this.activeSyncs.get(userId);
    if (existing) {
      return existing;
    }

    const runPromise = (async (): Promise<{ success: boolean; error?: string }> => {
      try {
        await db.settings.put({ key: 'activeCloudUserId', value: userId });

        // 1. Flush queued operations in strict FK order:
        //    Upserts: accounts -> categories -> transactions
        //    Deletes: transactions -> categories -> accounts
        const queued = await db.syncQueue.where('userId').equals(userId).toArray();
        const queuedDeleteSet = new Set<string>();
        const queuedUpsertSet = new Set<string>();

        for (const item of queued) {
          if (item.operation === 'delete') queuedDeleteSet.add(item.id);
          else queuedUpsertSet.add(item.id);
        }

        const upserts = queued.filter((q) => q.operation === 'upsert');
        const deletes = queued.filter((q) => q.operation === 'delete');

        for (const item of upserts.filter((q) => q.table === 'accounts')) {
          const acc = await db.accounts.get(item.entityId);
          if (acc) {
            const res = await this.syncAccount(acc, userId);
            if (res.success) await this.clearQueuedOperation('accounts', item.entityId);
          } else {
            await this.clearQueuedOperation('accounts', item.entityId);
          }
        }
        for (const item of upserts.filter((q) => q.table === 'categories')) {
          const cat = await db.categories.get(item.entityId);
          if (cat) {
            const res = await this.syncCategory(cat, userId);
            if (res.success) await this.clearQueuedOperation('categories', item.entityId);
          } else {
            await this.clearQueuedOperation('categories', item.entityId);
          }
        }
        for (const item of upserts.filter((q) => q.table === 'transactions')) {
          const tx = await db.transactions.get(item.entityId);
          if (tx) {
            const res = await this.syncTransaction(tx, userId);
            if (res.success) await this.clearQueuedOperation('transactions', item.entityId);
          } else {
            await this.clearQueuedOperation('transactions', item.entityId);
          }
        }

        for (const item of deletes.filter((q) => q.table === 'transactions')) {
          const res = await this.deleteCloudTransaction(item.entityId);
          if (res.success) await this.clearQueuedOperation('transactions', item.entityId);
        }
        for (const item of deletes.filter((q) => q.table === 'categories')) {
          const res = await this.deleteCloudCategory(item.entityId);
          if (res.success) await this.clearQueuedOperation('categories', item.entityId);
        }
        for (const item of deletes.filter((q) => q.table === 'accounts')) {
          const res = await this.deleteCloudAccount(item.entityId);
          if (res.success) await this.clearQueuedOperation('accounts', item.entityId);
        }

        // Refresh remaining queued items after flush
        const remainingQueue = await db.syncQueue.where('userId').equals(userId).toArray();
        const remainingQueueIds = new Set(remainingQueue.map((q) => q.id));

        // 2. Fetch and sync active User Profile row
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (userErr) {
          return { success: false, error: userErr.message };
        }

        const localProfileRec = await db.settings.get('userProfile');
        const localProfile = localProfileRec?.value as UserProfile | undefined;

        if (!userRow && localProfile && localProfile.id === userId) {
          // Local user was created while completely offline -> push to cloud now
          await this.registerUser(localProfile);
        } else if (userRow && localProfile && localProfile.id === userId) {
          let cloudUser = this.mapUserRow(userRow);
          // Promote sole owner cleanly if no admin exists yet in cloud
          if (cloudUser.role !== 'admin') {
            const { count: adminCount } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('role', 'admin');
            if ((adminCount ?? 0) === 0) {
              cloudUser = { ...cloudUser, role: 'admin' };
              await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
            }
          }

          const cloudTs = toTimestampMs(cloudUser.updatedAt);
          const localTs = toTimestampMs(localProfile.updatedAt);
          if (cloudTs > localTs || cloudUser.role !== localProfile.role) {
            const mergedProfile: UserProfile = {
              ...localProfile,
              ...cloudUser,
              bio: cloudUser.bio ?? localProfile.bio,
              isLoggedIn: localProfile.isLoggedIn,
            };
            await db.settings.put({ key: 'userProfile', value: mergedProfile });
            await db.users.put(mergedProfile);
            options?.onProfileUpdated?.(mergedProfile);
          } else if (localTs > cloudTs) {
            await this.saveOrUpdateUser(localProfile);
          }
        }

        // 3. Fetch Cloud Data for this user (abort merge cleanly on any query error!)
        const [accRes, catRes, txRes] = await Promise.all([
          supabase.from('accounts').select('*').eq('user_id', userId),
          supabase.from('categories').select('*').eq('user_id', userId),
          supabase.from('transactions').select('*').eq('user_id', userId),
        ]);

        if (accRes.error || catRes.error || txRes.error) {
          const msg = accRes.error?.message || catRes.error?.message || txRes.error?.message || 'Fetch error';
          console.error('Cloud fetch error during sync:', msg);
          return { success: false, error: msg };
        }

        const cloudAccountsRaw = accRes.data || [];
        const cloudCategoriesRaw = catRes.data || [];
        const cloudTxsRaw = txRes.data || [];

        const snapshot = await this.getSyncedSnapshot(userId);
        const prevSyncedAccSet = new Set(snapshot.accounts);
        const prevSyncedCatSet = new Set(snapshot.categories);
        const prevSyncedTxSet = new Set(snapshot.transactions);

        // ============================================================
        // 4. RECONCILE ACCOUNTS (BEFORE TRANSACTIONS DUE TO FK!)
        // ============================================================
        const localAccounts = await db.accounts.toArray();
        const localAccMap = new Map(localAccounts.map((a) => [a.id, a]));
        const cloudAccMap = new Map(cloudAccountsRaw.map((a: any) => [a.id, a]));

        const accountsToSaveLocally: Account[] = [];
        const accountsToPush: Account[] = [];
        const accountIdsToDeleteLocally: string[] = [];

        for (const localAcc of localAccounts) {
          // Ignore if this record explicitly belongs to a different user
          if (localAcc.userId && localAcc.userId !== userId) continue;

          const qKey = `accounts:${localAcc.id}`;
          if (remainingQueueIds.has(qKey)) continue;

          const cloudRow: any = cloudAccMap.get(localAcc.id);
          if (!cloudRow) {
            if (prevSyncedAccSet.has(localAcc.id)) {
              accountIdsToDeleteLocally.push(localAcc.id);
            } else {
              accountsToPush.push({ ...localAcc, userId });
            }
          } else {
            const cloudTs = toTimestampMs(cloudRow.updated_at);
            const localTs = toTimestampMs(localAcc.updatedAt);

            if (cloudTs > localTs) {
              accountsToSaveLocally.push({
                id: cloudRow.id,
                userId,
                name: cloudRow.name,
                type: cloudRow.type,
                currency: cloudRow.currency,
                initialBalance: Number(cloudRow.initial_balance ?? 0),
                currentBalance: Number(cloudRow.balance ?? 0),
                isArchived: Boolean(cloudRow.is_archived),
                color: cloudRow.color || '#18181B',
                icon: cloudRow.icon || 'Landmark',
                institutionName: cloudRow.institution_name !== undefined ? (cloudRow.institution_name || undefined) : localAcc.institutionName,
                accountNumberMask: cloudRow.account_number_mask !== undefined ? (cloudRow.account_number_mask || undefined) : localAcc.accountNumberMask,
                notes: cloudRow.notes !== undefined ? (cloudRow.notes || undefined) : localAcc.notes,
                createdAt: cloudRow.created_at,
                updatedAt: cloudRow.updated_at,
              });
            } else if (localTs > cloudTs + 1000 || !localAcc.userId) {
              accountsToPush.push({ ...localAcc, userId });
            }
          }
        }

        for (const cloudRow of cloudAccountsRaw as any[]) {
          const qKey = `accounts:${cloudRow.id}`;
          if (remainingQueueIds.has(qKey)) continue;
          if (!localAccMap.has(cloudRow.id)) {
            accountsToSaveLocally.push({
              id: cloudRow.id,
              userId,
              name: cloudRow.name,
              type: cloudRow.type,
              currency: cloudRow.currency,
              initialBalance: Number(cloudRow.initial_balance ?? 0),
              currentBalance: Number(cloudRow.balance ?? 0),
              isArchived: Boolean(cloudRow.is_archived),
              color: cloudRow.color || '#18181B',
              icon: cloudRow.icon || 'Landmark',
              institutionName: cloudRow.institution_name || undefined,
              accountNumberMask: cloudRow.account_number_mask || undefined,
              notes: cloudRow.notes || undefined,
              createdAt: cloudRow.created_at,
              updatedAt: cloudRow.updated_at,
            });
          }
        }

        if (accountIdsToDeleteLocally.length > 0) {
          await db.accounts.bulkDelete(accountIdsToDeleteLocally);
        }
        if (accountsToSaveLocally.length > 0) {
          await db.accounts.bulkPut(accountsToSaveLocally);
        }
        if (accountsToPush.length > 0) {
          // Ensure local records store ownership userId
          await db.accounts.bulkPut(accountsToPush);
          await this.syncAccountsBatch(accountsToPush, userId);
        }

        // ============================================================
        // 5. RECONCILE CUSTOM CATEGORIES
        // ============================================================
        const localCategories = await db.categories.toArray();
        const customLocalCats = localCategories.filter((c) => !c.isSystem && (!c.userId || c.userId === userId));
        const localCatMap = new Map(customLocalCats.map((c) => [c.id, c]));
        const cloudCatMap = new Map(cloudCategoriesRaw.map((c: any) => [c.id, c]));

        const catsToSaveLocally: Category[] = [];
        const catsToPush: Category[] = [];
        const catIdsToDeleteLocally: string[] = [];

        for (const localCat of customLocalCats) {
          const qKey = `categories:${localCat.id}`;
          if (remainingQueueIds.has(qKey)) continue;
          if (!cloudCatMap.has(localCat.id)) {
            if (prevSyncedCatSet.has(localCat.id)) {
              catIdsToDeleteLocally.push(localCat.id);
            } else {
              catsToPush.push({ ...localCat, userId });
            }
          }
        }

        for (const cloudRow of cloudCategoriesRaw as any[]) {
          const qKey = `categories:${cloudRow.id}`;
          if (remainingQueueIds.has(qKey)) continue;
          if (!localCatMap.has(cloudRow.id)) {
            catsToSaveLocally.push({
              id: cloudRow.id,
              userId,
              name: cloudRow.name,
              type: cloudRow.type,
              icon: cloudRow.icon,
              color: cloudRow.color,
              parentId: cloudRow.parent_id || undefined,
              order: Number(cloudRow.order ?? 0),
              isSystem: Boolean(cloudRow.is_system),
              createdAt: cloudRow.created_at,
            });
          }
        }

        if (catIdsToDeleteLocally.length > 0) {
          await db.categories.bulkDelete(catIdsToDeleteLocally);
        }
        if (catsToSaveLocally.length > 0) {
          await db.categories.bulkPut(catsToSaveLocally);
        }
        if (catsToPush.length > 0) {
          await db.categories.bulkPut(catsToPush);
          await this.syncCategoriesBatch(catsToPush, userId);
        }

        // ============================================================
        // 6. RECONCILE TRANSACTIONS (AFTER ACCOUNTS SO FK ALWAYS HOLDS)
        // ============================================================
        const localTxs = await db.transactions.toArray();
        const localTxMap = new Map(localTxs.map((t) => [t.id, t]));
        const cloudTxMap = new Map(cloudTxsRaw.map((t: any) => [t.id, t]));

        const txsToSaveLocally: Transaction[] = [];
        const txsToPush: Transaction[] = [];
        const txIdsToDeleteLocally: string[] = [];

        for (const localTx of localTxs) {
          if (localTx.userId && localTx.userId !== userId) continue;

          const qKey = `transactions:${localTx.id}`;
          if (remainingQueueIds.has(qKey)) continue;

          const cloudRow: any = cloudTxMap.get(localTx.id);
          if (!cloudRow) {
            if (prevSyncedTxSet.has(localTx.id)) {
              txIdsToDeleteLocally.push(localTx.id);
            } else {
              txsToPush.push({ ...localTx, userId });
            }
          } else {
            const cloudTs = toTimestampMs(cloudRow.updated_at);
            const localTs = toTimestampMs(localTx.updatedAt);

            if (cloudTs > localTs) {
              txsToSaveLocally.push({
                id: cloudRow.id,
                userId,
                type: cloudRow.type,
                amount: Number(cloudRow.amount),
                date: cloudRow.date,
                time: cloudRow.time !== undefined ? (cloudRow.time || undefined) : localTx.time,
                accountId: cloudRow.account_id,
                toAccountId: cloudRow.to_account_id || undefined,
                categoryId: cloudRow.category_id || undefined,
                subcategoryId: cloudRow.sub_category_id || undefined,
                merchant: cloudRow.merchant,
                notes: cloudRow.notes || undefined,
                status: (cloudRow.status || 'cleared') as any,
                tags: Array.isArray(cloudRow.tags) ? cloudRow.tags : [],
                paymentMethod: (cloudRow.payment_method || 'cash') as any,
                splits: cloudRow.splits !== undefined
                  ? (Array.isArray(cloudRow.splits) ? cloudRow.splits : undefined)
                  : localTx.splits,
                attachmentData: cloudRow.attachment_data !== undefined
                  ? (cloudRow.attachment_data || undefined)
                  : localTx.attachmentData,
                attachmentName: cloudRow.attachment_name !== undefined
                  ? (cloudRow.attachment_name || undefined)
                  : localTx.attachmentName,
                createdAt: cloudRow.created_at,
                updatedAt: cloudRow.updated_at,
              });
            } else if (localTs > cloudTs + 1000 || !localTx.userId) {
              txsToPush.push({ ...localTx, userId });
            }
          }
        }

        for (const cloudRow of cloudTxsRaw as any[]) {
          const qKey = `transactions:${cloudRow.id}`;
          if (remainingQueueIds.has(qKey)) continue;
          if (!localTxMap.has(cloudRow.id)) {
            txsToSaveLocally.push({
              id: cloudRow.id,
              userId,
              type: cloudRow.type,
              amount: Number(cloudRow.amount),
              date: cloudRow.date,
              time: cloudRow.time || undefined,
              accountId: cloudRow.account_id,
              toAccountId: cloudRow.to_account_id || undefined,
              categoryId: cloudRow.category_id || undefined,
              subcategoryId: cloudRow.sub_category_id || undefined,
              merchant: cloudRow.merchant,
              notes: cloudRow.notes || undefined,
              status: (cloudRow.status || 'cleared') as any,
              tags: Array.isArray(cloudRow.tags) ? cloudRow.tags : [],
              paymentMethod: (cloudRow.payment_method || 'cash') as any,
              splits: Array.isArray(cloudRow.splits) ? cloudRow.splits : undefined,
              attachmentData: cloudRow.attachment_data || undefined,
              attachmentName: cloudRow.attachment_name || undefined,
              createdAt: cloudRow.created_at,
              updatedAt: cloudRow.updated_at,
            });
          }
        }

        if (txIdsToDeleteLocally.length > 0) {
          await db.transactions.bulkDelete(txIdsToDeleteLocally);
        }
        if (txsToSaveLocally.length > 0) {
          await db.transactions.bulkPut(txsToSaveLocally);
        }
        if (txsToPush.length > 0) {
          await db.transactions.bulkPut(txsToPush);
          await this.syncTransactionsBatch(txsToPush, userId);
        }

        // Also clean up any local transactions pointing to accounts deleted in cloud
        if (accountIdsToDeleteLocally.length > 0) {
          await db.transactions.where('accountId').anyOf(accountIdsToDeleteLocally).delete();
          await db.transactions.where('toAccountId').anyOf(accountIdsToDeleteLocally).delete();
        }

        // 7. Recompute exact local account balances without changing timestamps on unchanged accounts
        await recalculateAllAccountBalances();

        // 8. Persist updated synced ID snapshot
        const nextAccIds = Array.from(
          new Set([
            ...cloudAccountsRaw.map((a: any) => a.id),
            ...accountsToPush.map((a) => a.id),
          ])
        );
        const nextCatIds = Array.from(
          new Set([
            ...cloudCategoriesRaw.map((c: any) => c.id),
            ...catsToPush.map((c) => c.id),
          ])
        );
        const nextTxIds = Array.from(
          new Set([
            ...cloudTxsRaw.map((t: any) => t.id),
            ...txsToPush.map((t) => t.id),
          ])
        );

        await this.saveSyncedSnapshot(userId, {
          accounts: nextAccIds,
          categories: nextCatIds,
          transactions: nextTxIds,
          lastSyncAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (err: any) {
        console.error('Error in bidirectional syncWithCloud:', err);
        return { success: false, error: err?.message || 'Cloud sync failed' };
      } finally {
        this.activeSyncs.delete(userId);
      }
    })();

    this.activeSyncs.set(userId, runPromise);
    return runPromise;
  }

  /**
   * Pushes an account to Supabase (with extended-column fallback if needed)
   */
  static async syncAccount(account: Account, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };
    try {
      let payload = this.buildAccountPayload(account, userId, this.accountsHasExtendedCols);
      let { error } = await supabase.from('accounts').upsert(payload);

      if (error && this.accountsHasExtendedCols && isMissingColumnError(error)) {
        this.accountsHasExtendedCols = false;
        payload = this.buildAccountPayload(account, userId, false);
        ({ error } = await supabase.from('accounts').upsert(payload));
      }

      if (error) {
        console.error('Error syncing account to cloud:', error);
        return { success: false, error: error.message };
      }
      await this.markEntitySynced('accounts', account.id, userId);
      return { success: true };
    } catch (err: any) {
      console.error('Error syncing account to cloud:', err);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async syncAccountsBatch(accounts: Account[], userId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || accounts.length === 0) return { success: true };
    try {
      let payloads = accounts.map((a) => this.buildAccountPayload(a, userId, this.accountsHasExtendedCols));
      let { error } = await supabase.from('accounts').upsert(payloads);

      if (error && this.accountsHasExtendedCols && isMissingColumnError(error)) {
        this.accountsHasExtendedCols = false;
        payloads = accounts.map((a) => this.buildAccountPayload(a, userId, false));
        ({ error } = await supabase.from('accounts').upsert(payloads));
      }

      if (error) {
        console.error('Error batch-syncing accounts to cloud:', error);
        for (const a of accounts) await this.enqueueOperation('accounts', a.id, 'upsert', userId);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      for (const a of accounts) await this.enqueueOperation('accounts', a.id, 'upsert', userId);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Pushes a transaction to Supabase (resolving required NOT NULL `currency` reliably)
   */
  static async syncTransaction(
    tx: Transaction,
    userId: string,
    accountCurrency?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };
    try {
      let currency = accountCurrency;
      if (!currency) {
        const acc = await db.accounts.get(tx.accountId);
        currency = acc?.currency || 'USD';
      }

      let payload = this.buildTransactionPayload(tx, userId, currency, this.transactionsHasExtendedCols);
      let { error } = await supabase.from('transactions').upsert(payload);

      if (error && this.transactionsHasExtendedCols && isMissingColumnError(error)) {
        this.transactionsHasExtendedCols = false;
        payload = this.buildTransactionPayload(tx, userId, currency, false);
        ({ error } = await supabase.from('transactions').upsert(payload));
      }

      if (error) {
        console.error('Error syncing transaction to cloud:', error);
        return { success: false, error: error.message };
      }
      await this.markEntitySynced('transactions', tx.id, userId);
      return { success: true };
    } catch (err: any) {
      console.error('Error syncing transaction to cloud:', err);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async syncTransactionsBatch(txs: Transaction[], userId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || txs.length === 0) return { success: true };
    try {
      const accounts = await db.accounts.toArray();
      const accCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));

      let payloads = txs.map((tx) =>
        this.buildTransactionPayload(tx, userId, accCurrencyMap.get(tx.accountId) || 'USD', this.transactionsHasExtendedCols)
      );
      let { error } = await supabase.from('transactions').upsert(payloads);

      if (error && this.transactionsHasExtendedCols && isMissingColumnError(error)) {
        this.transactionsHasExtendedCols = false;
        payloads = txs.map((tx) =>
          this.buildTransactionPayload(tx, userId, accCurrencyMap.get(tx.accountId) || 'USD', false)
        );
        ({ error } = await supabase.from('transactions').upsert(payloads));
      }

      if (error) {
        console.error('Error batch-syncing transactions to cloud:', error);
        for (const tx of txs) await this.enqueueOperation('transactions', tx.id, 'upsert', userId);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      for (const tx of txs) await this.enqueueOperation('transactions', tx.id, 'upsert', userId);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async syncCategory(cat: Category, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || cat.isSystem) return { success: true };
    try {
      const { error } = await supabase.from('categories').upsert({
        id: cat.id,
        user_id: userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        parent_id: cat.parentId || null,
        order: cat.order || 0,
        is_system: false,
        created_at: cat.createdAt || new Date().toISOString(),
      });
      if (error) {
        console.error('Error syncing category to cloud:', error);
        return { success: false, error: error.message };
      }
      await this.markEntitySynced('categories', cat.id, userId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async syncCategoriesBatch(cats: Category[], userId: string): Promise<{ success: boolean; error?: string }> {
    const custom = cats.filter((c) => !c.isSystem);
    if (!supabase || custom.length === 0) return { success: true };
    try {
      const payloads = custom.map((cat) => ({
        id: cat.id,
        user_id: userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        parent_id: cat.parentId || null,
        order: cat.order || 0,
        is_system: false,
        created_at: cat.createdAt || new Date().toISOString(),
      }));
      const { error } = await supabase.from('categories').upsert(payloads);
      if (error) {
        for (const c of custom) await this.enqueueOperation('categories', c.id, 'upsert', userId);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      for (const c of custom) await this.enqueueOperation('categories', c.id, 'upsert', userId);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Deletes an account (and any incoming transfer transactions referencing it as destination) from Supabase
   */
  static async deleteCloudAccount(accountId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };
    try {
      // Delete transfers where this account was the destination (`to_account_id` has no FK cascade)
      const { error: destErr } = await supabase
        .from('transactions')
        .delete()
        .eq('to_account_id', accountId);
      if (destErr) {
        console.error('Error deleting destination transfer txs from cloud:', destErr);
      }

      const { error } = await supabase.from('accounts').delete().eq('id', accountId);
      if (error) {
        console.error('Error deleting account from cloud:', error);
        return { success: false, error: error.message };
      }
      if (userId) await this.unmarkEntitySynced('accounts', accountId, userId);
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting account from cloud:', err);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Deletes a transaction from Supabase
   */
  static async deleteCloudTransaction(txId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txId);
      if (error) {
        console.error('Error deleting transaction from cloud:', error);
        return { success: false, error: error.message };
      }
      if (userId) await this.unmarkEntitySynced('transactions', txId, userId);
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting transaction from cloud:', err);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async deleteCloudTransactionsBatch(txIds: string[], userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || txIds.length === 0) return { success: true };
    try {
      const { error } = await supabase.from('transactions').delete().in('id', txIds);
      if (error) {
        console.error('Error batch-deleting transactions from cloud:', error);
        return { success: false, error: error.message };
      }
      if (userId) {
        for (const id of txIds) await this.unmarkEntitySynced('transactions', id, userId);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async deleteCloudCategory(catId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };
    try {
      await supabase.from('categories').delete().eq('parent_id', catId);
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) {
        console.error('Error deleting category from cloud:', error);
        return { success: false, error: error.message };
      }
      if (userId) await this.unmarkEntitySynced('categories', catId, userId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  static async setCloudLoggedInState(userId: string, isLoggedIn: boolean): Promise<void> {
    if (!supabase) return;
    try {
      await supabase
        .from('users')
        .update({ is_logged_in: isLoggedIn, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.error('Error updating cloud session state:', err);
    }
  }

  /**
   * Admin: Fetches all users from Supabase
   */
  static async getAllUsers(): Promise<UserProfile[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        if (error) console.error('Error fetching cloud users:', error);
        return [];
      }

      return data.map((u: any) => this.mapUserRow(u));
    } catch (err) {
      console.error('Exception fetching cloud users:', err);
      return [];
    }
  }

  /**
   * Admin: Deletes user from Supabase (cascades accounts and transactions)
   */
  static async deleteUser(userId: string): Promise<void> {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) console.error('Error deleting cloud user:', error);
    } catch (err) {
      console.error('Error deleting cloud user:', err);
    }
  }

  /**
   * Admin / Settings: Updates user PIN in Supabase
   */
  static async updateUserPin(userId: string, newPin: string): Promise<void> {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ pin_code: newPin, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) console.error('Error updating cloud user pin:', error);
    } catch (err) {
      console.error('Error updating cloud user pin:', err);
    }
  }

  /**
   * Admin: Updates user role in Supabase
   */
  static async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) console.error('Error updating cloud user role:', error);
    } catch (err) {
      console.error('Error updating cloud user role:', err);
    }
  }

  /**
   * Admin: Retrieves system metrics across all users from Supabase
   */
  static async getSystemMetrics(): Promise<{
    totalUsers: number;
    totalAccounts: number;
    totalTransactions: number;
    totalCategories: number;
  } | null> {
    if (!supabase) return null;
    try {
      const [usersRes, accountsRes, txsRes, catsRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('accounts').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
      ]);

      if (usersRes.error) return null;

      return {
        totalUsers: Math.max(usersRes.count ?? 0, 1),
        totalAccounts: accountsRes.count ?? 0,
        totalTransactions: txsRes.count ?? 0,
        totalCategories: catsRes.count ?? 0,
      };
    } catch (err) {
      console.error('Error fetching cloud metrics:', err);
      return null;
    }
  }
}
