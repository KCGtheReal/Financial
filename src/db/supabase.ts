import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Account, Transaction, UserProfile } from '@contracts/api';
import { db } from './db';

// Read Vercel / Vite environment variables safely
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = (metaEnv.VITE_SUPABASE_URL || '') as string;
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || '') as string;

export const isCloudSyncConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isCloudSyncConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Cloud Synchronization and Multi-Device Authentication Engine
 */
export class CloudSyncService {
  /**
   * Check if Cloud Sync is active and reachable
   */
  static isConfigured(): boolean {
    return isCloudSyncConfigured && supabase !== null;
  }

  /**
   * Cloud Registration: Registers user profile in central Supabase database
   */
  static async registerUser(profile: UserProfile): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Cloud sync is not configured' };

    try {
      // 1. Check if email already registered
      const { data: existing } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', profile.email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'An account with this email already exists in the cloud. Please sign in.' };
      }

      // 2. Insert new user into cloud database
      const { error } = await supabase.from('users').insert({
        id: profile.id,
        name: profile.name,
        email: profile.email.toLowerCase().trim(),
        pin_code: profile.pinCode,
        role: profile.role || 'user',
        avatar: profile.avatar || 'User',
        avatar_color: profile.avatarColor || '#09090B',
        currency: profile.currency || 'USD',
        is_logged_in: true,
        created_at: profile.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (error) {
        console.error('Supabase registration error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Cloud register exception:', err);
      return { success: false, error: err.message || 'Failed to connect to cloud database' };
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
        return { success: false, error: error.message };
      }

      if (!userRow) {
        return { success: false, error: 'No account found with this email in the cloud.' };
      }

      if (userRow.pin_code !== pin) {
        return { success: false, error: 'Invalid PIN code.' };
      }

      const userProfile: UserProfile = {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        pinCode: userRow.pin_code,
        role: userRow.role as 'admin' | 'user',
        avatar: userRow.avatar,
        avatarColor: userRow.avatar_color,
        currency: userRow.currency,
        isLoggedIn: true,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at
      };

      // Pull cloud accounts and transactions into local device
      await this.pullCloudData(userProfile.id);

      return { success: true, user: userProfile };
    } catch (err: any) {
      console.error('Cloud login exception:', err);
      return { success: false, error: err.message || 'Network error connecting to cloud' };
    }
  }

  /**
   * Pulls all accounts, transactions, and categories for a user from Supabase into local Dexie
   */
  static async pullCloudData(userId: string): Promise<void> {
    if (!supabase) return;

    try {
      // 1. Pull Accounts
      const { data: cloudAccounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId);

      if (cloudAccounts && cloudAccounts.length > 0) {
        const localAccounts: Account[] = cloudAccounts.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          initialBalance: Number(a.initial_balance || 0),
          currentBalance: Number(a.balance || 0),
          isArchived: Boolean(a.is_archived),
          color: a.color || '#09090B',
          icon: a.icon || 'CreditCard',
          createdAt: a.created_at,
          updatedAt: a.updated_at
        }));
        await db.accounts.bulkPut(localAccounts);
      }

      // 2. Pull Transactions
      const { data: cloudTxs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (cloudTxs && cloudTxs.length > 0) {
        const localTxs: Transaction[] = cloudTxs.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.date,
          accountId: t.account_id,
          toAccountId: t.to_account_id,
          categoryId: t.category_id,
          subcategoryId: t.sub_category_id,
          merchant: t.merchant,
          notes: t.notes,
          status: t.status || 'cleared',
          tags: Array.isArray(t.tags) ? t.tags : [],
          paymentMethod: (t.payment_method || 'cash') as any,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        }));
        await db.transactions.bulkPut(localTxs);
      }
    } catch (err) {
      console.error('Error pulling cloud data:', err);
    }
  }

  /**
   * Pushes an account to Supabase
   */
  static async syncAccount(account: Account, userId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('accounts').upsert({
        id: account.id,
        user_id: userId,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: account.currentBalance,
        initial_balance: account.initialBalance || 0,
        is_archived: account.isArchived,
        color: account.color,
        icon: account.icon,
        created_at: account.createdAt,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error syncing account to cloud:', err);
    }
  }

  /**
   * Pushes a transaction to Supabase
   */
  static async syncTransaction(tx: Transaction, userId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('transactions').upsert({
        id: tx.id,
        user_id: userId,
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        account_id: tx.accountId,
        to_account_id: tx.toAccountId,
        category_id: tx.categoryId,
        sub_category_id: tx.subcategoryId,
        merchant: tx.merchant,
        notes: tx.notes,
        status: tx.status,
        tags: tx.tags,
        payment_method: tx.paymentMethod,
        is_split: Boolean(tx.splits && tx.splits.length > 0),
        created_at: tx.createdAt,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error syncing transaction to cloud:', err);
    }
  }

  /**
   * Deletes an account from Supabase
   */
  static async deleteCloudAccount(accountId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('accounts').delete().eq('id', accountId);
    } catch (err) {
      console.error('Error deleting account from cloud:', err);
    }
  }

  /**
   * Deletes a transaction from Supabase
   */
  static async deleteCloudTransaction(txId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('transactions').delete().eq('id', txId);
    } catch (err) {
      console.error('Error deleting transaction from cloud:', err);
    }
  }
}
