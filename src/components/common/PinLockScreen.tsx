import React, { useState } from 'react';
import { Delete } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { AppLogo } from './AppLogo';

export const PinLockScreen: React.FC = () => {
  const { isAppLocked, setIsAppLocked, pinCode, language } = useAppStore();
  const [enteredPin, setEnteredPin] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleDigit = (digit: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      setHasError(false);

      if (nextPin.length === 4) {
        if (nextPin === pinCode) {
          setIsAppLocked(false);
          setEnteredPin('');
        } else {
          setHasError(true);
          setTimeout(() => {
            setEnteredPin('');
            setHasError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setHasError(false);
  };

  if (!isAppLocked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 dark:bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none pb-safe pt-safe animate-fade-in">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Brand Logo & Lock State */}
        <AppLogo size={48} className="mb-4" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Apex</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-8">
          {hasError ? t('pinMismatch', language) : t('unlockPrompt', language)}
        </p>

        {/* PIN Dots */}
        <div className="flex gap-4 mb-10">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < enteredPin.length;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? hasError
                      ? 'bg-rose-500 scale-125'
                      : 'bg-zinc-950 dark:bg-white scale-125 shadow-md'
                    : 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700'
                }`}
              />
            );
          })}
        </div>

        {/* Numeric Keypad: Clean B&W */}
        <div className="grid grid-cols-3 gap-3.5 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xl font-mono font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center shadow-sm"
          >
            <Delete size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
