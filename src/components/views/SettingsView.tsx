import React, { useState } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  Languages, 
  Check, 
  KeyRound,
  User,
  BadgeCheck,
  Edit3,
  UserPlus,
  LogOut,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { LedgerRepository } from '../../db/repository';
import { t } from '../../i18n';
import { Modal } from '../common/Modal';
import { AppLogo } from '../common/AppLogo';

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    isPrivacyMode,
    togglePrivacyMode,
    setIsAppLocked,
    pinCode,
    setPinCode,
    userProfile,
    setAuthModalOpen,
    setAuthMode,
    setAdminPanelOpen,
  } = useAppStore();

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length === 4 && /^\d+$/.test(newPin)) {
      setPinCode(newPin);
      setPinSuccess(true);
      setTimeout(() => {
        setPinSuccess(false);
        setIsPinModalOpen(false);
        setNewPin('');
      }, 1000);
    }
  };

  const handleSignOut = async () => {
    if (confirm(t('signOutConfirm', language))) {
      const loggedOut = await LedgerRepository.logoutUser();
      useAppStore.getState().setUserProfile(loggedOut);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-nav-safe space-y-4">
      {/* Real User Account & Identity Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm space-y-3.5 select-none">
        <div className="flex items-center gap-3.5">
          <div 
            className="w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0 font-bold text-xl border border-white/10 ring-1 ring-black/5 dark:ring-white/10"
            style={{ backgroundColor: userProfile?.avatarColor || '#09090B' }}
          >
            {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white tracking-tight truncate">
                {userProfile?.name || 'Guest'}
              </h2>
              {userProfile?.isLoggedIn && (
                <BadgeCheck size={17} className="text-zinc-950 dark:text-white flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-sans">
              {userProfile?.email || 'Not signed in'}
            </p>
            <div className="mt-1.5">
              <span className="inline-flex items-center text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200/80 dark:border-zinc-700/80">
                {userProfile?.isLoggedIn ? t('realAccountBadge', language) : t('guestMode', language)}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => {
              setAuthMode(userProfile?.isLoggedIn ? 'profile' : 'signup');
              setAuthModalOpen(true);
            }}
            className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/90 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
          >
            {userProfile?.isLoggedIn ? (
              <>
                <Edit3 size={14} className="text-zinc-500 dark:text-zinc-400" />
                <span>{t('editProfile', language)}</span>
              </>
            ) : (
              <>
                <UserPlus size={14} />
                <span>{t('signUp', language)}</span>
              </>
            )}
          </button>

          {userProfile?.isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="py-2.5 px-3 rounded-xl bg-zinc-50 hover:bg-rose-50 dark:bg-zinc-900/60 dark:hover:bg-rose-950/30 text-zinc-700 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 border border-zinc-200/80 hover:border-rose-200 dark:border-zinc-800 dark:hover:border-rose-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
              title={t('signOut', language)}
              aria-label={t('signOut', language)}
            >
              <LogOut size={14} />
              <span>{t('signOut', language)}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthMode('signin');
                setAuthModalOpen(true);
              }}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
            >
              <span>{t('signIn', language)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Console Card */}
      <div className="space-y-2">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 font-bold">
          {t('adminConsole', language)}
        </span>

        <div
          onClick={() => setAdminPanelOpen(true)}
          className="p-4 rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  {t('adminConsole', language)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  {userProfile?.role === 'admin' ? t('roleAdmin', language) : 'Console'}
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5 truncate">
                {t('adminConsoleDesc', language)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors flex-shrink-0 pr-1">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>

      {/* Security & Privacy Section */}
      <div className="space-y-2">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 font-bold">
          {t('securityPrivacy', language)}
        </span>

        <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-sm">
          {/* Privacy Blur Toggle */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                {isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {t('privacyMode', language)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('privacyBlurDesc', language)}
                </span>
              </div>
            </div>
            <button
              onClick={togglePrivacyMode}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                isPrivacyMode ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full shadow-md transition-transform ${
                  isPrivacyMode 
                    ? 'translate-x-6 bg-white dark:bg-zinc-950' 
                    : 'translate-x-0 bg-white dark:bg-zinc-300'
                }`}
              />
            </button>
          </div>

          {/* Change PIN Code */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <KeyRound size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {t('appPinLock', language)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {t('currentPin', language)}: {pinCode}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold transition-colors"
            >
              {t('changePin', language)}
            </button>
          </div>

          {/* Instant Lock */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <Lock size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {t('lockNow', language)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('lockTerminalDesc', language)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsAppLocked(true)}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              {t('lockTerminalBtn', language)}
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-2">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 font-bold">
          {t('preferences', language)}
        </span>

        <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-sm">
          {/* Language Switch */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <Languages size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block font-['Kantumruy_Pro']">
                  {language === 'km' ? 'ភាសា' : 'Language'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-['Kantumruy_Pro']">
                  {language === 'en' ? 'English' : 'ភាសាខ្មែរ'}
                </span>
              </div>
            </div>
            <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors ${
                  language === 'en' ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('km')}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors font-['Kantumruy_Pro'] ${
                  language === 'km' ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                ខ្មែរ
              </button>
            </div>
          </div>

          {/* Theme Switch (Dark / Light) */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {t('themeAppearance', language)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                  {theme === 'dark' ? t('darkMode', language) : t('lightMode', language)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold transition-all active:scale-95 shadow-sm"
            >
              {theme === 'dark' ? t('switchLight', language) : t('switchDark', language)}
            </button>
          </div>
        </div>
      </div>

      {/* Brand & App Info Card */}
      <div className="pt-4 pb-2 flex flex-col items-center justify-center text-center select-none">
        <AppLogo size={36} className="mb-2" />
        <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">
          Apex Finance
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          Version 1.0.0 • Local-First Sovereign Wealth PWA
        </span>
      </div>

      {/* Change PIN Modal */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title={t('changePinTitle', language)}
        subtitle={t('changePinDesc', language)}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdatePin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('enterNewPin', language)}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center font-mono text-2xl tracking-widest text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          {pinSuccess && (
            <div className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
              <Check size={14} /> {t('pinUpdated', language)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPinModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold"
            >
              {t('save', language)}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
