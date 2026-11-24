import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className = '',
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsOpenRef = useRef(false);

  // Store onClose in ref to make initiateClose 100% reference-stable
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Initiate graceful animated close (stable reference, never triggers effect re-runs)
  const initiateClose = useCallback((fromExternalProp = false) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsExiting(true);

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }

    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      setIsExiting(false);
      setHasEntered(false);
      dragYRef.current = 0;
      isClosingRef.current = false;
      closeTimerRef.current = null;
      if (!fromExternalProp) {
        onCloseRef.current();
      }
    }, 240);
  }, []);

  // Handle external isOpen transitions ONLY (never reset hasEntered when already open)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      // Transition from closed to open
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      isClosingRef.current = false;
      setIsExiting(false);
      setHasEntered(false);
      dragYRef.current = 0;
      isDraggingRef.current = false;
      setMounted(true);

      // Fallback timer: ensure sheet transition locks into entered state even without animationend
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      enterTimerRef.current = setTimeout(() => {
        setHasEntered(true);
      }, 280);
    } else if (!isOpen && wasOpen) {
      // Transition from open to closed (prop flipped to false externally)
      if (!isClosingRef.current) {
        initiateClose(true);
      }
    }
  }, [isOpen, initiateClose]);

  // Lock body scroll and listen for Escape key while mounted and open
  useEffect(() => {
    if (!mounted || isExiting) return;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') initiateClose(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, isExiting, initiateClose]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    };
  }, []);

  // Touch and Mouse Drag Gestures with Direct GPU Manipulation (Zero React Re-renders during drag)
  const handleStart = (clientY: number) => {
    if (isClosingRef.current || isExiting) return;
    isDraggingRef.current = true;
    startYRef.current = clientY;
    dragYRef.current = 0;

    // Immediately ensure entered state is locked and cancel any pending enter timer
    setHasEntered(true);
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.willChange = 'transform';
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'none';
    }
  };

  const handleMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaY = clientY - startYRef.current;

    // 1:1 downward tracking, 0.2x upward resistance
    const currentDragY = deltaY > 0 ? deltaY : deltaY * 0.2;
    dragYRef.current = currentDragY;

    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${Math.max(0, currentDragY)}px)`;
    }
    if (backdropRef.current && currentDragY > 0) {
      const opacity = Math.max(0.15, 1 - currentDragY / 400);
      backdropRef.current.style.opacity = `${opacity}`;
    }
  }, []);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const finalDragY = dragYRef.current;

    if (finalDragY > 80) {
      // Dismiss: Animate smoothly to 100% off screen
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1)';
        sheetRef.current.style.transform = 'translateY(100%)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.22s ease-in';
        backdropRef.current.style.opacity = '0';
      }
      initiateClose(false);
    } else {
      // Snap back smoothly to rest position
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.22s ease-out';
        backdropRef.current.style.opacity = '1';
      }
      dragYRef.current = 0;

      // Clean up inline styles after snap transition finishes so CSS classes take back control
      setTimeout(() => {
        if (sheetRef.current && !isDraggingRef.current && !isClosingRef.current) {
          sheetRef.current.style.transition = '';
          sheetRef.current.style.transform = '';
          sheetRef.current.style.willChange = '';
        }
      }, 250);
    }
  }, [initiateClose]);

  // Window listeners active only during drag
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        handleMove(e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleMove(e.clientY);
      }
    };
    const onMouseUp = () => handleEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleMove, handleEnd]);

  if (!mounted) return null;

  const maxWidthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  }[maxWidth];

  // Dynamic animation class: enter -> rest -> exit
  const animationClass = isExiting
    ? 'sheet-exit'
    : !hasEntered
    ? 'sheet-enter'
    : '';

  const modalNode = (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end items-center overflow-hidden"
      data-testid="modal-container"
    >
      {/* Backdrop: Fades in on open, fades out on close */}
      <div
        ref={backdropRef}
        data-testid="modal-backdrop"
        className={cn(
          'fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm cursor-pointer',
          isExiting ? 'backdrop-exit' : 'backdrop-enter'
        )}
        onClick={() => initiateClose(false)}
        aria-hidden="true"
      />

      {/* Bottom Sheet Container: Full Screen Width on Mobile (w-full), Centered with Max Width on Desktop */}
      <div
        ref={sheetRef}
        data-testid="bottom-sheet"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && e.animationName === 'sheetSlideUp') {
            setHasEntered(true);
            if (enterTimerRef.current) {
              clearTimeout(enterTimerRef.current);
              enterTimerRef.current = null;
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full bg-white dark:bg-[#121214] border-t border-zinc-200 dark:border-zinc-800 sm:border-x shadow-2xl text-zinc-900 dark:text-zinc-100 z-10 flex flex-col',
          'rounded-t-[28px] max-h-[92vh]',
          'pb-safe sm:pb-6',
          maxWidthClasses,
          animationClass,
          className
        )}
      >
        {/* Interactive Grab Handle (Touch & Mouse Drag Down to Dismiss) */}
        <div
          data-testid="bottom-sheet-grab-handle"
          onTouchStart={(e) => handleStart(e.touches[0].clientY)}
          onMouseDown={(e) => handleStart(e.clientY)}
          className="w-full pt-3 pb-2.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none group"
          title="Drag down to close"
        >
          <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600 transition-colors" />
        </div>

        {/* Modal Header */}
        <div
          onTouchStart={(e) => handleStart(e.touches[0].clientY)}
          onMouseDown={(e) => handleStart(e.clientY)}
          className="flex items-center justify-between px-5 pt-1 sm:pt-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex-shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="pr-4 min-w-0">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            data-testid="modal-close-button"
            onClick={() => initiateClose(false)}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="overflow-y-auto px-5 py-4 overscroll-contain flex-1">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
