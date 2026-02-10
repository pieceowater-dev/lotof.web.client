import { logError } from '@/utils/logger';
import { navigateTo } from '#app';
import { useRouter } from 'vue-router';

/**
 * Plugin to handle subscription-related GraphQL errors
 * Detects subscription_expired errors and provides global notification
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const router = useRouter();
    let redirecting = false;
    let lastRedirectAt = 0;
    // Create global state for subscription error
    const subscriptionError = useState<string | null>('subscription_error', () => null);
    const subscriptionErrorShown = useState<boolean>('subscription_error_shown', () => false);

    /**
     * Check if error message indicates subscription expiration
     */
    function isSubscriptionExpiredError(errorMessage: string): boolean {
      return (
        errorMessage.includes('subscription_expired') ||
        errorMessage.includes('subscription has expired') ||
        (errorMessage.toLowerCase().includes('plan') && errorMessage.toLowerCase().includes('expired'))
      );
    }

    function extractSubscriptionKey(errorMessage: string): string {
      const marker = 'subscription_expired:';
      if (errorMessage.includes(marker)) {
        const raw = errorMessage.split(marker)[1]?.trim();
        if (raw) return raw;
      }
      return 'billing.subscriptionExpired';
    }

    /**
     * Handle GraphQL errors globally
     * This is called from API error handlers
     */
    function handleGraphQLError(error: any) {
      if (!error) return;

      const errorMessages: string[] = [];

      // Extract error messages from GraphQL response
      if (error.response?.errors) {
        const errors = Array.isArray(error.response.errors)
          ? error.response.errors
          : [error.response.errors];

        errors.forEach((err: any) => {
          const msg = err?.message || '';
          if (msg) errorMessages.push(msg);
        });
      }

      // Check if any error is subscription-related
      const subscriptionExpired = errorMessages.some(msg => isSubscriptionExpiredError(msg));

      if (subscriptionExpired) {
        const matched = errorMessages.find(msg => isSubscriptionExpiredError(msg)) || '';
        const key = extractSubscriptionKey(matched);

        logError('Subscription expired error detected:', key);
        subscriptionError.value = key;
        subscriptionErrorShown.value = false; // Allow modal to show

        try {
          const currentRoute = router.currentRoute.value;
          let nsSlug = (currentRoute.params?.namespace as string) || '';
          if (!nsSlug) {
            const segments = (currentRoute.path || '').split('/').filter(Boolean);
            nsSlug = segments[0] || '';
          }
          const now = Date.now();
          if (nsSlug && !currentRoute.path.includes(`/${nsSlug}/atrace/plans`) && !redirecting && now - lastRedirectAt > 1000) {
            redirecting = true;
            lastRedirectAt = now;
            setTimeout(() => {
              router.replace(`/${nsSlug}/atrace/plans`).finally(() => {
                redirecting = false;
              });
            }, 0);
          }
        } catch {}
      }
    }

    /**
     * Clear subscription error state
     */
    function clearSubscriptionError() {
      subscriptionError.value = null;
      subscriptionErrorShown.value = false;
    }

    /**
     * Mark subscription error as shown (to prevent multiple modals)
     */
    function markSubscriptionErrorShown() {
      subscriptionErrorShown.value = true;
    }

    // Provide globally
    return {
      provide: {
        subscriptionError,
        subscriptionErrorShown,
        handleGraphQLError,
        clearSubscriptionError,
        markSubscriptionErrorShown,
      },
    };
  }
});
