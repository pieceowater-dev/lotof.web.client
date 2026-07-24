import * as amplitude from '@amplitude/analytics-browser';

// Module-level (not useState) -- the SDK instance itself is a singleton per
// browser tab, not per-request SSR state, so it doesn't belong in Nuxt's
// state system.
let initialized = false;

// Centralized Amplitude wiring: one init call, one identify path (tied to
// useAuth's user), one namespace-context path (tied to useNamespace's
// selection), and a single track() every product surface calls through --
// so every event automatically carries who the user is and which namespace
// they were in, without each call site having to thread that through itself.
export function useAnalytics() {
  function init() {
    if (!process.client || initialized) return;
    const config = useRuntimeConfig();
    const apiKey = String(config.public.amplitudeApiKey || '');
    if (!apiKey) return;

    amplitude.init(apiKey, {
      defaultTracking: {
        pageViews: true,
        sessions: true,
        formInteractions: false,
        fileDownloads: false,
      },
    });
    initialized = true;
  }

  function identifyUser(user: { id: string; username?: string; email?: string; phone?: string | null } | null) {
    if (!process.client) return;
    if (!user) {
      amplitude.reset();
      return;
    }
    amplitude.setUserId(user.id);
    const identity = new amplitude.Identify();
    if (user.username) identity.set('username', user.username);
    if (user.email) identity.set('email', user.email);
    identity.set('has_phone', Boolean(user.phone && user.phone.trim()));
    amplitude.identify(identity);
  }

  // Called whenever the active namespace changes (see useNamespace's
  // setNamespace) -- stamps the namespace onto the user's Amplitude profile
  // and, where the plan supports it, Amplitude's group analytics. Every
  // track() call below also stamps it per-event, which works regardless of
  // plan tier and is what most "which namespace did X happen in" queries
  // actually filter on.
  function setNamespaceContext(slug: string | null | undefined) {
    if (!process.client || !slug) return;
    const identity = new amplitude.Identify();
    identity.set('current_namespace', slug);
    amplitude.identify(identity);
    try {
      amplitude.setGroup('namespace', slug);
    } catch {
      // Group analytics isn't available on every Amplitude plan -- the
      // per-event `namespace` property below covers the same need either way.
    }
  }

  function track(eventName: string, properties?: Record<string, unknown>) {
    if (!process.client) return;
    // Self-heal: if init() didn't run yet (e.g. the app plugin fired before
    // the SDK was ready) or failed silently (missing key), retry here so a
    // single bad first attempt doesn't silence tracking for the whole
    // session -- client-side route changes never re-run Nuxt plugins, so
    // nothing else would ever retry this.
    if (!initialized) init();
    let namespace: string | undefined;
    try {
      namespace = useNamespace().selected.value || undefined;
    } catch {
      // useNamespace can throw outside a Nuxt app context (shouldn't happen
      // in practice) -- never let analytics break the actual feature.
    }
    try {
      amplitude.track(eventName, { namespace, ...properties });
    } catch {
      // Analytics must never throw into caller code.
    }
  }

  return { init, identifyUser, setNamespaceContext, track };
}
