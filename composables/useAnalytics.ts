// The Amplitude SDK (~200 KiB of JavaScript) is not needed to paint any page,
// so it is imported on demand: init() only schedules the download for after the
// page has loaded and settled, and anything tracked before the SDK arrives
// (identify, namespace, events) waits in a queue and is replayed in order.
type Amplitude = typeof import('@amplitude/analytics-browser');

// Module-level (not useState) -- the SDK instance itself is a singleton per
// browser tab, not per-request SSR state, so it doesn't belong in Nuxt's
// state system.
let initialized = false;
let apiKey = '';
let sdk: Amplitude | null = null;
let loading: Promise<void> | null = null;
const queue: Array<(a: Amplitude) => void> = [];

function configure(a: Amplitude) {
  a.init(apiKey, {
    defaultTracking: {
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
    // We don't use session replay or remote feature flags, so skip the
    // extra sr-client-cfg.amplitude.com fetch entirely, and silence the
    // SDK's own console logging.
    fetchRemoteConfig: false,
    logLevel: a.Types.LogLevel.None,
    // Route event ingestion through our own origin instead of
    // amplitude.com directly -- ad blockers/privacy extensions block
    // amplitude.com by domain regardless of any client-side config, which
    // showed up as "Resource blocked by content blocker" console errors
    // (a native browser message, not something logLevel can suppress).
    // server/api/analytics/collect.post.ts transparently forwards to
    // Amplitude's real ingestion endpoint server-side.
    serverUrl: '/api/analytics/collect',
  });
}

function loadSdk(): Promise<void> {
  if (!loading) {
    loading = import('@amplitude/analytics-browser')
      .then((m) => {
        sdk = m;
        configure(m);
        queue.splice(0).forEach((fn) => { try { fn(m); } catch { /* analytics must never throw */ } });
      })
      .catch(() => { loading = null; });
  }
  return loading;
}

// Run now if the SDK is here, otherwise queue it and start the download.
function withSdk(fn: (a: Amplitude) => void) {
  if (sdk) { try { fn(sdk); } catch { /* analytics must never throw */ } return; }
  if (!apiKey) return;
  queue.push(fn);
  void loadSdk();
}

// Centralized Amplitude wiring: one init call, one identify path (tied to
// useAuth's user), one namespace-context path (tied to useNamespace's
// selection), and a single track() every product surface calls through --
// so every event automatically carries who the user is and which namespace
// they were in, without each call site having to thread that through itself.
export function useAnalytics() {
  function init() {
    if (!process.client || initialized) return;
    const config = useRuntimeConfig();
    apiKey = String(config.public.amplitudeApiKey || '');
    if (!apiKey) return;
    initialized = true;
    // Start the download once the page is loaded and the browser is idle.
    const start = () => { void loadSdk(); };
    const afterLoad = () => {
      const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => void);
      if (idle) idle(start, { timeout: 4000 }); else setTimeout(start, 2500);
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
  }

  // Only the opaque user id plus a has_phone flag go to Amplitude -- no email
  // or username, so the "anonymous analytics" promise in the cookie notice holds.
  function identifyUser(user: { id: string; phone?: string | null } | null) {
    if (!process.client) return;
    withSdk((a) => {
      if (!user) {
        a.reset();
        return;
      }
      a.setUserId(user.id);
      const identity = new a.Identify();
      identity.set('has_phone', Boolean(user.phone && user.phone.trim()));
      a.identify(identity);
    });
  }

  // Called whenever the active namespace changes (see useNamespace's
  // setNamespace) -- stamps the namespace onto the user's Amplitude profile
  // and, where the plan supports it, Amplitude's group analytics. Every
  // track() call below also stamps it per-event, which works regardless of
  // plan tier and is what most "which namespace did X happen in" queries
  // actually filter on.
  function setNamespaceContext(slug: string | null | undefined) {
    if (!process.client || !slug) return;
    withSdk((a) => {
      const identity = new a.Identify();
      identity.set('current_namespace', slug);
      a.identify(identity);
      try {
        a.setGroup('namespace', slug);
      } catch {
        // Group analytics isn't available on every Amplitude plan -- the
        // per-event `namespace` property below covers the same need either way.
      }
    });
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
    withSdk((a) => { a.track(eventName, { namespace, ...properties }); });
  }

  return { init, identifyUser, setNamespaceContext, track };
}
