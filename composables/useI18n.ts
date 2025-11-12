import { ref, computed, watch } from 'vue';
import { LSKeys } from '@/utils/storageKeys';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';

// Simple i18n implementation (client-side only for now)
const detected = (typeof navigator !== 'undefined' && navigator.language.startsWith('ru')) ? 'ru' : 'en';
const currentLocale = ref<'en' | 'ru'>(detected);
// Load persisted locale
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(LSKeys.LANGUAGE);
  if (stored === 'en' || stored === 'ru') currentLocale.value = stored;
}

const messages: Record<'en'|'ru', Record<string, any>> = {
  en: en as any,
  ru: ru as any
};

export function useI18n() {
  const locale = currentLocale;
  function getDeep(obj: any, keyPath: string): any {
    return keyPath.split('.').reduce((acc: any, k: string) => (acc && typeof acc === 'object') ? acc[k] : undefined, obj);
  }
  function t(path: string): string {
    const parts = path.split('.');
    const ns = parts.shift();
    if (!ns) return path;
    const dictNs = (messages as any)[locale.value]?.[ns] || {};
    const restPath = parts.join('.');
    const val = restPath ? getDeep(dictNs, restPath) : dictNs;
    return (typeof val === 'string' || typeof val === 'number') ? String(val) : path;
  }
  function tm(path: string): any {
    const parts = path.split('.');
    const ns = parts.shift();
    if (!ns) return undefined;
    const dictNs = (messages as any)[locale.value]?.[ns] || {};
    const restPath = parts.join('.');
    return restPath ? getDeep(dictNs, restPath) : dictNs;
  }
  function setLocale(l: 'en' | 'ru') { currentLocale.value = l; }
  // Persist
  if (typeof window !== 'undefined') {
    watch(currentLocale, v => localStorage.setItem(LSKeys.LANGUAGE, v));
  }
  return { locale, t, tm, setLocale, available: computed(() => ['en','ru']) };
}
