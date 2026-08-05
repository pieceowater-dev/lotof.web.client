export type PwaPlatform = 'ios' | 'android' | 'desktop';

// The browser only fires this once, long before any button asking for it
// exists, so it has to be captured at module scope the moment the app boots
// -- not inside a component that might mount long after the event fired.
const deferredPrompt = ref<any>(null);
const isStandalone = ref(false);

if (process.client) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
  });
  const mq = window.matchMedia?.('(display-mode: standalone)');
  isStandalone.value = !!mq?.matches || (window.navigator as any).standalone === true;
  mq?.addEventListener?.('change', (e) => { isStandalone.value = e.matches; });
  window.addEventListener('appinstalled', () => { deferredPrompt.value = null; isStandalone.value = true; });
}

function detectPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function usePwaInstall() {
  const platform = computed<PwaPlatform>(() => detectPlatform());
  // Chrome/Edge on Android can skip the manual steps entirely via the native
  // prompt; every other case (iOS Safari never exposes this API, desktop
  // browsers, Firefox) falls back to on-screen instructions.
  const canPromptInstall = computed(() => !!deferredPrompt.value);

  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt.value) return false;
    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;
    return outcome === 'accepted';
  }

  return { platform, isStandalone, canPromptInstall, promptInstall };
}
