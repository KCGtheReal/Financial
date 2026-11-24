// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { db } from '../src/db/db';
import { LedgerRepository } from '../src/db/repository';
import { AdminPanelModal } from '../src/components/admin/AdminPanelModal';
import { useAppStore } from '../src/store/useAppStore';
import { UserProfile } from '@contracts/api';

describe('Admin Console & Multi-User Management Tests', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.settings.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    useAppStore.setState({
      userProfile: null,
      isAdminPanelOpen: false,
      pinCode: '1234',
      language: 'en',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('automatically seeds current user as admin in users table if empty', async () => {
    const user: UserProfile = {
      id: 'usr-admin-1',
      name: 'Super Admin',
      email: 'admin@apex.finance',
      currency: 'USD',
      pinCode: '9988',
      role: 'admin',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await LedgerRepository.saveUserProfile(user);

    const allUsers = await LedgerRepository.getAllUsers();
    expect(allUsers.length).toBe(1);
    expect(allUsers[0].id).toBe('usr-admin-1');
    expect(allUsers[0].role).toBe('admin');
  });

  it('calculates system metrics accurately across users, accounts, transactions', async () => {
    const user: UserProfile = {
      id: 'usr-admin-2',
      name: 'Owner',
      email: 'owner@apex.finance',
      currency: 'USD',
      pinCode: '1122',
      role: 'admin',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(user);

    await db.accounts.put({
      id: 'acc-1',
      name: 'Primary Checking',
      type: 'bank',
      currency: 'USD',
      initialBalance: 500000,
      currentBalance: 500000,
      color: '#000',
      icon: 'CreditCard',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.transactions.put({
      id: 'tx-1',
      type: 'expense',
      amount: 1500,
      date: '2026-11-24',
      accountId: 'acc-1',
      merchant: 'Coffee Shop',
      tags: [],
      paymentMethod: 'debit_card',
      status: 'cleared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const metrics = await LedgerRepository.getSystemMetrics();
    expect(metrics.totalUsers).toBe(1);
    expect(metrics.totalAccounts).toBe(1);
    expect(metrics.totalTransactions).toBe(1);
  });

  it('updates any user PIN code successfully in database and active session', async () => {
    const user: UserProfile = {
      id: 'usr-target-1',
      name: 'Kong Chamroeun',
      email: 'kong@apex.finance',
      currency: 'USD',
      pinCode: '1234',
      role: 'admin',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await LedgerRepository.saveUserProfile(user);

    await LedgerRepository.updateUserPin('usr-target-1', '5678');

    const updatedUser = await db.users.get('usr-target-1');
    expect(updatedUser?.pinCode).toBe('5678');

    const sessionProfile = await LedgerRepository.getUserProfile();
    expect(sessionProfile?.pinCode).toBe('5678');
  });

  it('updates user role between admin and user', async () => {
    const user: UserProfile = {
      id: 'usr-role-test',
      name: 'Standard User',
      email: 'user@apex.finance',
      currency: 'USD',
      pinCode: '1234',
      role: 'user',
      isLoggedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(user);

    await LedgerRepository.updateUserRole('usr-role-test', 'admin');
    const updated = await db.users.get('usr-role-test');
    expect(updated?.role).toBe('admin');

    await LedgerRepository.updateUserRole('usr-role-test', 'user');
    const demoted = await db.users.get('usr-role-test');
    expect(demoted?.role).toBe('user');
  });

  it('deletes user account and wipes session if deleting active user', async () => {
    const user1: UserProfile = {
      id: 'usr-del-1',
      name: 'Active User',
      email: 'active@apex.finance',
      currency: 'USD',
      pinCode: '1111',
      role: 'admin',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const user2: UserProfile = {
      id: 'usr-del-2',
      name: 'Other User',
      email: 'other@apex.finance',
      currency: 'USD',
      pinCode: '2222',
      role: 'user',
      isLoggedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await LedgerRepository.saveUserProfile(user1);
    await db.users.put(user2);

    // Delete non-active user
    await LedgerRepository.deleteUser('usr-del-2');
    const remainingUsers = await db.users.toArray();
    expect(remainingUsers.length).toBe(1);
    expect(remainingUsers[0].id).toBe('usr-del-1');
    // Session should still exist
    const session = await LedgerRepository.getUserProfile();
    expect(session).not.toBeNull();

    // Delete active user
    await LedgerRepository.deleteUser('usr-del-1');
    const emptyUsers = await db.users.toArray();
    expect(emptyUsers.length).toBe(0);
    const wipedSession = await LedgerRepository.getUserProfile();
    expect(wipedSession).toBeNull();
  });

  it('renders AdminPanelModal with metrics and users roster', async () => {
    const adminUser: UserProfile = {
      id: 'usr-ui-admin',
      name: 'Kong Executive',
      email: 'exec@apex.finance',
      currency: 'USD',
      pinCode: '4321',
      role: 'admin',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await LedgerRepository.saveUserProfile(adminUser);

    useAppStore.setState({
      isAdminPanelOpen: true,
      userProfile: adminUser,
    });

    render(<AdminPanelModal />);

    await waitFor(() => {
      expect(screen.getByText('Admin Console')).toBeDefined();
      expect(screen.getByText('Kong Executive')).toBeDefined();
      expect(screen.getByText('exec@apex.finance')).toBeDefined();
    });

    // Verify search input is present
    const searchInput = screen.getByPlaceholderText('Search by name, email, or role...');
    expect(searchInput).toBeDefined();

    // Verify Change PIN button is present
    expect(screen.getByText('Change PIN')).toBeDefined();
  });
});
