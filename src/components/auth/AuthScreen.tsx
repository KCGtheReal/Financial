import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LedgerRepository } from '../../db/repository';
import { UserProfile } from '@contracts/api';
import { t } from '../../i18n';
import { AppLogo } from '../common/AppLogo';
import { 
  Sun, 
  Moon, 
  Languages, 
  Check, 
  Eye, 
  EyeOff 
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { 
    theme, 
    setTheme, 
    language, 
    setLanguage, 
    setUserProfile, 
    setPinCode 
  } = useAppStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [switchDirection, setSwitchDirection] = useState<'forward' | 'backward'>('forward');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchToSignUp = () => {
    setSwitchDirection('forward');
    setMode('signup');
    setErrorMessage('');
  };

  const switchToSignIn = () => {
    setSwitchDirection('backward');
    setMode('signin');
    setErrorMessage('');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage(language === 'km' ? 'សូមបញ្ចូលឈ្មោះពេញ' : 'Full Name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage(language === 'km' ? 'សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ' : 'Please enter a valid email address');
      return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMessage(language === 'km' ? 'លេខកូដសម្ងាត់ត្រូវមាន ៤ ខ្ទង់' : 'Security PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);

    const newProfile: UserProfile = {
      id: 'usr-' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      pinCode: pin,
      avatar: 'User',
      avatarColor: '#09090B',
      currency: 'USD',
      isLoggedIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await LedgerRepository.saveUserProfile(newProfile);
      setUserProfile(newProfile);
      setPinCode(pin);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage(language === 'km' ? 'សូមបញ្ចូលអ៊ីមែលរបស់អ្នក' : 'Please enter your email address');
      return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMessage(language === 'km' ? 'លេខកូដសម្ងាត់ត្រូវមាន ៤ ខ្ទង់' : 'PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await LedgerRepository.loginUser(email, pin);
      if (res.success && res.user) {
        setUserProfile(res.user);
        if (res.user.pinCode) setPinCode(res.user.pinCode);
      } else {
        setErrorMessage(res.error || (language === 'km' ? 'ការផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវ' : 'Invalid email or PIN'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Sign in error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between font-sans select-none antialiased relative overflow-hidden bg-[#FAFAFA] dark:bg-black transition-colors duration-500 overscroll-none">
      {/* Ambient Lighting Effects placed lower to never disrupt top status bar continuity */}
      <div className="absolute top-48 right-0 w-96 h-96 bg-zinc-300/[0.2] dark:bg-zinc-800/[0.15] rounded-full blur-3xl pointer-events-none transition-colors duration-500" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-zinc-200/[0.25] dark:bg-zinc-900/[0.2] rounded-full blur-3xl pointer-events-none transition-colors duration-500" />

      {/* Top Hero Container (Seamless Edge-to-Edge with Android / iOS Safe Area) */}
      <div className="w-full flex-shrink-0 pt-[max(calc(env(safe-area-inset-top,0px)+0.75rem),1.25rem)] pb-4 sm:pb-6 px-6 sm:px-12 md:px-16 lg:px-24 relative z-10 transition-colors duration-500">
        <div className="w-full max-w-xl mx-auto flex flex-col justify-between">
          {/* Top Header Bar */}
          <header className="flex items-center justify-between mb-4 sm:mb-8">
            <div className="flex items-center gap-3">
              <AppLogo size={36} />
              <span className="font-bold text-base tracking-tight text-zinc-950 dark:text-white font-sans transition-colors duration-300">
                ApexFinance
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === 'en' ? 'km' : 'en')}
                className="h-9 px-3 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-all hover:bg-white dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white cursor-pointer shadow-sm"
                aria-label="Toggle Language"
              >
                <Languages size={14} className="text-zinc-600 dark:text-zinc-400" />
                <span className="font-mono text-xs font-bold">
                  {language === 'en' ? 'EN' : 'ខ្មែរ'}
                </span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center transition-all hover:bg-white dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white cursor-pointer shadow-sm"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </header>

          {/* Display Headline with Smooth Directional Slide */}
          <div className="overflow-hidden py-1">
            <div
              key={`headline-${mode}`}
              className={switchDirection === 'forward' ? 'animate-auth-slide-forward' : 'animate-auth-slide-backward'}
            >
              {mode === 'signin' ? (
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-snug transition-colors duration-300">
                  <span>{language === 'km' ? 'សួស្តី' : 'Hello'}</span>
                  <br />
                  <span>{language === 'km' ? 'សូមចូលគណនី!' : 'Sign in!'}</span>
                </h1>
              ) : (
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-snug transition-colors duration-300">
                  <span>{language === 'km' ? 'បង្កើត' : 'Create Your'}</span>
                  <br />
                  <span>{language === 'km' ? 'គណនីថ្មី' : 'Account'}</span>
                </h1>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sheet Card Container (Full Width Edge-to-Edge with Inner Centering) */}
      <div className="w-full flex-1 flex flex-col relative z-10 min-h-0">
        <div className="w-full flex-1 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-[#18181b] dark:via-[#121214] dark:to-[#0a0a0c] rounded-t-[32px] sm:rounded-t-[44px] px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:px-12 md:px-16 lg:px-24 flex flex-col justify-between shadow-[0_-20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_-20px_50px_rgba(0,0,0,0.6)] border-t border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-500 overflow-y-auto">
          <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-between">
            <div>
              {/* Error Feedback */}
              {errorMessage && (
                <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold text-center animate-fade-in">
                  {errorMessage}
                </div>
              )}

              {/* Animated Form Container */}
              <div className="overflow-hidden">
                <div
                  key={`form-${mode}`}
                  className={`w-full ${
                    switchDirection === 'forward' ? 'animate-auth-slide-forward' : 'animate-auth-slide-backward'
                  }`}
                >
                  {mode === 'signin' ? (
                    /* ================= SIGN IN FORM ================= */
                    <form onSubmit={handleSignIn} className="space-y-5 sm:space-y-6">
                      {/* Email Field with Underline */}
                      <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pt-1 pb-2.5 focus-within:border-zinc-950 dark:focus-within:border-white transition-colors">
                        <label className="block text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                          {t('emailAddress', language)}
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="name@apex.finance"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                          />
                          {email.includes('@') && email.includes('.') && (
                            <Check size={16} className="text-zinc-900 dark:text-white flex-shrink-0 animate-scale-in" />
                          )}
                        </div>
                      </div>

                      {/* PIN Field with Underline & Show/Hide */}
                      <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pt-1 pb-2.5 focus-within:border-zinc-950 dark:focus-within:border-white transition-colors">
                        <label className="block text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                          {t('accountPin', language)} (4 Digits)
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            required
                            placeholder="••••"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            className="w-full bg-transparent text-sm font-mono tracking-widest font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-1.5 flex-shrink-0 transition-colors cursor-pointer"
                            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Pill CTA Button */}
                      <div className="pt-2 sm:pt-3">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          data-testid="auth-signin-submit"
                          className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>{t('signIn', language)}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* ================= SIGN UP FORM ================= */
                    <form onSubmit={handleCreateAccount} className="space-y-4 sm:space-y-5">
                      {/* Full Name */}
                      <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pt-1 pb-2.5 focus-within:border-zinc-950 dark:focus-within:border-white transition-colors">
                        <label className="block text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                          {t('fullName', language)}
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            required
                            autoComplete="name"
                            placeholder="e.g. Kong Chamroeun"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                          />
                          {name.trim().length > 1 && (
                            <Check size={16} className="text-zinc-900 dark:text-white flex-shrink-0 animate-scale-in" />
                          )}
                        </div>
                      </div>

                      {/* Email Address */}
                      <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pt-1 pb-2.5 focus-within:border-zinc-950 dark:focus-within:border-white transition-colors">
                        <label className="block text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                          {t('emailAddress', language)}
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="e.g. kong@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                          />
                          {email.includes('@') && email.includes('.') && (
                            <Check size={16} className="text-zinc-900 dark:text-white flex-shrink-0 animate-scale-in" />
                          )}
                        </div>
                      </div>

                      {/* PIN Code Field */}
                      <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pt-1 pb-2.5 focus-within:border-zinc-950 dark:focus-within:border-white transition-colors">
                        <label className="block text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                          {t('accountPin', language)} (4 Digits)
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            required
                            placeholder="••••"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            className="w-full bg-transparent text-sm font-mono tracking-widest font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-1.5 flex-shrink-0 transition-colors cursor-pointer"
                            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Pill CTA Button */}
                      <div className="pt-2 sm:pt-3">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          data-testid="auth-signup-submit"
                          className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>{t('signUp', language)}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Switch Footer with Animated Directional Slide */}
            <div className="overflow-hidden">
              <div
                key={`footer-${mode}`}
                className={`pt-3 pb-1 text-center text-xs text-zinc-500 dark:text-zinc-400 ${
                  switchDirection === 'forward' ? 'animate-auth-slide-forward' : 'animate-auth-slide-backward'
                }`}
              >
                {mode === 'signin' ? (
                  <p>
                    <span>{language === 'km' ? 'មិនទាន់មានគណនី? ' : "Don't have an account? "}</span>
                    <button
                      type="button"
                      data-testid="auth-tab-signup"
                      onClick={switchToSignUp}
                      className="font-bold text-zinc-950 dark:text-white hover:underline cursor-pointer ml-1.5 inline-block py-1 text-xs"
                    >
                      {t('signUp', language)}
                    </button>
                  </p>
                ) : (
                  <p>
                    <span>{language === 'km' ? 'មានគណនីរួចហើយ? ' : 'Already have an account? '}</span>
                    <button
                      type="button"
                      data-testid="auth-tab-signin"
                      onClick={switchToSignIn}
                      className="font-bold text-zinc-950 dark:text-white hover:underline cursor-pointer ml-1.5 inline-block py-1 text-xs"
                    >
                      {t('signIn', language)}
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
