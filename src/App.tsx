import React, { useEffect, useState } from 'react';
import { seedDatabaseIfEmpty } from './db/db';
import { LedgerRepository } from './db/repository';
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
import { MobileNav } from './components/layout/MobileNav';
import { AccountsView } from './components/views/AccountsView';
import { CategoriesView } from './components/views/CategoriesView';
import { SettingsView } from './components/views/SettingsView';
import { useAppStore } from './store/useAppStore';

export const App: React.FC = () => {
  const { isPrivacyMode, activeTab, language, userProfile } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    seedDatabaseIfEmpty()
      .then(() => LedgerRepository.getUserProfile())
      .then((profile) => {
        if (profile) {
          useAppStore.getState().setUserProfile(profile);
          if (profile.pinCode) {
            useAppStore.getState().setPinCode(profile.pinCode);
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
  }, []);

  // Detect iOS and Standalone PWA environment to clear status bar blur
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isStandalone = (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS) {
        document.documentElement.classList.add('is-ios');
      }
      if (isStandalone) {
        document.documentElement.classList.add('is-standalone');
      }
    }
  }, []);

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
