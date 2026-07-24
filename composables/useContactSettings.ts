import { capitalGetContactSettings } from '@/api/capital/admin';

// Sales contact info (phone/WhatsApp) shown in place of a real checkout
// while there's no payment gateway. Fetched once per session and shared
// across the paywall screen and every plans page's "contact us" banner.
export function useContactSettings() {
  const phone = useState<string>('contact_settings_phone', () => '');
  const whatsapp = useState<string>('contact_settings_whatsapp', () => '');
  const loaded = useState<boolean>('contact_settings_loaded', () => false);
  const loading = useState<boolean>('contact_settings_loading', () => false);

  async function load(force = false) {
    if (!process.client) return;
    if (loaded.value && !force) return;
    const { token } = useAuth();
    if (!token.value) return;
    loading.value = true;
    try {
      const settings = await capitalGetContactSettings(token.value);
      phone.value = settings?.phone || '';
      whatsapp.value = settings?.whatsapp || '';
      loaded.value = true;
    } catch (e) {
      console.error('[useContactSettings] Failed to load contact settings', e);
    } finally {
      loading.value = false;
    }
  }

  const hasContact = computed(() => Boolean(phone.value.trim() || whatsapp.value.trim()));
  const telHref = computed(() => (phone.value.trim() ? `tel:${phone.value.trim()}` : ''));
  const whatsappHref = computed(() => {
    const digits = whatsapp.value.trim().replace(/[^\d]/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  });
  const formattedPhone = computed(() => formatPhoneNumber(phone.value));

  return { phone, whatsapp, loading, loaded, load, hasContact, telHref, whatsappHref, formattedPhone };
}

// "+77471380563" -> "+7 747 138 05 63". Falls back to grouping digits in
// chunks of 2-3 for numbers that don't match the RU/KZ +7 shape, and to the
// raw value if it isn't parseable as a phone number at all.
export function formatPhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/[^\d]/g, '');

  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    const d = digits.slice(1);
    return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
  }

  if (digits.length >= 10) {
    const prefix = trimmed.startsWith('+') ? '+' : '';
    const groups = digits.match(/.{1,3}/g) || [digits];
    return `${prefix}${groups.join(' ')}`;
  }

  return trimmed;
}
