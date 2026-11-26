import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { LedgerRepository } from '../../db/repository';
import { historyManager } from '../../utils/history';
import { generateId } from '../../utils/id';
import { UserProfile } from '@contracts/api';
import { t } from '../../i18n';
import { 
  User, 
  Mail, 
  KeyRound, 
  Sparkles, 
  ShieldCheck, 
  Crown, 
  Terminal, 
  Briefcase, 
  Zap, 
  Landmark, 
  LogOut, 
  Check, 
  UserPlus, 
  LogIn,
  BadgeCheck,
  LucideIcon
} from 'lucide-react';
import { CURRENCIES } from '../../utils/money';

const AVATAR_ICONS: { id: string; icon: LucideIcon }[] = [
  { id: 'User', icon: User },
  { id: 'Sparkles', icon: Sparkles },
  { id: 'ShieldCheck', icon: ShieldCheck },
  { id: 'Crown', icon: Crown },
  { id: 'Terminal', icon: Terminal },
  { id: 'Briefcase', icon: Briefcase },
  { id: 'Zap', icon: Zap },
  { id: 'Landmark', icon: Landmark },
];

const PRESET_ACCENTS = [
  '#09090B', // Pitch Black
  '#52525B', // Slate
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#DC2626', // Crimson
  '#0891B2', // Cyan
];

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    setAuthModalOpen, 
    authMode, 
    setAuthMode, 
    userProfile, 
    setUserProfile,
    setPinCode,
    language 
  } = useAppStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState('User');
  const [avatarColor, setAvatarColor] = useState('#09090B');
  const [currency, setCurrency] = useState('USD');
  const [bio, setBio] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const prevInitKeyRef = useRef<string | null>(null);

  // Sync form only when modal opens or authMode/target user changes (never clobber mid-typing)
  useEffect(() => {
    if (!isAuthModalOpen) {
      prevInitKeyRef.current = null;
      return;
    }

    const initKey = `${authMode}:${userProfile?.id || 'guest'}`;
    if (prevInitKeyRef.current === initKey) {
      return;
    }
    prevInitKeyRef.current = initKey;

    if (userProfile && authMode === 'profile') {
      setName(userProfile.name);
      setEmail(userProfile.email);
      setPin(userProfile.pinCode || '1234');
      setAvatar(userProfile.avatar || 'User');
      setAvatarColor(userProfile.avatarColor || '#09090B');
      setCurrency(userProfile.currency || 'USD');
      setBio(userProfile.bio || '');
    } else if (authMode === 'signup') {
      setName('');
      setEmail('');
      setPin('');
      setAvatar('Sparkles');
      setAvatarColor('#09090B');
      setCurrency('USD');
      setBio('');
    } else if (authMode === 'signin') {
      setEmail(userProfile?.email || '');
      setPin('');
    }
    setErrorMessage('');
    setSuccessMessage('');
  }, [userProfile, authMode, isAuthModalOpen]);

  const handleClose = useCallback(() => {
    setAuthModalOpen(false);
    setErrorMessage('');
    setSuccessMessage('');
  }, [setAuthModalOpen]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Full Name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMessage('Security PIN must be exactly 4 numeric digits');
      return;
    }

    const newProfile: UserProfile = {
      id: generateId('usr'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      pinCode: pin,
      avatar,
      avatarColor,
      currency,
      bio: bio.trim() || undefined,
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      const saved = await LedgerRepository.saveUserProfile(newProfile);
      setUserProfile(saved);
      setPinCode(pin);
      setSuccessMessage(t('accountCreatedSuccess', language));
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMessage('Enter your 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await LedgerRepository.loginUser(email, pin);
      if (res.success && res.user) {
        setUserProfile(res.user);
        if (res.user.pinCode) setPinCode(res.user.pinCode);
        setSuccessMessage(t('signInSuccess', language));
        setTimeout(() => {
          handleClose();
        }, 700);
      } else {
        setErrorMessage(res.error || 'Sign in failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || isSubmitting) return;
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Full Name is required');
      return;
    }

    const updatedProfile: UserProfile = {
      ...userProfile,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      avatar,
      avatarColor,
      currency,
      bio: bio.trim() || undefined,
      pinCode: pin.length === 4 ? pin : userProfile.pinCode,
      updatedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      const saved = await LedgerRepository.saveUserProfile(updatedProfile, { isEdit: true });
      setUserProfile(saved);
      if (pin.length === 4) setPinCode(pin);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    setIsSignOutConfirmOpen(true);
  };

  const executeSignOut = async () => {
    const loggedOut = await LedgerRepository.logoutUser();
    useLedgerStore.getState().clearSelection();
    historyManager.clear();
    useAppStore.getState().resetSessionState(loggedOut);
    setAuthMode('signin');
  };

  const SelectedIconComponent = AVATAR_ICONS.find((a) => a.id === avatar)?.icon || User;

  const modalTitle = 
    authMode === 'signup' 
      ? t('signUp', language)
      : authMode === 'signin'
      ? t('signIn', language)
      : t('userProfile', language);

  const modalSubtitle =
    authMode === 'signup'
      ? 'Set up your personal finance account with cloud sync'
      : authMode === 'signin'
      ? 'Access your private ledger and financial assets'
      : 'Manage identity, credentials, and ledger preferences';

  return (
    <>
    <Modal
      isOpen={isAuthModalOpen}
      onClose={handleClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Auth Mode Toggle Tabs (when not already viewing active profile) */}
        {authMode !== 'profile' && (
          <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage('');
              }}
              className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <UserPlus size={14} />
              <span>{t('signUp', language)}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage('');
              }}
              className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <LogIn size={14} />
              <span>{t('signIn', language)}</span>
            </button>
          </div>
        )}

        {/* Error and Success Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium animate-fade-in">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5 animate-fade-in">
            <Check size={14} /> {successMessage}
          </div>
        )}

        {/* SIGN UP FORM: CREATE REAL ACCOUNT */}
        {authMode === 'signup' && (
          <form onSubmit={handleCreateAccount} className="space-y-4 animate-fade-in">
            {/* Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('fullName', language)} *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kong Chamroeun"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                  />
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('emailAddress', language)} *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. kong@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                  />
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>
            </div>

            {/* PIN Code & Base Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('accountPin', language)} (4 Digits) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white font-mono tracking-widest outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-bold"
                  />
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Primary Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                >
                  {Object.values(CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium transition-colors"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="auth-submit-btn"
                className="px-5 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {t('signUp', language)}
              </button>
            </div>
          </form>
        )}

        {/* SIGN IN FORM */}
        {authMode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t('emailAddress', language)} *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="e.g. kong@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                />
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t('accountPin', language)} (4 Digits) *
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white font-mono tracking-widest outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-bold"
                />
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {t('signIn', language)}
              </button>
            </div>
          </form>
        )}

        {/* VIEW / EDIT PROFILE */}
        {authMode === 'profile' && userProfile && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Visual Identity Card */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                  style={{ backgroundColor: avatarColor }}
                >
                  <SelectedIconComponent size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                      {name || userProfile.name}
                    </span>
                    <BadgeCheck size={14} className="text-zinc-900 dark:text-white flex-shrink-0" />
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block truncate">
                    {email || userProfile.email}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                    {userProfile.isLoggedIn ? '● Active Session' : '○ Signed Out'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-800 text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Sign out of this device"
              >
                <LogOut size={13} />
                <span>{t('signOut', language)}</span>
              </button>
            </div>

            {/* Avatar Style Picker */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('avatarIcon', language)}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_ICONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = avatar === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAvatar(item.id)}
                      className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color Palette */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Avatar Accent
              </label>
              <div className="flex items-center gap-2">
                {PRESET_ACCENTS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAvatarColor(col)}
                    className={`w-7 h-7 rounded-xl transition-transform ${
                      avatarColor === col 
                        ? 'scale-110 ring-2 ring-zinc-950 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black' 
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('fullName', language)} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('emailAddress', language)} *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-medium"
                />
              </div>
            </div>

            {/* Bio / Tagline */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t('profileTagline', language)}
              </label>
              <input
                type="text"
                placeholder="e.g. Personal wealth & business ledger"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {t('save', language)}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>

    <ConfirmModal
      isOpen={isSignOutConfirmOpen && isAuthModalOpen}
      onClose={() => setIsSignOutConfirmOpen(false)}
      onConfirm={executeSignOut}
      title={t('signOut', language)}
      message={t('signOutConfirm', language)}
      confirmLabel={t('signOut', language)}
      tone="default"
      icon="logout"
    />
    </>
  );
};
