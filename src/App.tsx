import React, { useEffect, useState, useRef, useCallback } from 'react';
import { seedDatabaseIfEmpty, recalculateAllAccountBalances } from './db/db';
import { LedgerRepository } from './db/repository';
import { CloudSyncService, supabase } from './db/supabase';
import { historyManager } from './utils/history';
import { Header } from './components/layout/Header';
import { AccountsBar } from './components/layout/AccountsBar';
import { FilterBar } from './components/ledger/FilterBar';
import { TransactionTable } from './components/ledger/TransactionTable';
import { TransactionBulkToolbar } from './components/ledger/TransactionBulkToolbar';
import { TransactionModal } from './components/ledger/TransactionModal';
import { AccountModal } from './components/ledger/AccountModal';
import { CategoryModal } from './components/ledger/CategoryModal';
import { AuthModal } from './components/auth/AuthModal';
import { AuthScreen } from './components/auth/AuthScreen';
import { AdminPanelModal } from './components/admin/AdminPanelModal';
import { CommandPalette } from './components/common/CommandPalette';
import { PinLockScreen } from './components/common/PinLockScreen';
import { PullToRefresh } from './components/common/PullToRefresh';
import { MobileNav } from './components/layout/MobileNav';
import { AccountsView } from './components/views/AccountsView';
import { CategoriesView } from './components/views/CategoriesView';
import { SettingsView } from './components/views/SettingsView';
import { useAppStore } from './store/useAppStore';
import { useLedgerStore } from './store/useLedgerStore';

export const App: React.FC = () => {
  const {
    isPrivacyMode,
    activeTab,
    language,
    userProfile,
    isAppLocked,
    isQuickAddOpen,
    editingTransaction,
    isAccountModalOpen,
    isCategoryModalOpen,
    isAuthModalOpen,
    isAdminPanelOpen,
    isCommandPaletteOpen,
  } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const lastSyncAttemptRef = useRef<number>(0);
  const prevLockedRef = useRef<boolean>(isAppLocked);
  const [realtimeEpoch, setRealtimeEpoch] = useState(0);

  const runBackgroundSync = useCallback(async (force = false) => {
    if (!CloudSyncService.isConfigured()) return;
    const now = Date.now();
    if (!force && now - lastSyncAttemptRef.current < 1000) return;
    lastSyncAttemptRef.current = now;

    const store = useAppStore.getState();
    if (!store.userProfile?.isLoggedIn) return;

    store.setCloudSyncStatus(true);
    try {
      const res = await LedgerRepository.syncWithCloud({
        onProfileUpdated: (updated) => {
          useAppStore.getState().setUserProfile(updated);
          if (updated.pinCode) {
            useAppStore.getState().setPinCode(updated.pinCode);
          }
        },
      });
      if (res.success) {
        useAppStore.getState().setCloudSyncStatus(false, new Date().toISOString());
      } else {
        useAppStore.getState().setCloudSyncStatus(false);
      }
    } catch {
      useAppStore.getState().setCloudSyncStatus(false);
    }
  }, []);

  const handlePullToRefresh = useCallback(async () => {
    await runBackgroundSync(true);
    if (!CloudSyncService.isConfigured()) {
      await recalculateAllAccountBalances();
    }
    useLedgerStore.getState().incrementHistoryRevision();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistration === 'function') {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {})).catch(() => {});
    }
  }, [runBackgroundSync]);

  useEffect(() => {
    seedDatabaseIfEmpty()
      .then(() => LedgerRepository.getUserProfile())
      .then((profile) => {
        if (profile) {
          useAppStore.getState().setUserProfile(profile);
          if (profile.pinCode) {
            useAppStore.getState().setPinCode(profile.pinCode);
          }
          if (profile.isLoggedIn) {
            runBackgroundSync(true);
          }
        } else {
          useAppStore.getState().setUserProfile(null);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize database or user profile:', err);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [runBackgroundSync]);

  // Trigger bidirectional Cloud Sync whenever authenticated user opens app, comes online, resumes on iOS, unlocks, or stays active
  const activeUserId = userProfile?.isLoggedIn ? userProfile.id : null;
  useEffect(() => {
    if (!activeUserId || !CloudSyncService.isConfigured()) return;

    runBackgroundSync(true);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundSync(true);
        setRealtimeEpoch((n) => n + 1);
      }
    };
    const handlePageShow = () => runBackgroundSync(true);
    const handleOnline = () => {
      runBackgroundSync(true);
      setRealtimeEpoch((n) => n + 1);
    };
    const handleFocus = () => runBackgroundSync(false);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    // Live periodic background sync while visible & online so multi-device changes appear without manual re-login
    const syncIntervalId = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        (typeof navigator === 'undefined' || navigator.onLine !== false) &&
        !useAppStore.getState().isAppLocked
      ) {
        runBackgroundSync(true);
      }
    }, 4000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(syncIntervalId);
    };
  }, [activeUserId, runBackgroundSync]);

  // Dedicated Supabase Realtime subscription with clean reconnect on foreground/online
  useEffect(() => {
    if (!activeUserId || !CloudSyncService.isConfigured() || !supabase) return;

    const channel = supabase
      .channel(`apex-user-sync-${activeUserId}-${realtimeEpoch}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'accounts', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'accounts', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'accounts' },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'categories', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'categories', filter: `user_id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'categories' },
        () => runBackgroundSync(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${activeUserId}` },
        () => runBackgroundSync(true)
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeUserId, realtimeEpoch, runBackgroundSync]);

  // Immediately sync when user unlocks PIN lock screen
  useEffect(() => {
    if (prevLockedRef.current && !isAppLocked && activeUserId) {
      runBackgroundSync(true);
    }
    prevLockedRef.current = isAppLocked;
  }, [isAppLocked, activeUserId, runBackgroundSync]);

  // Sync when switching views so remote changes appear quickly
  useEffect(() => {
    if (activeUserId) {
      runBackgroundSync(false);
    }
  }, [activeTab, activeUserId, runBackgroundSync]);

  // Global desktop keyboard shortcuts: N (New tx), Ctrl/Cmd+Z (Undo), Ctrl/Cmd+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    if (!activeUserId) return;

    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const store = useAppStore.getState();
      if (store.isAppLocked) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditingInput =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;

      if (isEditingInput) return;

      const isAnyModalOpen =
        store.isQuickAddOpen ||
        Boolean(store.editingTransaction) ||
        store.isAccountModalOpen ||
        store.isCategoryModalOpen ||
        store.isAuthModalOpen ||
        store.isAdminPanelOpen ||
        store.isCommandPaletteOpen;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          await historyManager.redo();
        } else {
          await historyManager.undo();
        }
        useLedgerStore.getState().incrementHistoryRevision();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        await historyManager.redo();
        useLedgerStore.getState().incrementHistoryRevision();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && !isAnyModalOpen) {
        e.preventDefault();
        store.setQuickAddOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeUserId]);

  // Instantly reset scroll to top whenever switching tabs
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  // Loading state while checking database authentication
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] flex items-center justify-center">
        <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-black text-sm tracking-tighter animate-pulse shadow-md">
          AP
        </div>
      </div>
    );
  }

  // Authentication Gate: User can only enter the dashboard when logged in
  const isAuthenticated = Boolean(userProfile && userProfile.isLoggedIn);

  if (!isAuthenticated) {
    return (
      <div
        lang={language}
        className={`h-[100dvh] w-full overflow-hidden bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans select-none transition-colors duration-200 ${
          language === 'km' ? 'font-khmer' : ''
        }`}
      >
        <AuthScreen />
      </div>
    );
  }

  const isAnyModalOpen =
    isAppLocked ||
    isQuickAddOpen ||
    Boolean(editingTransaction) ||
    isAccountModalOpen ||
    isCategoryModalOpen ||
    isAuthModalOpen ||
    isAdminPanelOpen ||
    isCommandPaletteOpen;

  return (
    <div
      lang={language}
      className={`min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans select-none transition-colors duration-200 ${
        language === 'km' ? 'font-khmer' : ''
      } ${isPrivacyMode ? 'privacy-active' : ''}`}
    >
      {/* PIN App Lock Screen */}
      <PinLockScreen />

      {/* Global Header */}
      <Header />

      {/* Pull-to-Refresh Wrapper below sticky header */}
      <PullToRefresh onRefresh={handlePullToRefresh} isDisabled={isAnyModalOpen}>
        {/* Tab Routed Views with Fluid Slide & Fade Animation */}
        {activeTab === 'ledger' && (
          <div key="tab-ledger" className="animate-tab-switch flex flex-col flex-1">
            <AccountsBar />
            <FilterBar />
            <main className="flex-1">
              <TransactionTable />
            </main>
          </div>
        )}

        {activeTab === 'accounts' && (
          <main key="tab-accounts" className="flex-1 animate-tab-switch">
            <AccountsView />
          </main>
        )}

        {activeTab === 'categories' && (
          <main key="tab-categories" className="flex-1 animate-tab-switch">
            <CategoriesView />
          </main>
        )}

        {activeTab === 'settings' && (
          <main key="tab-settings" className="flex-1 animate-tab-switch">
            <SettingsView />
          </main>
        )}
      </PullToRefresh>

      {/* Floating Multi-select Bulk Actions Toolbar */}
      <TransactionBulkToolbar />

      {/* Modals & Dialogs (Minimalist B&W Bottom Sheet on mobile) */}
      <TransactionModal />
      <AccountModal />
      <CategoryModal />
      <AuthModal />
      <AdminPanelModal />
      <CommandPalette />

      {/* Mobile Native Bottom Navigation Bar */}
      <MobileNav />
    </div>
  );
};

export default App;
