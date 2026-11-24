import { registerSW } from 'virtual:pwa-register';

/**
 * Apex Finance PWA Instant-Update Controller
 * Ensures any pushed UI update or bugfix is immediately picked up by mobile devices
 * without requiring the user to uninstall or delete the app.
 */
export function initPWAUpdateService(): void {
  if (typeof window === 'undefined') return;

  // Prevent multiple reload loops
  let refreshing = false;

  if ('serviceWorker' in navigator) {
    // When a new Service Worker activates and claims clients, reload smoothly to load fresh bundle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // New version downloaded in background: activate immediately
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[Apex PWA] Application cached for sovereign offline use');
    },
    onRegistered(registration) {
      if (!registration) return;

      // 1. Immediately check for updates on startup
      registration.update().catch(() => {});

      // 2. Re-check whenever user returns to the app (mobile switch/unlock)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {});
        }
      });

      // 3. Periodic background check every 5 minutes while app is open
      setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      }, 5 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('[Apex PWA] Service worker registration error:', error);
    }
  });
}
