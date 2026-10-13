// Per-provider presentation of the telephony settings: which credential
// fields exist, how they are called, and the connection steps shown to the
// administrator. Texts live in the locale files (contacts.integration*).

export type ProviderField = 'apiKey' | 'apiSecret' | 'baseUrl';

export interface ProviderMeta {
  icon: string;
  /** Tailwind classes of the icon tile. */
  tile: string;
  fields: Array<{ key: ProviderField; labelKey: string; required?: boolean; secret?: boolean }>;
}

const key = (labelKey: string, required = false) => ({ key: 'apiKey' as const, labelKey, required, secret: true });
const secret = (labelKey: string, required = false) => ({ key: 'apiSecret' as const, labelKey, required, secret: true });
const base = (labelKey: string) => ({ key: 'baseUrl' as const, labelKey, secret: false });

export const providerMeta: Record<string, ProviderMeta> = {
  kcell: {
    icon: 'lucide:phone-call',
    tile: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
    fields: [key('contacts.integrationFieldApiKeyOutgoing'), base('contacts.integrationFieldBaseUrlKcell')],
  },
  gravitel: {
    icon: 'lucide:headset',
    tile: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
    fields: [key('contacts.integrationFieldApiKeyOutgoing'), base('contacts.integrationFieldBaseUrlCrm')],
  },
  zadarma: {
    icon: 'lucide:radio-tower',
    tile: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
    fields: [key('contacts.integrationFieldZadarmaKey', true), secret('contacts.integrationFieldZadarmaSecret', true)],
  },
  mango: {
    icon: 'lucide:phone-forwarded',
    tile: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    fields: [key('contacts.integrationFieldMangoKey', true), secret('contacts.integrationFieldMangoSalt', true)],
  },
  universal: {
    icon: 'lucide:webhook',
    tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    fields: [secret('contacts.integrationFieldHmacSecret'), key('contacts.integrationFieldBearer'), base('contacts.integrationFieldBaseUrlScript')],
  },
};

export function metaFor(code: string): ProviderMeta {
  return providerMeta[code] || { icon: 'lucide:plug', tile: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200', fields: [] };
}

/** "5 минут назад" in the current locale. */
export function timeAgo(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}
