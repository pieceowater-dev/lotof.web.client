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
  function t(path: string): string {
    const [ns, key] = path.split('.');
    const dict = (messages as any)[locale.value]?.[ns] || {};
    return dict[key] || path;
  }
  function tm(path: string): any {
    const [ns, key] = path.split('.');
    const dict = (messages as any)[locale.value]?.[ns] || {};
    return dict[key];
  }
  function setLocale(l: 'en' | 'ru') { currentLocale.value = l; }
  // Persist
  if (typeof window !== 'undefined') {
    watch(currentLocale, v => localStorage.setItem(LSKeys.LANGUAGE, v));
  }
  return { locale, t, tm, setLocale, available: computed(() => ['en','ru']) };
}
