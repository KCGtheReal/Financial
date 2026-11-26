// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db, DEFAULT_CATEGORIES, recalculateAllAccountBalances } from '../src/db/db';
import { LedgerRepository } from '../src/db/repository';
import { CloudSyncService } from '../src/db/supabase';
import { useAppStore } from '../src/store/useAppStore';
import { useLedgerStore } from '../src/store/useLedgerStore';
import { TransactionTable } from '../src/components/ledger/TransactionTable';
import { TransactionBulkToolbar } from '../src/components/ledger/TransactionBulkToolbar';
import { SettingsView } from '../src/components/views/SettingsView';
import { Account, Category, Transaction, UserProfile } from '@contracts/api';
import { t } from '../src/i18n';

const nowIso = () => new Date().toISOString();

async function resetDbAndStores() {
  localStorage.clear();
  await db.transactions.clear();
  await db.accounts.clear();
  await db.categories.clear();
  await db.savedFilters.clear();
  await db.users.clear();
  await db.settings.clear();
  await db.syncQueue.clear();
  await db.categories.bulkPut(DEFAULT_CATEGORIES);

  useLedgerStore.getState().clearSelection();
  useAppStore.getState().resetFilter();
  useAppStore.getState().setSelectedAccountId(null);
  useAppStore.getState().setEditingAccount(null);
  useAppStore.getState().setEditingTransaction(null);
  useAppStore.getState().setUserProfile(null);
  useAppStore.getState().setLanguage('en');
  useAppStore.getState().setTheme('light');
  useAppStore.getState().setIsAppLocked(false);
}

describe('Pre-Launch Audit & Multi-Device Sync Regressions', () => {
  beforeEach(async () => {
    await resetDbAndStores();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('filters single and split transactions by subcategoryId', () => {
    const singleTx: Transaction = {
      id: 'tx-single-sub',
      type: 'expense',
      amount: 1200,
      date: '2026-11-26',
      accountId: 'acc-1',
      categoryId: 'cat-exp-food',
      subcategoryId: 'cat-sub-groceries',
      merchant: 'Lucky Market',
      tags: [],
      paymentMethod: 'debit_card',
      status: 'cleared',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const splitTx: Transaction = {
      id: 'tx-split-sub',
      type: 'expense',
      amount: 900,
      date: '2026-11-26',
      accountId: 'acc-1',
      merchant: 'Morning Stop',
      tags: [],
      paymentMethod: 'cash',
      status: 'cleared',
      splits: [
        { id: 'sp-1', categoryId: 'cat-exp-food', subcategoryId: 'cat-sub-coffee', amount: 400 },
        { id: 'sp-2', categoryId: 'cat-exp-transport', subcategoryId: 'cat-sub-fuel', amount: 500 },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    expect(
      LedgerRepository.filterTransactions([singleTx, splitTx], { categoryIds: ['cat-sub-groceries'] }).map((x) => x.id)
    ).toEqual(['tx-single-sub']);

    expect(
      LedgerRepository.filterTransactions([singleTx, splitTx], { categoryIds: ['cat-sub-coffee'] }).map((x) => x.id)
    ).toEqual(['tx-split-sub']);

    expect(
      LedgerRepository.filterTransactions([singleTx, splitTx], { categoryIds: ['cat-exp-food'] }).map((x) => x.id)
    ).toEqual(['tx-single-sub', 'tx-split-sub']);
  });

  it('preserves updatedAt on unchanged accounts during recalculateAllAccountBalances', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    const unchangedAcc: Account = {
      id: 'acc-unchanged',
      name: 'Savings Card',
      type: 'savings',
      currency: 'USD',
      initialBalance: 10000,
      currentBalance: 10000,
      color: '#000000',
      icon: 'Wallet',
      isArchived: false,
      createdAt: fixedTime,
      updatedAt: fixedTime,
    };
    const changedAcc: Account = {
      id: 'acc-changed',
      name: 'Daily Card',
      type: 'bank',
      currency: 'USD',
      initialBalance: 5000,
      currentBalance: 5000,
      color: '#000000',
      icon: 'CreditCard',
      isArchived: false,
      createdAt: fixedTime,
      updatedAt: fixedTime,
    };

    await db.accounts.bulkPut([unchangedAcc, changedAcc]);
    await db.transactions.put({
      id: 'tx-diff',
      type: 'expense',
      amount: 1500,
      date: '2026-11-26',
      accountId: 'acc-changed',
      categoryId: 'cat-exp-food',
      merchant: 'Cafe',
      tags: [],
      paymentMethod: 'debit_card',
      status: 'cleared',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await recalculateAllAccountBalances();

    const reloadedUnchanged = await db.accounts.get('acc-unchanged');
    const reloadedChanged = await db.accounts.get('acc-changed');

    expect(reloadedUnchanged?.updatedAt).toBe(fixedTime);
    expect(reloadedUnchanged?.currentBalance).toBe(10000);
    expect(reloadedChanged?.currentBalance).toBe(3500);
    expect(reloadedChanged?.updatedAt).not.toBe(fixedTime);
  });

  it('syncs accounts, transactions, categories, and PIN to CloudSyncService and enqueues offline fallbacks', async () => {
    const user: UserProfile = {
      id: 'usr-sync-1',
      name: 'Kong User',
      email: 'kong@example.com',
      pinCode: '2123',
      currency: 'USD',
      role: 'user',
      isLoggedIn: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.users.put(user);
    await db.settings.put({ key: 'userProfile', value: user });

    vi.spyOn(CloudSyncService, 'isConfigured').mockReturnValue(true);
    const syncAccSpy = vi.spyOn(CloudSyncService, 'syncAccount').mockResolvedValue({ success: true });
    const syncTxSpy = vi.spyOn(CloudSyncService, 'syncTransaction').mockResolvedValue({ success: true });
    const syncCatSpy = vi.spyOn(CloudSyncService, 'syncCategory').mockResolvedValue({ success: true });
    const delTxSpy = vi.spyOn(CloudSyncService, 'deleteCloudTransaction').mockResolvedValue({ success: true });
    const delAccSpy = vi.spyOn(CloudSyncService, 'deleteCloudAccount').mockResolvedValue({ success: true });
    const delCatSpy = vi.spyOn(CloudSyncService, 'deleteCloudCategory').mockResolvedValue({ success: true });
    const pinSpy = vi.spyOn(CloudSyncService, 'updateUserPin').mockResolvedValue();

    const card: Account = {
      id: 'acc-iphone-1',
      name: 'ABA Visa',
      type: 'credit_card',
      currency: 'USD',
      initialBalance: 100000,
      currentBalance: 100000,
      color: '#09090B',
      icon: 'CreditCard',
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await LedgerRepository.createAccount(card);
    expect(syncAccSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'acc-iphone-1', userId: 'usr-sync-1' }), 'usr-sync-1');

    const tx: Transaction = {
      id: 'tx-iphone-1',
      type: 'expense',
      amount: 2500,
      date: '2026-11-26',
      accountId: 'acc-iphone-1',
      categoryId: 'cat-exp-food',
      merchant: 'Lunch',
      tags: [],
      paymentMethod: 'credit_card',
      status: 'cleared',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await LedgerRepository.createTransaction(tx);
    expect(syncTxSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-iphone-1', userId: 'usr-sync-1' }), 'usr-sync-1', 'USD');
    expect(syncAccSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-iphone-1', currentBalance: 97500 }),
      'usr-sync-1'
    );

    const customCat: Category = {
      id: 'cat-custom-1',
      name: 'Side Hustle',
      type: 'income',
      icon: 'Briefcase',
      color: '#000000',
      order: 99,
    };
    await LedgerRepository.createCategory(customCat);
    expect(syncCatSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-custom-1', userId: 'usr-sync-1' }), 'usr-sync-1');

    await LedgerRepository.updateUserPin('usr-sync-1', '5678');
    expect(pinSpy).toHaveBeenCalledWith('usr-sync-1', '5678');
    expect((await db.users.get('usr-sync-1'))?.pinCode).toBe('5678');
    expect((await LedgerRepository.getUserProfile())?.pinCode).toBe('5678');

    await LedgerRepository.deleteCategory('cat-custom-1');
    expect(delCatSpy).toHaveBeenCalledWith('cat-custom-1', 'usr-sync-1');

    // Simulate offline failure -> verify syncQueue fallback + deduping
    syncTxSpy.mockResolvedValueOnce({ success: false, error: 'Network offline' });
    await LedgerRepository.createTransaction({
      ...tx,
      id: 'tx-offline-1',
      amount: 500,
    });
    const queuedUpsert = await db.syncQueue.where('entityId').equals('tx-offline-1').first();
    expect(queuedUpsert?.operation).toBe('upsert');
    expect(queuedUpsert?.table).toBe('transactions');

    delTxSpy.mockResolvedValueOnce({ success: false, error: 'Still offline' });
    await LedgerRepository.deleteTransaction('tx-offline-1');
    const queuedDelete = await db.syncQueue.where('entityId').equals('tx-offline-1').toArray();
    expect(queuedDelete).toHaveLength(1);
    expect(queuedDelete[0].operation).toBe('delete');

    await LedgerRepository.deleteAccount('acc-iphone-1');
    expect(delAccSpy).toHaveBeenCalledWith('acc-iphone-1', 'usr-sync-1');
  });

  it('isolates local data across user switches while preserving DEFAULT_CATEGORIES and allows editing own profile', async () => {
    const user1: UserProfile = {
      id: 'usr-1',
      name: 'Phone User 1',
      email: 'one@apex.finance',
      pinCode: '1111',
      currency: 'USD',
      isLoggedIn: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await LedgerRepository.saveUserProfile(user1);

    // Editing own profile does not fail duplicate email check
    const updatedUser1 = await LedgerRepository.saveUserProfile({
      ...user1,
      name: 'Phone User 1 Updated',
      bio: 'Personal budget',
    });
    expect(updatedUser1.name).toBe('Phone User 1 Updated');

    // Another user trying to reuse usr-1's email must be rejected
    await expect(
      LedgerRepository.saveUserProfile({
        id: 'usr-2',
        name: 'Imposter',
        email: 'one@apex.finance',
        pinCode: '2222',
        currency: 'USD',
        isLoggedIn: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    ).rejects.toThrow(/already exists/i);

    // Populate usr-1 local state
    await db.accounts.put({
      id: 'acc-usr-1',
      userId: 'usr-1',
      name: 'User 1 Card',
      type: 'bank',
      currency: 'USD',
      initialBalance: 1000,
      currentBalance: 1000,
      color: '#000000',
      icon: 'Wallet',
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.categories.put({
      id: 'cat-usr-1',
      userId: 'usr-1',
      name: 'Custom Expense',
      type: 'expense',
      icon: 'Tag',
      color: '#000000',
      isSystem: false,
      order: 200,
    });
    await CloudSyncService.enqueueOperation('accounts', 'acc-usr-1', 'upsert', 'usr-1');

    // Same user keep-alive does NOT clear
    await CloudSyncService.prepareDeviceForUser('usr-1');
    expect(await db.accounts.count()).toBe(1);

    // Switching to usr-2 clears user 1's local tables & queue, preserving system categories
    await CloudSyncService.prepareDeviceForUser('usr-2');
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect(await db.categories.get('cat-usr-1')).toBeUndefined();
    expect(await db.categories.get('cat-exp-food')).toBeDefined();
  });

  it('aggregates TransactionTable income and expense totals separately per currency', async () => {
    await db.accounts.bulkPut([
      {
        id: 'acc-usd',
        name: 'USD Bank',
        type: 'bank',
        currency: 'USD',
        initialBalance: 0,
        currentBalance: 10000,
        color: '#000000',
        icon: 'Wallet',
        isArchived: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'acc-khr',
        name: 'KHR Cash',
        type: 'cash',
        currency: 'KHR',
        initialBalance: 0,
        currentBalance: 40000,
        color: '#000000',
        icon: 'Banknote',
        isArchived: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]);

    await db.transactions.bulkPut([
      {
        id: 'tx-usd-inc',
        type: 'income',
        amount: 10000,
        date: '2026-11-26',
        accountId: 'acc-usd',
        categoryId: 'cat-inc-salary',
        merchant: 'Client A',
        tags: [],
        paymentMethod: 'bank_transfer',
        status: 'cleared',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'tx-khr-inc',
        type: 'income',
        amount: 40000,
        date: '2026-11-26',
        accountId: 'acc-khr',
        categoryId: 'cat-inc-other',
        merchant: 'Bonus',
        tags: [],
        paymentMethod: 'cash',
        status: 'cleared',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'tx-usd-exp',
        type: 'expense',
        amount: 2500,
        date: '2026-11-26',
        accountId: 'acc-usd',
        categoryId: 'cat-exp-food',
        merchant: 'Dinner',
        tags: [],
        paymentMethod: 'debit_card',
        status: 'cleared',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'tx-khr-exp',
        type: 'expense',
        amount: 10000,
        date: '2026-11-26',
        accountId: 'acc-khr',
        categoryId: 'cat-exp-transport',
        merchant: 'TukTuk',
        tags: [],
        paymentMethod: 'cash',
        status: 'cleared',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]);

    render(<TransactionTable />);

    await waitFor(() => {
      expect(screen.getByText(/\$100\.00 · 40,000/)).toBeDefined();
      expect(screen.getByText(/\$25\.00 · 10,000/)).toBeDefined();
    });
  });

  it('passes subcategory ID (not name) when recategorizing in TransactionBulkToolbar', async () => {
    await db.accounts.put({
      id: 'acc-1',
      name: 'Cash',
      type: 'cash',
      currency: 'USD',
      initialBalance: 5000,
      currentBalance: 4000,
      color: '#000000',
      icon: 'Wallet',
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.transactions.put({
      id: 'tx-bulk-1',
      type: 'expense',
      amount: 1000,
      date: '2026-11-26',
      accountId: 'acc-1',
      merchant: 'Market',
      tags: [],
      paymentMethod: 'cash',
      status: 'cleared',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    useLedgerStore.getState().selectAll(['tx-bulk-1']);

    const bulkUpdateSpy = vi.spyOn(LedgerRepository, 'bulkUpdate');

    render(<TransactionBulkToolbar />);

    fireEvent.click(screen.getByTitle(t('bulkRecategorize', 'en')));
    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Food & Dining'));
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Groceries'));
    fireEvent.click(screen.getByText(t('apply', 'en')));

    await waitFor(async () => {
      expect(bulkUpdateSpy).toHaveBeenCalledWith(['tx-bulk-1'], {
        categoryId: 'cat-exp-food',
        subcategoryId: 'cat-sub-groceries',
      });
      const updated = await db.transactions.get('tx-bulk-1');
      expect(updated?.subcategoryId).toBe('cat-sub-groceries');
    });
  });

  it('masks current PIN until revealed, persists PIN updates, gates Admin Console, and resets session on sign out', async () => {
    const standardUser: UserProfile = {
      id: 'usr-settings',
      name: 'Standard Member',
      email: 'member@apex.finance',
      pinCode: '2123',
      currency: 'USD',
      role: 'user',
      isLoggedIn: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await LedgerRepository.saveUserProfile(standardUser);
    useAppStore.getState().setUserProfile(standardUser);
    useAppStore.getState().setPinCode('2123');
    useAppStore.getState().setSelectedAccountId('acc-temp');

    render(<SettingsView />);

    // Non-admin should not see Admin Console entry
    expect(screen.queryByText(t('adminConsole', 'en'))).toBeNull();

    // PIN should be masked initially
    expect(screen.getByText(new RegExp(`${t('currentPin', 'en')}: ••••`))).toBeDefined();
    expect(screen.queryByText(/2123/)).toBeNull();

    // Reveal PIN toggle shows 2123
    fireEvent.click(screen.getByLabelText('Show PIN'));
    expect(screen.getByText(/2123/)).toBeDefined();

    // Open Change PIN modal & persist new PIN
    fireEvent.click(screen.getByText(t('changePin', 'en')));
    const pinInput = await screen.findByPlaceholderText('••••');
    fireEvent.change(pinInput, { target: { value: '9876' } });
    fireEvent.click(screen.getByText(t('save', 'en')));

    await waitFor(async () => {
      expect(useAppStore.getState().pinCode).toBe('9876');
      expect((await db.users.get('usr-settings'))?.pinCode).toBe('9876');
      expect((await LedgerRepository.getUserProfile())?.pinCode).toBe('9876');
    });

    // Sign out resets selection & user session state
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText(t('signOut', 'en')));
    await waitFor(() => {
      expect(useAppStore.getState().userProfile?.isLoggedIn).toBe(false);
      expect(useAppStore.getState().selectedAccountId).toBeNull();
    });
  });
});
