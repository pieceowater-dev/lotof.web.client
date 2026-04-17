import { ref, computed, watch } from 'vue';
import { LSKeys } from '@/utils/storageKeys';
import en from '@/locales/en.json';
import kk from '@/locales/kk.json';
import ru from '@/locales/ru.json';

// Simple i18n implementation (client-side only for now)
type Locale = 'en' | 'ru' | 'kk';

const detected: Locale = (() => {
  if (typeof navigator === 'undefined') return 'en';
  if (navigator.language.startsWith('ru')) return 'ru';
  if (navigator.language.startsWith('kk')) return 'kk';
  return 'en';
})();
const currentLocale = ref<Locale>(detected);
// Load persisted locale
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(LSKeys.LANGUAGE);
  if (stored === 'en' || stored === 'ru' || stored === 'kk') currentLocale.value = stored;
}

const messages: Record<Locale, Record<string, any>> = {
  en: en as any,
  kk: kk as any,
  ru: ru as any
};

export function useI18n() {
  const locale = currentLocale;
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
    return resolveFromNamespace(localeMessages.common?.[ns], restPath);
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
  function setLocale(l: Locale) { currentLocale.value = l; }
  // Persist
  if (typeof window !== 'undefined') {
    watch(currentLocale, v => localStorage.setItem(LSKeys.LANGUAGE, v));
  }
  return { locale, t, tm, setLocale, available: computed(() => ['en', 'ru', 'kk']) };
}
