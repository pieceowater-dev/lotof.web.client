export type GeoPoint = {
  latitude?: number;
  longitude?: number;
};

/**
 * Radius for geo confirmation in meters, purely for the confirmed/not-
 * confirmed tooltip text -- the actual check happens server-side in
 * atrace.msvc.tracker, which defaults GEO_CONFIRMATION_RADIUS_METERS to
 * 20m (see its cfg.go). Keep this in sync with that value: there's no
 * runtime endpoint exposing the live config value to the client, so if an
 * operator ever overrides the env var in a specific deployment, this
 * display-only number will disagree with what's actually enforced there.
 */
export const GEO_CONFIRM_RADIUS_M = 20;

const GEO_PROMPT_SKIP_KEY = 'geoPromptedAt';
// Re-offer the native prompt after this long, rather than never again --
// staying in 'prompt' state just means the user hasn't made a permanent
// choice yet (dismissed the dialog, or it's a fresh tab/session), and a
// bare one-time flag with no expiry locked out geolocation for that device
// forever after the first skip, even though the browser itself would happily
// show the prompt again on request.
const GEO_PROMPT_SKIP_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Returns coords if permission is granted or prompted once; skips if denied
// or already prompted very recently and still not decided.
export async function getGeolocationOnce(options?: PositionOptions): Promise<GeoPoint> {
  if (typeof window === 'undefined') return {};
  if (!('geolocation' in navigator)) return {};

  let permissionState: PermissionState | '' = '';
  if ((navigator as any).permissions?.query) {
    try {
      const status = await (navigator as any).permissions.query({ name: 'geolocation' as PermissionName });
      permissionState = status.state;
      if (permissionState === 'denied') {
        return {};
      }
      if (permissionState === 'prompt') {
        // Avoid re-prompting on every visit if the user very recently saw
        // the prompt and didn't decide -- but only for a bounded window, so
        // a later visit still gets a chance to actually ask again.
        const lastPromptedAt = Number(localStorage.getItem(GEO_PROMPT_SKIP_KEY) || 0);
        if (lastPromptedAt && Date.now() - lastPromptedAt < GEO_PROMPT_SKIP_TTL_MS) {
          return {};
        }
        localStorage.setItem(GEO_PROMPT_SKIP_KEY, String(Date.now()));
      }
    } catch {
      // If permissions API fails, fall back to requesting once
    }
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      options || { timeout: 5000, enableHighAccuracy: false }
    );
  });
}
