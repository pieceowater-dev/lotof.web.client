// Global "contact us to subscribe" paywall -- shown instead of a real
// checkout whenever a visitor tries to get a paid plan, since there's no
// payment gateway yet. One shared modal (mounted once in app.vue), matching
// the SubscriptionRenewalModal / PhoneRequiredModal pattern.
export function useContactUsModal() {
  const isOpen = useState<boolean>('contact_us_modal_open', () => false);
  const context = useState<{ app?: string; planName?: string } | null>('contact_us_modal_context', () => null);

  function open(ctx?: { app?: string; planName?: string }) {
    context.value = ctx || null;
    isOpen.value = true;
    try {
      useAnalytics().track('contact_us_paywall_shown', { app: ctx?.app, plan: ctx?.planName });
    } catch {}
  }

  function close() {
    isOpen.value = false;
  }

  return { isOpen, context, open, close };
}
