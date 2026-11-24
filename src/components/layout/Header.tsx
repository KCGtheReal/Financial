import React, { useEffect, useState, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  MoreVertical,
  Lock,
  Languages,
  Undo2,
  Redo2,
  Command,
  User,
  ShieldCheck
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { historyManager } from '../../utils/history';
import { t } from '../../i18n';
import { AppLogo } from '../common/AppLogo';

export const Header: React.FC = () => {
  const {
    isPrivacyMode,
    togglePrivacyMode,
    setIsAppLocked,
    theme,
    setTheme,
    language,
    setLanguage,
    setCommandPaletteOpen,
    userProfile,
    setAuthModalOpen,
    setAuthMode,
    setAdminPanelOpen,
  } = useAppStore();

  const { incrementHistoryRevision } = useLedgerStore();
  const [, setTick] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Subscribe to history changes for undo/redo availability
  useEffect(() => {
    return historyManager.subscribe(() => {
      setTick((prev) => prev + 1);
    });
  }, []);

  // Close dropdown menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const canUndo = historyManager.canUndo();
  const canRedo = historyManager.canRedo();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 pt-[max(env(safe-area-inset-top),0.625rem)] pb-2.5 transition-colors duration-200">
      <div className="max-w-md sm:max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 select-none">
          <AppLogo size={32} />
          <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white font-sans">
            Apex
          </span>
        </div>

        {/* Streamlined Controls: Clean, Easy to Use */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 1. Privacy Blur Toggle */}
          <button
            onClick={togglePrivacyMode}
            title={t('privacyMode', language)}
            aria-label={t('privacyMode', language)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
              isPrivacyMode
                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {/* 2. Theme Toggle (Dark / Light) */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? t('switchLight', language) : t('switchDark', language)}
            aria-label="Toggle Theme"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-90"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* 3. Real User Account Button */}
          <button
            onClick={() => {
              setAuthMode(userProfile?.isLoggedIn ? 'profile' : 'signup');
              setAuthModalOpen(true);
            }}
            title={userProfile?.isLoggedIn ? `${t('userProfile', language)}: ${userProfile.name}` : t('signUp', language)}
            aria-label="User Account"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative"
          >
            {userProfile?.isLoggedIn ? (
              <div 
                className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: userProfile.avatarColor || '#09090B' }}
              >
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
            ) : (
              <User size={15} className="text-zinc-600 dark:text-zinc-400" />
            )}
          </button>

          {/* 4. More Options Menu (Subtle 3-dots dropdown) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="More Actions"
              aria-label="More Options"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
                isMenuOpen
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-white border-zinc-300 dark:border-zinc-700'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <MoreVertical size={16} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-1.5 z-50 animate-scale-in text-xs font-['Kantumruy_Pro']">
                {/* User Account / Profile Entry */}
                <button
                  onClick={() => {
                    setAuthMode(userProfile?.isLoggedIn ? 'profile' : 'signup');
                    setAuthModalOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <User size={15} className="text-zinc-400 flex-shrink-0" />
                    <span className="truncate font-semibold">{userProfile?.isLoggedIn ? userProfile.name : t('signUp', language)}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                    {userProfile?.isLoggedIn ? 'Active' : 'Guest'}
                  </span>
                </button>

                {/* Admin Console Entry */}
                <button
                  onClick={() => {
                    setAdminPanelOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck size={15} className="text-zinc-400 flex-shrink-0" />
                    <span className="truncate font-semibold">{t('adminConsole', language)}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                    {userProfile?.role === 'admin' ? 'Admin' : 'System'}
                  </span>
                </button>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                {/* Language Toggle */}
                <button
                  onClick={() => {
                    setLanguage(language === 'en' ? 'km' : 'en');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Languages size={15} className="text-zinc-400" />
                    <span>Language / ភាសា</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">
                    {language === 'en' ? 'EN' : 'ខ្មែរ'}
                  </span>
                </button>

                {/* Undo Action */}
                <button
                  disabled={!canUndo}
                  onClick={async () => {
                    await historyManager.undo();
                    incrementHistoryRevision();
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    canUndo
                      ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
                      : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Undo2 size={15} />
                    <span>{t('undo', language).split('(')[0].trim()}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">⌘Z</span>
                </button>

                {/* Redo Action */}
                <button
                  disabled={!canRedo}
                  onClick={async () => {
                    await historyManager.redo();
                    incrementHistoryRevision();
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    canRedo
                      ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
                      : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Redo2 size={15} />
                    <span>{t('redo', language).split('(')[0].trim()}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">⌘Y</span>
                </button>

                {/* Command Palette */}
                <button
                  onClick={() => {
                    setCommandPaletteOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Command size={15} className="text-zinc-400" />
                    <span>Commands</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">⌘K</span>
                </button>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                {/* Lock Terminal */}
                <button
                  onClick={() => {
                    setIsAppLocked(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <Lock size={15} className="text-zinc-400" />
                  <span>{t('lockNow', language)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
