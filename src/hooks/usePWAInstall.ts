import { useCallback, useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

declare global {
  interface Window {
    __rachaInstallPrompt?: BeforeInstallPromptEvent | null;
    __rachaAppInstalled?: boolean;
  }
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  installRequestedFromQuery: boolean;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectInstallQuery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('install') === '1';
  } catch {
    return false;
  }
}

let snapshot: PWAInstallSnapshot = {
  deferredPrompt:
    typeof window !== 'undefined' ? window.__rachaInstallPrompt ?? null : null,
  isInstalled:
    typeof window !== 'undefined'
      ? Boolean(window.__rachaAppInstalled) || detectStandalone()
      : false,
  installRequestedFromQuery: detectInstallQuery(),
};

const listeners = new Set<() => void>();
let initialized = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(partial: Partial<PWAInstallSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  emitChange();
}

function ensureListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (window.__rachaInstallPrompt && !snapshot.deferredPrompt) {
    snapshot = {
      ...snapshot,
      deferredPrompt: window.__rachaInstallPrompt,
    };
  }
  if (window.__rachaAppInstalled && !snapshot.isInstalled) {
    snapshot = {
      ...snapshot,
      isInstalled: true,
      deferredPrompt: null,
    };
  }

  const syncFromWindowPrompt = () => {
    const promptEvent = window.__rachaInstallPrompt ?? null;
    if (promptEvent) {
      setSnapshot({ deferredPrompt: promptEvent });
    }
  };

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    const promptEvent = e as BeforeInstallPromptEvent;
    window.__rachaInstallPrompt = promptEvent;
    setSnapshot({ deferredPrompt: promptEvent });
  };

  const handleAppInstalled = () => {
    window.__rachaInstallPrompt = null;
    window.__rachaAppInstalled = true;
    clearInstallQueryParam();
    setSnapshot({
      deferredPrompt: null,
      isInstalled: true,
      installRequestedFromQuery: false,
    });
  };

  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  const handleDisplayModeChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      handleAppInstalled();
    }
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('racha-pwa-prompt-ready', syncFromWindowPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('racha-pwa-installed', handleAppInstalled);
  mediaQuery.addEventListener('change', handleDisplayModeChange);
}

function subscribe(listener: () => void) {
  ensureListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PWAInstallSnapshot {
  ensureListeners();
  return snapshot;
}

export function clearInstallQueryParam() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('install')) {
      url.searchParams.delete('install');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // Ignore history API restrictions
  }
  if (snapshot.installRequestedFromQuery) {
    setSnapshot({ installRequestedFromQuery: false });
  }
}

export function buildDirectInstallUrl(): string {
  if (typeof window === 'undefined') return '/?install=1';
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('install', '1');
    return url.toString();
  } catch {
    return '/?install=1';
  }
}

function detectEnvironment() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isInIframe: false,
      isPWACompatible: false,
      supportsNativePrompt: false,
    };
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const isChromium = /Chrome|Chromium|Edg|OPR|Brave|SamsungBrowser/i.test(ua);
  const supportsNativePrompt =
    'onbeforeinstallprompt' in window || (isChromium && !isIOS);
  const isSafariIOS = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);

  const isPWACompatible =
    hasServiceWorker && (supportsNativePrompt || isSafariIOS || isAndroid || isIOS);

  return {
    isIOS,
    isAndroid,
    isInIframe,
    isPWACompatible,
    supportsNativePrompt,
  };
}

const ENV = detectEnvironment();

async function waitForDeferredPrompt(
  timeoutMs: number
): Promise<BeforeInstallPromptEvent | null> {
  const existing = snapshot.deferredPrompt ?? window.__rachaInstallPrompt ?? null;
  if (existing) return existing;
  if (typeof window === 'undefined' || ENV.isInIframe || ENV.isIOS) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ev: BeforeInstallPromptEvent | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('racha-pwa-prompt-ready', onPrompt);
      resolve(ev);
    };

    const onPrompt = () => {
      const captured = window.__rachaInstallPrompt ?? snapshot.deferredPrompt ?? null;
      if (captured) finish(captured);
    };

    const timer = window.setTimeout(() => {
      finish(window.__rachaInstallPrompt ?? snapshot.deferredPrompt ?? null);
    }, timeoutMs);

    window.addEventListener('beforeinstallprompt', onPrompt, { once: true });
    window.addEventListener('racha-pwa-prompt-ready', onPrompt, { once: true });
  });
}

export function usePWAInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    let promptEvent =
      state.deferredPrompt ??
      (typeof window !== 'undefined' ? window.__rachaInstallPrompt ?? null : null);

    if (!promptEvent && !ENV.isInIframe && !ENV.isIOS) {
      promptEvent = await waitForDeferredPrompt(600);
    }

    if (!promptEvent) {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (typeof window !== 'undefined') {
        window.__rachaInstallPrompt = null;
      }
      if (outcome === 'accepted') {
        if (typeof window !== 'undefined') {
          window.__rachaAppInstalled = true;
        }
        clearInstallQueryParam();
        setSnapshot({
          deferredPrompt: null,
          isInstalled: true,
          installRequestedFromQuery: false,
        });
        return 'accepted';
      }
      setSnapshot({ deferredPrompt: null });
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [state.deferredPrompt]);

  const isInstallable = Boolean(state.deferredPrompt) && !state.isInstalled;

  return {
    isInstallable,
    isPWACompatible: ENV.isPWACompatible || isInstallable,
    supportsNativePrompt: ENV.supportsNativePrompt,
    isInstalled: state.isInstalled,
    isIOS: ENV.isIOS,
    isAndroid: ENV.isAndroid,
    isInIframe: ENV.isInIframe,
    installRequestedFromQuery: state.installRequestedFromQuery,
    dismissInstallPromptBanner: clearInstallQueryParam,
    install,
  };
}
