import { computed, effectScope, shallowReactive, watch } from 'vue';
import { LSKeys } from '@/utils/storageKeys';
import ru from '@/locales/ru.json';

type Locale = 'en' | 'ru' | 'kk';
const SUPPORTED_LOCALES: Locale[] = ['en', 'ru', 'kk'];
const DEFAULT_LOCALE: Locale = 'ru';

function normalizeLocale(value?: string | null): Locale | undefined {
  if (!value) return undefined;
  const lowered = String(value).toLowerCase();
  if (lowered.startsWith('ru')) return 'ru';
  if (lowered.startsWith('kk')) return 'kk';
  if (lowered.startsWith('en')) return 'en';
  return undefined;
}

// Russian (the default) ships in the main bundle. English and Kazakh are ~500 KB
// of JSON that most visitors never read, so they are fetched only when the
// interface switches to them -- or when a Russian key is missing and a fallback
// is needed. `messages` is reactive, so every t() that already ran re-renders
// once a language arrives.
const messages = shallowReactive<Partial<Record<Locale, Record<string, any>>>>({ ru: ru as any });
const loading = new Map<Locale, Promise<void>>();
let loadWatcherRegistered = false;
const loaders: Record<'en' | 'kk', () => Promise<{ default: unknown }>> = {
  en: () => import('@/locales/en.json'),
  kk: () => import('@/locales/kk.json'),
};
function ensureLocale(l: Locale): Promise<void> {
  if (messages[l] || l === 'ru') return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    p = loaders[l]().then((m) => { messages[l] = m.default as any; }).catch(() => { loading.delete(l); });
    loading.set(l, p);
  }
  return p;
}

// A missing Russian key only needs another language as a last resort, so that
// download waits until the page has painted and settled (it would otherwise
// compete with the first render on a slow connection).
const fallbackScheduled = new Set<Locale>();
function scheduleFallbackLoad(l: Locale) {
  if (!import.meta.client || fallbackScheduled.has(l)) return;
  fallbackScheduled.add(l);
  setTimeout(() => { void ensureLocale(l); }, 4000);
}

export function useI18n() {
  // Defaults to Russian for everyone regardless of browser/OS locale --
  // an explicit product decision, not a detection bug. An explicit choice
  // (stored in localStorage, synced below) always wins over this default.
  const locale = useState<Locale>('i18n-locale', () => DEFAULT_LOCALE);
  // One watcher for the whole client app (not one per component): load the
  // language the interface switches to. A detached scope outlives the first
  // component that happened to call useI18n().
  if (import.meta.client && !loadWatcherRegistered) {
    loadWatcherRegistered = true;
    effectScope(true).run(() => watch(locale, (l) => { void ensureLocale(l); }, { immediate: true }));
  }

  const isClientLocaleSynced = useState<boolean>('i18n-client-synced', () => false);
  if (process.client && !isClientLocaleSynced.value) {
    onNuxtReady(() => {
      if (isClientLocaleSynced.value) return;
      try {
        const stored = normalizeLocale(localStorage.getItem(LSKeys.LANGUAGE));
        if (stored && stored !== locale.value) {
          locale.value = stored;
        }
      } catch {
        // Ignore localStorage access issues.
      }
      isClientLocaleSynced.value = true;
      try {
        localStorage.setItem(LSKeys.LANGUAGE, locale.value);
      } catch {
        // Ignore localStorage write issues.
      }
    });
  }

  const isClientPersistenceWatchAttached = useState<boolean>('i18n-persistence-watch-attached-client', () => false);
  if (process.client && !isClientPersistenceWatchAttached.value) {
    isClientPersistenceWatchAttached.value = true;
    watch(
      locale,
      (value) => {
        if (!isClientLocaleSynced.value) return;
        try {
          localStorage.setItem(LSKeys.LANGUAGE, value);
        } catch {
          // Ignore localStorage write issues.
        }
      },
      { immediate: false }
    );
  }

  function getDeep(obj: any, keyPath: string): any {
    return keyPath.split('.').reduce((acc: any, k: string) => (acc && typeof acc === 'object') ? acc[k] : undefined, obj);
  }
  function resolveFromNamespace(namespace: any, restPath: string): string | undefined {
    const val = restPath ? getDeep(namespace, restPath) : namespace;
    return (typeof val === 'string' || typeof val === 'number') ? String(val) : undefined;
  }
  function resolveMessage(targetLocale: Locale, path: string): string | undefined {
    const parts = path.split('.');
    const ns = parts.shift();
    if (!ns) return undefined;

    const restPath = parts.join('.');
    const localeMessages = (messages as any)[targetLocale] || {};

    const direct = resolveFromNamespace(localeMessages[ns], restPath);
    if (direct !== undefined) {
      return direct;
    }

    // Backward-compatible fallback for misplaced sections like en.common.contacts.*
    const commonScoped = resolveFromNamespace(localeMessages.common?.[ns], restPath);
    if (commonScoped !== undefined) {
      return commonScoped;
    }

    return undefined;
  }
  function t(path: string, params?: Record<string, string | number>): string {
    const primaryLocale = locale.value;
    const fallbackLocales: Locale[] = primaryLocale === 'en'
      ? ['ru', 'kk']
      : primaryLocale === 'ru'
        ? ['en', 'kk']
        : ['ru', 'en'];

    let result = resolveMessage(primaryLocale, path) ?? '';
    for (const fallbackLocale of fallbackLocales) {
      if (result) break;
      if (!messages[fallbackLocale]) { scheduleFallbackLoad(fallbackLocale); continue; }
      result = resolveMessage(fallbackLocale, path) ?? '';
    }
    
    // Interpolate parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      });
    }
    
    return result;
  }
  function tm(path: string): any {
    const parts = path.split('.');
    const ns = parts.shift();
    if (!ns) return undefined;
    const dictNs = (messages as any)[locale.value]?.[ns] || {};
    const restPath = parts.join('.');
    return restPath ? getDeep(dictNs, restPath) : dictNs;
  }
  function setLocale(l: Locale) {
    if (!SUPPORTED_LOCALES.includes(l)) return;
    locale.value = l;
  }

  return { locale, t, tm, setLocale, available: computed(() => SUPPORTED_LOCALES) };
}
