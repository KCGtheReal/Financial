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
  Trash2,
  ShieldCheck,
  ChevronRight,
  Cloud,
  Download,
  Upload
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { isCloudSyncConfigured } from '../../db/supabase';
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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');

  const handleExportBackup = async () => {
    try {
      const jsonString = await LedgerRepository.exportAllData();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage(language === 'km' ? 'បានទាញយកទិន្នន័យបម្រុងទុកដោយជោគជ័យ!' : 'Backup file downloaded! Send it to your other phone to import.');
      setTimeout(() => setBackupMessage(''), 5000);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await LedgerRepository.importAllData(text);
      const current = await LedgerRepository.getUserProfile();
      if (current) useAppStore.getState().setUserProfile(current);
      setBackupMessage(
        language === 'km' 
          ? `បានបញ្ចូលទិន្នន័យជោគជ័យ! (${res.accountsCount} គណនី, ${res.txCount} ប្រតិបត្តិការ)` 
          : `Restored successfully! Imported ${res.accountsCount} accounts and ${res.txCount} transactions.`
      );
      setTimeout(() => {
        setBackupMessage('');
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    }
  };

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

  const handleClearLedgerData = async () => {
    if (confirm('Are you sure you want to clear all your transactions and accounts? This cannot be undone.')) {
      await db.transactions.clear();
      await db.accounts.clear();
      await db.savedFilters.clear();
      setResetMessage('All transactions and accounts cleared successfully.');
      setTimeout(() => setResetMessage(''), 3000);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-nav-safe space-y-4 animate-fade-in">
      {/* Real User Account & Identity Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0 font-bold text-sm"
            style={{ backgroundColor: userProfile?.avatarColor || '#09090B' }}
          >
            {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User size={20} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                {userProfile?.name || 'Guest'}
              </h2>
              {userProfile?.isLoggedIn && (
                <BadgeCheck size={14} className="text-zinc-900 dark:text-white flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {userProfile?.email || 'Not signed in'}
            </p>
            <span className="text-xs text-zinc-400 font-mono block mt-0.5">
              {userProfile?.isLoggedIn ? t('realAccountBadge', language) : t('guestMode', language)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              setAuthMode(userProfile?.isLoggedIn ? 'profile' : 'signup');
              setAuthModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {userProfile?.isLoggedIn ? (
              <>
                <Edit3 size={13} />
                <span>{t('editProfile', language)}</span>
              </>
            ) : (
              <>
                <UserPlus size={13} />
                <span>{t('signUp', language)}</span>
              </>
            )}
          </button>

          {userProfile?.isLoggedIn && (
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/40 transition-colors shadow-sm"
              title={t('signOut', language)}
              aria-label={t('signOut', language)}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Admin Console Card */}
      <div className="space-y-2">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 font-bold">
          {t('adminConsole', language)}
        </span>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {t('adminConsole', language)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                  {userProfile?.role === 'admin' ? t('roleAdmin', language) : 'Console'}
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                {t('adminConsoleDesc', language)}
              </span>
            </div>
          </div>

          <button
            onClick={() => setAdminPanelOpen(true)}
            className="text-xs px-3.5 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
          >
            <span>{t('openAdminPanel', language)}</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {resetMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium text-center animate-fade-in">
          {resetMessage}
        </div>
      )}

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

      {/* Data Management & Sync Section */}
      <div className="space-y-2">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 font-bold">
          {language === 'km' ? 'ទិន្នន័យ និង ការធ្វើសមកាលកម្ម' : 'Data & Cloud Sync'}
        </span>

        {backupMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300 animate-fade-in flex items-center gap-2">
            <Check size={14} className="flex-shrink-0" />
            <span>{backupMessage}</span>
          </div>
        )}

        <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {/* Cloud Sync Status */}
          <div 
            onClick={() => setIsSyncModalOpen(true)}
            className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCloudSyncConfigured 
                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                <Cloud size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                    {language === 'km' ? 'សមកាលកម្ម Cloud Sync' : 'Multi-Device Cloud Sync'}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    isCloudSyncConfigured
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {isCloudSyncConfigured ? 'Active' : 'Setup Guide'}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isCloudSyncConfigured 
                    ? (language === 'km' ? 'បានភ្ជាប់ Supabase • ចូលប្រើបានគ្រប់ទូរស័ព្ទ' : 'Connected to Supabase • Syncs across phones')
                    : (language === 'km' ? 'ទិន្នន័យលើម៉ាស៊ីននេះ • ចុចដើម្បីមើលវិធីភ្ជាប់ទូរស័ព្ទច្រើន' : 'Tap to see how to enable login across phones')}
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-zinc-400 flex-shrink-0" />
          </div>

          {/* Export Data Backup */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <Download size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {language === 'km' ? 'ទាញយកទិន្នន័យបម្រុងទុក' : 'Export Data Backup'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {language === 'km' ? 'រក្សាទុកទិន្នន័យជាឯកសារ JSON' : 'Save full account & ledger to portable JSON'}
                </span>
              </div>
            </div>
            <button
              onClick={handleExportBackup}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              {language === 'km' ? 'ទាញយក' : 'Export'}
            </button>
          </div>

          {/* Import Data Backup */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <Upload size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {language === 'km' ? 'បញ្ចូលទិន្នន័យពីឯកសារ' : 'Import / Restore Backup'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {language === 'km' ? 'ផ្ទេរទិន្នន័យពីទូរស័ព្ទមួយទៅមួយទៀតភ្លាមៗ' : 'Beam data from one phone to another instantly'}
                </span>
              </div>
            </div>
            <label className="text-xs px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer">
              {language === 'km' ? 'ជ្រើសរើស' : 'Import'}
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportBackup} 
                className="hidden" 
              />
            </label>
          </div>

          {/* Clear Personal Ledger Data */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                <Trash2 size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                  {t('clearLedgerData', language)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('clearLedgerDesc', language)}
                </span>
              </div>
            </div>
            <button
              onClick={handleClearLedgerData}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-semibold transition-colors border border-rose-200 dark:border-rose-900/40"
            >
              {t('clearBtn', language)}
            </button>
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

      {/* Multi-Device Cloud Sync Guide Modal */}
      <Modal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title={language === 'km' ? 'សមកាលកម្មទូរស័ព្ទច្រើន (Multi-Device Sync)' : 'Multi-Device Cloud Sync'}
        subtitle={
          language === 'km'
            ? 'ភ្ជាប់ Supabase ដោយឥតគិតថ្លៃដើម្បីចូលប្រើបានគ្រប់ទូរស័ព្ទ'
            : 'Connect free Supabase cloud database to log into your account on all your phones'
        }
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs select-none">
          {/* Status Banner */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            isCloudSyncConfigured 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <Cloud size={18} className={isCloudSyncConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'} />
              <div>
                <span className="font-bold block text-xs">
                  {isCloudSyncConfigured ? 'Cloud Sync is Active' : 'Currently in Local Device Mode'}
                </span>
                <span className="text-[11px] opacity-80">
                  {isCloudSyncConfigured 
                    ? 'Your accounts and cards sync across all your phones in real time.'
                    : 'Accounts are stored only on this specific phone.'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Instant Solution: File Transfer */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 space-y-2">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Download size={14} />
              Instant Transfer Right Now (No Setup Needed):
            </span>
            <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              1. Tap <strong>"Export Data Backup"</strong> on Phone 1 to download your <code>.json</code> file.<br />
              2. Send that file (via Telegram, WhatsApp, or AirDrop) to Phone 2.<br />
              3. Open Phone 2 and tap <strong>"Import / Restore Backup"</strong>. Your entire account, PIN, and cards will load immediately!
            </p>
          </div>

          {/* Permanent Solution: Connect Supabase */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Cloud size={14} />
              Permanent Multi-Phone Login (Free Supabase Cloud):
            </span>
            <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              <li>Create a free account at <strong>supabase.com</strong>.</li>
              <li>In Supabase, open the <strong>SQL Editor</strong>, paste the content of <code>supabase/schema.sql</code>, and click <strong>Run</strong>.</li>
              <li>Go to your <strong>Vercel Project Settings → Environment Variables</strong> and add:
                <div className="mt-1 p-2 rounded-xl bg-black text-zinc-200 font-mono text-[10px] space-y-1">
                  <div>VITE_SUPABASE_URL = your-supabase-url</div>
                  <div>VITE_SUPABASE_ANON_KEY = your-anon-key</div>
                </div>
              </li>
              <li>Click <strong>Redeploy</strong> on Vercel. Done! Both phones will sync automatically.</li>
            </ol>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsSyncModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs"
            >
              {language === 'km' ? 'យល់ព្រម' : 'Got It'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
