import Dexie, { type Table } from 'dexie';
import { Account, Transaction, Category, SavedFilter, AppSettings, UserProfile, SyncQueueItem } from '@contracts/api';

export class ApexDatabase extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  savedFilters!: Table<SavedFilter, string>;
  settings!: Table<{ key: string; value: any }, string>;
  users!: Table<UserProfile, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('ApexFinanceDB');
    this.version(1).stores({
      accounts: 'id, name, type, currency, isArchived, createdAt',
      transactions: 'id, type, amount, date, accountId, toAccountId, categoryId, subcategoryId, merchant, status, createdAt, *tags',
      categories: 'id, name, type, parentId, order',
      savedFilters: 'id, name, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      accounts: 'id, name, type, currency, isArchived, createdAt',
      transactions: 'id, type, amount, date, accountId, toAccountId, categoryId, subcategoryId, merchant, status, createdAt, *tags',
      categories: 'id, name, type, parentId, order',
      savedFilters: 'id, name, createdAt',
      settings: 'key',
      users: 'id, email, name, role, createdAt',
    });
    this.version(3).stores({
      accounts: 'id, userId, name, type, currency, isArchived, createdAt',
      transactions: 'id, userId, type, amount, date, accountId, toAccountId, categoryId, subcategoryId, merchant, status, createdAt, *tags',
      categories: 'id, userId, name, type, parentId, order',
      savedFilters: 'id, userId, name, createdAt',
      settings: 'key',
      users: 'id, email, name, role, createdAt',
      syncQueue: 'id, table, entityId, operation, userId, timestamp',
    });
  }
}

export const db = new ApexDatabase();

// Initial Default Categories
export const DEFAULT_CATEGORIES: Category[] = [
  // Income
  { id: 'cat-inc-salary', name: 'Salary & Wages', type: 'income', icon: 'Briefcase', color: '#10B981', order: 1, isSystem: true },
  { id: 'cat-inc-invest', name: 'Investments & Dividends', type: 'income', icon: 'TrendingUp', color: '#06B6D4', order: 2, isSystem: true },
  { id: 'cat-inc-freelance', name: 'Freelance & Business', type: 'income', icon: 'Laptop', color: '#8B5CF6', order: 3, isSystem: true },
  { id: 'cat-inc-other', name: 'Other Income', type: 'income', icon: 'PlusCircle', color: '#64748B', order: 4, isSystem: true },

  // Expenses - Housing
  { id: 'cat-exp-housing', name: 'Housing', type: 'expense', icon: 'Home', color: '#F59E0B', order: 10, isSystem: true },
  { id: 'cat-sub-rent', name: 'Rent / Mortgage', type: 'expense', icon: 'Home', color: '#F59E0B', parentId: 'cat-exp-housing', order: 11, isSystem: true },
  { id: 'cat-sub-home-maint', name: 'Home Repairs', type: 'expense', icon: 'Wrench', color: '#F59E0B', parentId: 'cat-exp-housing', order: 12, isSystem: true },

  // Expenses - Food & Dining
  { id: 'cat-exp-food', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#EC4899', order: 20, isSystem: true },
  { id: 'cat-sub-groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#EC4899', parentId: 'cat-exp-food', order: 21, isSystem: true },
  { id: 'cat-sub-restaurants', name: 'Restaurants & Dining', type: 'expense', icon: 'Coffee', color: '#EC4899', parentId: 'cat-exp-food', order: 22, isSystem: true },
  { id: 'cat-sub-coffee', name: 'Coffee & Snacks', type: 'expense', icon: 'Coffee', color: '#EC4899', parentId: 'cat-exp-food', order: 23, isSystem: true },

  // Expenses - Transportation
  { id: 'cat-exp-transport', name: 'Transportation', type: 'expense', icon: 'Car', color: '#3B82F6', order: 30, isSystem: true },
  { id: 'cat-sub-fuel', name: 'Fuel & Gas', type: 'expense', icon: 'Fuel', color: '#3B82F6', parentId: 'cat-exp-transport', order: 31, isSystem: true },
  { id: 'cat-sub-transit', name: 'Public Transit & Rides', type: 'expense', icon: 'Bus', color: '#3B82F6', parentId: 'cat-exp-transport', order: 32, isSystem: true },

  // Expenses - Utilities
  { id: 'cat-exp-utilities', name: 'Utilities', type: 'expense', icon: 'Zap', color: '#EAB308', order: 40, isSystem: true },
  { id: 'cat-sub-elec', name: 'Electricity & Water', type: 'expense', icon: 'Zap', color: '#EAB308', parentId: 'cat-exp-utilities', order: 41, isSystem: true },
  { id: 'cat-sub-internet', name: 'Internet & Phone', type: 'expense', icon: 'Wifi', color: '#EAB308', parentId: 'cat-exp-utilities', order: 42, isSystem: true },

  // Expenses - Healthcare
  { id: 'cat-exp-health', name: 'Healthcare', type: 'expense', icon: 'Activity', color: '#EF4444', order: 50, isSystem: true },
  { id: 'cat-sub-meds', name: 'Pharmacy & Doctor', type: 'expense', icon: 'HeartPulse', color: '#EF4444', parentId: 'cat-exp-health', order: 51, isSystem: true },

  // Expenses - Lifestyle & Entertainment
  { id: 'cat-exp-lifestyle', name: 'Lifestyle & Fun', type: 'expense', icon: 'Film', color: '#8B5CF6', order: 60, isSystem: true },
  { id: 'cat-sub-subs', name: 'Subscriptions', type: 'expense', icon: 'Tv', color: '#8B5CF6', parentId: 'cat-exp-lifestyle', order: 61, isSystem: true },
  { id: 'cat-sub-shopping', name: 'Shopping & Gear', type: 'expense', icon: 'ShoppingBag', color: '#8B5CF6', parentId: 'cat-exp-lifestyle', order: 62, isSystem: true },
];

export const DEFAULT_ACCOUNTS: Account[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'USD',
  language: 'en',
  theme: 'dark',
  isPrivacyMode: false,
  isAppLocked: false,
  autoLockMinutes: 0,
};

export async function seedDatabaseIfEmpty() {
  // Purge any lingering legacy demo data on first load
  if (typeof localStorage !== 'undefined' && localStorage.getItem('apex_demo_purged') !== 'true') {
    const demoAccountIds = ['acc-checking-01', 'acc-savings-01', 'acc-credit-01', 'acc-wallet-01', 'acc-ewallet-01'];
    await db.accounts.where('id').anyOf(demoAccountIds).delete();
    await db.transactions.where('id').anyOf(['tx-001', 'tx-002', 'tx-003', 'tx-004', 'tx-005', 'tx-006']).delete();
    const userRec = await db.settings.get('userProfile');
    if (userRec?.value?.id === 'usr-default') {
      await db.settings.delete('userProfile');
    }
    localStorage.setItem('apex_demo_purged', 'true');
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  const appSettings = await db.settings.get('appSettings');
  if (!appSettings) {
    await db.settings.put({ key: 'appSettings', value: DEFAULT_SETTINGS });
  }

  // Ensure user profiles in settings are synced into users table
  const userRec = await db.settings.get('userProfile');
  if (userRec?.value && userRec.value.id) {
    const existing = await db.users.get(userRec.value.id);
    if (!existing) {
      await db.users.put({
        ...userRec.value,
        role: userRec.value.role || 'admin',
      });
    }
  }
}

/**
 * Recomputes all account balances from initialBalance and transaction history.
 * Invariant: transfers do not count as expense or income, but adjust account balances directly.
 */
export async function recalculateAllAccountBalances() {
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();

  for (const account of accounts) {
    let balance = account.initialBalance || 0;

    for (const tx of transactions) {
      if (tx.accountId === account.id) {
        if (tx.type === 'expense') {
          balance -= tx.amount;
        } else if (tx.type === 'income') {
          balance += tx.amount;
        } else if (tx.type === 'transfer') {
          // Outflow from source account
          balance -= tx.amount;
        }
      } else if (tx.toAccountId === account.id && tx.type === 'transfer') {
        // Inflow to destination account
        balance += tx.amount;
      }
    }

    if (account.currentBalance !== balance) {
      await db.accounts.update(account.id, {
        currentBalance: balance,
        updatedAt: new Date().toISOString()
      });
    }
  }
}
