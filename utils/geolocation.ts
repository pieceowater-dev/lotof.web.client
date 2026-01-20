export type GeoPoint = {
  latitude?: number;
  longitude?: number;
};

// Returns coords if permission is granted or prompted once; skips if denied or already prompted and still not granted.
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
        // Avoid re-prompting on every visit if the user already saw the prompt
        if (localStorage.getItem('geoPrompted') === '1') {
          return {};
        }
        localStorage.setItem('geoPrompted', '1');
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
