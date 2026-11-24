import { describe, it, expect } from 'vitest';
import { CloudSyncService } from '../src/db/supabase';
import { UserProfile } from '@contracts/api';

describe('CloudSyncService Unit Tests', () => {
  it('correctly reports configuration status in test mode', () => {
    // In test environment, CloudSyncService is disabled to prevent unseeded network requests
    expect(CloudSyncService.isConfigured()).toBe(false);
  });

  it('safely handles registration attempt when unconfigured', async () => {
    const mockUser: UserProfile = {
      id: 'usr_test_1',
      name: 'Test Cloud User',
      email: 'test@cloud.io',
      pinCode: '1234',
      role: 'user',
      currency: 'USD',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await CloudSyncService.registerUser(mockUser);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cloud sync is not configured');
  });

  it('safely handles login attempt when unconfigured', async () => {
    const res = await CloudSyncService.loginUser('test@cloud.io', '1234');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cloud sync is not configured');
  });

  it('safely handles getAllUsers when unconfigured', async () => {
    const users = await CloudSyncService.getAllUsers();
    expect(users).toEqual([]);
  });

  it('safely handles getSystemMetrics when unconfigured', async () => {
    const metrics = await CloudSyncService.getSystemMetrics();
    expect(metrics).toBeNull();
  });
});
