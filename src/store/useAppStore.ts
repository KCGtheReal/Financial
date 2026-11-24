import { create } from 'zustand';
import { LedgerFilter, Account, Transaction, UserProfile } from '@contracts/api';
import { Language } from '../i18n';

export type MobileTab = 'ledger' | 'accounts' | 'categories' | 'settings';

interface AppState {
  // Mobile Tab Navigation
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;

  // Theme & Locale
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  
  // Privacy & Lock
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  pinCode: string;
  setPinCode: (pin: string) => void;

  // Navigation & Selected Views
  selectedAccountId: string | null; // null = All Accounts
  setSelectedAccountId: (id: string | null) => void;
  
  // Filters
  filter: LedgerFilter;
  setFilter: (filter: LedgerFilter | ((prev: LedgerFilter) => LedgerFilter)) => void;
  resetFilter: () => void;

  // Modals & Drawers
  isQuickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isAccountModalOpen: boolean;
  setAccountModalOpen: (open: boolean) => void;
  isCategoryModalOpen: boolean;
  setCategoryModalOpen: (open: boolean) => void;
  isFilterModalOpen: boolean;
  setFilterModalOpen: (open: boolean) => void;

  // Active Entities for Edit
  editingTransaction: Transaction | null;
  setEditingTransaction: (tx: Transaction | null) => void;
  editingAccount: Account | null;
  setEditingAccount: (acc: Account | null) => void;

  // User Profile & Authentication
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authMode: 'signin' | 'signup' | 'profile';
  setAuthMode: (mode: 'signin' | 'signup' | 'profile') => void;

  // Admin Console Modal
  isAdminPanelOpen: boolean;
  setAdminPanelOpen: (open: boolean) => void;
}

const initialTheme = (localStorage.getItem('apex_theme') as 'dark' | 'light') || 'dark';
const initialLang = (localStorage.getItem('apex_lang') as Language) || 'en';

export function syncThemeColor(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const color = theme === 'dark' ? '#000000' : '#FAFAFA';

  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length > 0) {
    metas.forEach((meta) => meta.setAttribute('content', color));
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', 'black-translucent');
  }
}

if (typeof document !== 'undefined') {
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  document.documentElement.lang = initialLang;
  syncThemeColor(initialTheme);
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'ledger',
  setActiveTab: (activeTab) => set({ activeTab }),

  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem('apex_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    syncThemeColor(theme);
    set({ theme });
  },
  
  language: initialLang,
  setLanguage: (language) => {
    localStorage.setItem('apex_lang', language);
    document.documentElement.lang = language;
    set({ language });
  },

  isPrivacyMode: false,
  togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),

  isAppLocked: false,
  setIsAppLocked: (isAppLocked) => set({ isAppLocked }),
  pinCode: '1234',
  setPinCode: (pinCode) => set({ pinCode }),

  selectedAccountId: null,
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),

  filter: {},
  setFilter: (updater) =>
    set((state) => ({
      filter: typeof updater === 'function' ? updater(state.filter) : updater,
    })),
  resetFilter: () => set({ filter: {} }),

  isQuickAddOpen: false,
  setQuickAddOpen: (isQuickAddOpen) => set({ isQuickAddOpen }),
  
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),

  isAccountModalOpen: false,
  setAccountModalOpen: (isAccountModalOpen) => set({ isAccountModalOpen }),

  isCategoryModalOpen: false,
  setCategoryModalOpen: (isCategoryModalOpen) => set({ isCategoryModalOpen }),

  isFilterModalOpen: false,
  setFilterModalOpen: (isFilterModalOpen) => set({ isFilterModalOpen }),

  editingTransaction: null,
  setEditingTransaction: (editingTransaction) => set({ editingTransaction }),

  editingAccount: null,
  setEditingAccount: (editingAccount) => set({ editingAccount }),

  userProfile: null,
  setUserProfile: (userProfile) => set({ userProfile }),
  isAuthModalOpen: false,
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
  authMode: 'signin',
  setAuthMode: (authMode) => set({ authMode }),

  isAdminPanelOpen: false,
  setAdminPanelOpen: (isAdminPanelOpen) => set({ isAdminPanelOpen }),
}));
