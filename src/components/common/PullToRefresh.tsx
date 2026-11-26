import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';

export type PullRefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  isDisabled?: boolean;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 56;
const MAX_PULL = 84;
const DAMPING = 0.48;
const MIN_REFRESH_MS = 380;

function hasScrolledAncestor(target: EventTarget | null, boundary: HTMLElement): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    if (node.dataset.noPull !== undefined) return true;
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollTop > 1 &&
      node.scrollHeight > node.clientHeight + 2
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function isAtPageTop(): boolean {
  const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0;
  return scrollY <= 1;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  isDisabled = false,
  children,
}) => {
  const { language } = useAppStore();
  const [status, setStatus] = useState<PullRefreshState>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const isDisabledRef = useRef(isDisabled);
  isDisabledRef.current = isDisabled;
  const statusRef = useRef<PullRefreshState>('idle');

  const setPullVisual = (heightPx: number, animate: boolean) => {
    const el = indicatorRef.current;
    if (!el) return;
    el.style.transition = animate
      ? 'height 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease'
      : 'none';
    el.style.height = `${heightPx}px`;
    el.style.opacity = heightPx > 4 ? String(Math.min(heightPx / 36, 1)) : '0';

    if (arrowRef.current) {
      const reached = heightPx >= PULL_THRESHOLD;
      arrowRef.current.style.transform = reached ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  };

  useEffect(() => {
    if (isDisabled && statusRef.current !== 'refreshing') {
      statusRef.current = 'idle';
      setStatus('idle');
      setPullVisual(0, true);
    }
  }, [isDisabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let tracking = false;
    let activePull = false;
    let startX = 0;
    let startY = 0;
    let currentPull = 0;

    const resetPull = (animate = true) => {
      tracking = false;
      activePull = false;
      currentPull = 0;
      if (statusRef.current !== 'refreshing') {
        statusRef.current = 'idle';
        setStatus('idle');
        setPullVisual(0, animate);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (
        isDisabledRef.current ||
        statusRef.current === 'refreshing' ||
        e.touches.length !== 1 ||
        document.body.style.overflow === 'hidden' ||
        !isAtPageTop()
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') {
        return;
      }
      if (hasScrolledAncestor(target, container)) {
        return;
      }

      tracking = true;
      activePull = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentPull = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || isDisabledRef.current || statusRef.current === 'refreshing') return;
      if (e.touches.length !== 1) {
        resetPull(true);
        return;
      }

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!activePull) {
        // Horizontal swipe (e.g. account pills or filter chips) or upward scroll -> hand back to browser
        if (Math.abs(dx) > 8 && Math.abs(dx) >= Math.abs(dy) * 1.1) {
          tracking = false;
          return;
        }
        if (dy < -4 || !isAtPageTop()) {
          tracking = false;
          return;
        }
        if (dy <= 8) return;
        if (dy <= Math.abs(dx) * 1.35) return;

        activePull = true;
      }

      if (dy <= 0) {
        currentPull = 0;
        if (statusRef.current !== 'idle') {
          statusRef.current = 'idle';
          setStatus('idle');
        }
        setPullVisual(0, false);
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      currentPull = Math.min(dy * DAMPING, MAX_PULL);
      const nextState: PullRefreshState = currentPull >= PULL_THRESHOLD ? 'ready' : 'pulling';
      if (statusRef.current !== nextState) {
        statusRef.current = nextState;
        setStatus(nextState);
        if (nextState === 'ready' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(10);
          } catch {
            // Ignore unsupported vibration calls
          }
        }
      }
      setPullVisual(currentPull, false);
    };

    const handleTouchEnd = async () => {
      if (!tracking) return;
      tracking = false;

      if (!activePull || currentPull < PULL_THRESHOLD || isDisabledRef.current) {
        activePull = false;
        currentPull = 0;
        statusRef.current = 'idle';
        setStatus('idle');
        setPullVisual(0, true);
        return;
      }

      activePull = false;
      currentPull = 0;
      statusRef.current = 'refreshing';
      setStatus('refreshing');
      setPullVisual(48, true);

      const startedAt = Date.now();
      try {
        await onRefreshRef.current();
      } catch {
        // Sync errors are surfaced softly by sync state
      } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_REFRESH_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_MS - elapsed));
        }
        statusRef.current = 'idle';
        setStatus('idle');
        setPullVisual(0, true);
      }
    };

    const handleTouchCancel = () => resetPull(true);

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  const label =
    status === 'refreshing'
      ? t('refreshingData', language)
      : status === 'ready'
      ? t('releaseToRefresh', language)
      : t('pullToRefresh', language);

  return (
    <div ref={containerRef} data-testid="pull-to-refresh" data-pull-state={status} className="flex flex-col flex-1">
      {/* Pull Indicator safely below sticky header so iOS status bar & notch never shift */}
      <div
        ref={indicatorRef}
        data-testid="pull-to-refresh-indicator"
        aria-live="polite"
        className="h-0 opacity-0 w-full overflow-hidden flex items-center justify-center bg-[#FAFAFA] dark:bg-[#09090B] select-none pointer-events-none"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-sm text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {status === 'refreshing' ? (
            <RefreshCw size={13} className="animate-spin text-zinc-900 dark:text-white" />
          ) : (
            <div ref={arrowRef} className="transition-transform duration-150">
              <ArrowDown size={13} className="text-zinc-900 dark:text-white" />
            </div>
          )}
          <span>{label}</span>
        </div>
      </div>

      {children}
    </div>
  );
};
