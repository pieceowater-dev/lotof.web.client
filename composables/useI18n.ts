import { computed, watch } from 'vue';
import { LSKeys } from '@/utils/storageKeys';
import en from '@/locales/en.json';
import kk from '@/locales/kk.json';
import ru from '@/locales/ru.json';

type Locale = 'en' | 'ru' | 'kk';
const SUPPORTED_LOCALES: Locale[] = ['en', 'ru', 'kk'];
const DEFAULT_LOCALE: Locale = 'en';

function normalizeLocale(value?: string | null): Locale | undefined {
  if (!value) return undefined;
  const lowered = String(value).toLowerCase();
  if (lowered.startsWith('ru')) return 'ru';
  if (lowered.startsWith('kk')) return 'kk';
  if (lowered.startsWith('en')) return 'en';
  return undefined;
}

function detectFromAcceptLanguage(value?: string): Locale | undefined {
  if (!value) return undefined;
  const first = value.split(',').map((part) => part.trim()).find(Boolean);
  return normalizeLocale(first);
}

const messages: Record<Locale, Record<string, any>> = {
  en: en as any,
  kk: kk as any,
  ru: ru as any
};

export function useI18n() {
  const locale = useState<Locale>('i18n-locale', () => {
    if (process.server) {
      const acceptLanguage = useRequestHeaders(['accept-language'])['accept-language'];
      return detectFromAcceptLanguage(acceptLanguage) || DEFAULT_LOCALE;
    }

    if (process.client) {
      return normalizeLocale(navigator.language) || DEFAULT_LOCALE;
    }

    return DEFAULT_LOCALE;
  });

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
