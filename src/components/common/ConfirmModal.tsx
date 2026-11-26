import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  icon?: 'alert' | 'logout';
  isLoading?: boolean;
}

const EXIT_ANIMATION_MS = 190;

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  icon = 'alert',
  isLoading = false,
}) => {
  const { language } = useAppStore();
  const [mounted, setMounted] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeTimerRef = useRef<number | null>(null);
  const busy = isLoading || internalLoading;

  const clearTimers = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      clearTimers();
      setMounted(true);
      setIsExiting(false);
    } else if (mounted) {
      setIsExiting(true);
      clearTimers();
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        setIsExiting(false);
        closeTimerRef.current = null;
      }, EXIT_ANIMATION_MS);
    }
  }, [isOpen, mounted, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const initiateClose = useCallback(() => {
    if (busy || isExiting) return;
    setIsExiting(true);
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setMounted(false);
      setIsExiting(false);
      onCloseRef.current();
    }, EXIT_ANIMATION_MS);
  }, [busy, isExiting, clearTimers]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        e.stopPropagation();
        initiateClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, busy, initiateClose]);

  if (!mounted) return null;

  const handleConfirmClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || isExiting) return;
    setInternalLoading(true);
    try {
      await onConfirm();
      initiateClose();
    } finally {
      setInternalLoading(false);
    }
  };

  const resolvedCancel = cancelLabel || t('cancel', language);
  const resolvedConfirm =
    confirmLabel ||
    (tone === 'danger'
      ? (language === 'km' ? 'លុប' : 'Delete')
      : (language === 'km' ? 'បញ្ជាក់' : 'Confirm'));

  const modalNode = (
    <div
      data-testid="confirm-modal"
      data-exiting={isExiting ? 'true' : 'false'}
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${isExiting ? 'pointer-events-none' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        initiateClose();
      }}
    >
      {/* Backdrop */}
      <div
        data-testid="confirm-modal-backdrop"
        className={`fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm ${
          isExiting ? 'backdrop-exit' : 'backdrop-enter'
        }`}
        aria-hidden="true"
      />

      {/* Centered Popup Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        data-testid="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 sm:p-6 space-y-5 select-none ${
          isExiting ? 'popup-exit' : 'popup-enter'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
              tone === 'danger'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/50'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {icon === 'logout' ? <LogOut size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-zinc-950 dark:text-white tracking-tight"
            >
              {title}
            </h3>
            <p
              id="confirm-modal-message"
              className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy || isExiting}
            data-testid="confirm-modal-cancel"
            onClick={(e) => {
              e.stopPropagation();
              initiateClose();
            }}
            className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            disabled={busy || isExiting}
            data-testid="confirm-modal-confirm"
            onClick={handleConfirmClick}
            className={`h-11 px-4 rounded-2xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950'
            }`}
          >
            {busy ? '...' : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
