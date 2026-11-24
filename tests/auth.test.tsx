// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { db } from '../src/db/db';
import { LedgerRepository } from '../src/db/repository';
import { AuthModal } from '../src/components/auth/AuthModal';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { useAppStore } from '../src/store/useAppStore';
import { UserProfile } from '@contracts/api';

describe('Real User Account & Authentication Unit Tests', () => {
  beforeEach(async () => {
    await db.settings.clear();
    useAppStore.setState({
      userProfile: null,
      isAuthModalOpen: false,
      authMode: 'signup',
      pinCode: '1234',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('returns null when no user profile is stored', async () => {
    const profile = await LedgerRepository.getUserProfile();
    expect(profile).toBeNull();
  });

  it('creates and saves a real personal account', async () => {
    const realUser: UserProfile = {
      id: 'usr-real-001',
      name: 'Kong Chamroeun',
      email: 'kong.chamroeun@gmail.com',
      avatar: 'Crown',
      avatarColor: '#09090B',
      pinCode: '8899',
      currency: 'USD',
      bio: 'Executive Private Wealth Ledger',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await LedgerRepository.saveUserProfile(realUser);

    const saved = await LedgerRepository.getUserProfile();
    expect(saved).not.toBeNull();
    expect(saved!.id).toBe('usr-real-001');
    expect(saved!.name).toBe('Kong Chamroeun');
    expect(saved!.email).toBe('kong.chamroeun@gmail.com');
    expect(saved!.avatar).toBe('Crown');
    expect(saved!.pinCode).toBe('8899');
    expect(saved!.bio).toBe('Executive Private Wealth Ledger');
  });

  it('authenticates user login with matching email and PIN', async () => {
    const realUser: UserProfile = {
      id: 'usr-real-002',
      name: 'Elena Rostova',
      email: 'elena@apex.dev',
      avatar: 'ShieldCheck',
      avatarColor: '#2563EB',
      pinCode: '5566',
      currency: 'EUR',
      isLoggedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await LedgerRepository.saveUserProfile(realUser);

    // Attempt with incorrect PIN
    const failPin = await LedgerRepository.loginUser('elena@apex.dev', '0000');
    expect(failPin.success).toBe(false);
    expect(failPin.error).toContain('PIN');

    // Attempt with unknown email
    const failEmail = await LedgerRepository.loginUser('unknown@apex.dev', '5566');
    expect(failEmail.success).toBe(false);
    expect(failEmail.error).toContain('not found');

    // Attempt with valid credentials
    const success = await LedgerRepository.loginUser('elena@apex.dev', '5566');
    expect(success.success).toBe(true);
    expect(success.user?.isLoggedIn).toBe(true);
    expect(success.user?.name).toBe('Elena Rostova');

    // Confirm persisted state in DB
    const persisted = await LedgerRepository.getUserProfile();
    expect(persisted).not.toBeNull();
    expect(persisted!.isLoggedIn).toBe(true);
  });

  it('signs out user cleanly by updating isLoggedIn to false', async () => {
    const realUser: UserProfile = {
      id: 'usr-real-003',
      name: 'Sam Fisher',
      email: 'sam@echelon.org',
      pinCode: '1122',
      currency: 'USD',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await LedgerRepository.saveUserProfile(realUser);

    const loggedOut = await LedgerRepository.logoutUser();
    expect(loggedOut).not.toBeNull();
    expect(loggedOut!.isLoggedIn).toBe(false);

    const persisted = await LedgerRepository.getUserProfile();
    expect(persisted).not.toBeNull();
    expect(persisted!.isLoggedIn).toBe(false);
  });

  describe('AuthModal Component Integration Tests', () => {
    it('creates a real account and synchronizes state seamlessly', async () => {
      useAppStore.setState({
        isAuthModalOpen: true,
        authMode: 'signup',
      });

      render(<AuthModal />);

      // Fill in real user credentials
      const nameInput = screen.getByPlaceholderText(/e\.g\. Kong Chamroeun/i);
      const emailInput = screen.getByPlaceholderText(/e\.g\. kong@gmail\.com/i);
      const pinInput = screen.getByPlaceholderText(/••••/i);

      fireEvent.change(nameInput, { target: { value: 'Kong Chamroeun' } });
      fireEvent.change(emailInput, { target: { value: 'kong@apex.finance' } });
      fireEvent.change(pinInput, { target: { value: '7788' } });

      // Click Create Account button
      const submitBtn = screen.getByTestId('auth-submit-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const currentProfile = useAppStore.getState().userProfile;
        expect(currentProfile?.name).toBe('Kong Chamroeun');
        expect(currentProfile?.email).toBe('kong@apex.finance');
        expect(currentProfile?.pinCode).toBe('7788');
      });
    });

    it('renders profile management when user is authenticated in profile mode', () => {
      useAppStore.setState({
        isAuthModalOpen: true,
        authMode: 'profile',
        userProfile: {
          id: 'usr-active-1',
          name: 'Kong Chamroeun',
          email: 'kong@apex.finance',
          avatar: 'Crown',
          avatarColor: '#09090B',
          pinCode: '7788',
          currency: 'USD',
          bio: 'Private Wealth',
          isLoggedIn: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      render(<AuthModal />);

      expect(screen.getByText('Kong Chamroeun')).toBeTruthy();
      expect(screen.getByText('kong@apex.finance')).toBeTruthy();
      expect(screen.getByText(/active session/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
    });
  });

  describe('AuthScreen Gate Component Tests', () => {
    it('renders the B&W auth screen with Sign In and Sign Up tabs', () => {
      render(<AuthScreen />);

      expect(screen.getByText('ApexFinance')).toBeTruthy();
      expect(screen.getByText(/Sign in!/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('name@apex.finance')).toBeTruthy();
      expect(screen.getByPlaceholderText('••••')).toBeTruthy();
    });

    it('toggles between Sign In and Sign Up modes cleanly', () => {
      render(<AuthScreen />);

      // Initially in signin mode (no Full Name field)
      expect(screen.queryByPlaceholderText(/Kong Chamroeun/i)).toBeNull();

      // Click Sign Up tab
      const signUpTab = screen.getByTestId('auth-tab-signup');
      expect(signUpTab).toBeTruthy();
      fireEvent.click(signUpTab);

      // Now Full Name field is rendered
      expect(screen.getByPlaceholderText(/Kong Chamroeun/i)).toBeTruthy();
    });
  });
});
