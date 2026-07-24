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

  return { phone, whatsapp, loading, loaded, load, hasContact, telHref, whatsappHref };
}
