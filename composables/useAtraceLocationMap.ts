import type { Ref } from 'vue';
import { getGeolocationOnce } from '@/utils/geolocation';
import { getBrowserTimezone } from '@/utils/timezones';

export type LocationForm = {
  title: string;
  description?: string;
  location: { address?: string; city?: string; latitude?: number | ''; longitude?: number | ''; timezone?: string; requireGeoOnCheckIn?: boolean };
  pin: string;
};

// Shared Leaflet + geolocation wiring behind the location create/edit forms
// (CreatePostModal, and the first-location full-screen flow) -- both need
// the exact same map behavior, this just avoids keeping two copies in sync.
export function useAtraceLocationMap(form: Ref<LocationForm>) {
  const { t } = useI18n();

  const mapContainer = ref<HTMLElement | null>(null);
  const mapLoading = ref(false);
  const mapError = ref<string | null>(null);
  const geoLoading = ref(false);
  const geoEnabled = ref(true);
  let map: any = null;
  let marker: any = null;

  const defaultCenter: [number, number] = [20, 0];
  const defaultZoom = 2;

  async function checkAndRequestGeolocation() {
    if (!navigator.permissions || !navigator.geolocation) return;
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (permission.state === 'granted' || permission.state === 'prompt') {
        await requestGeolocation();
      }
    } catch (error) {
      console.error('Failed to check geolocation permission:', error);
    }
  }

  async function requestGeolocation() {
    geoLoading.value = true;
    mapError.value = null;
    try {
      const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          (error) => reject(error),
          { timeout: 30000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });

      if (coords.latitude && coords.longitude) {
        form.value.location.latitude = coords.latitude;
        form.value.location.longitude = coords.longitude;

        if (map && marker) {
          const L = (await import('leaflet')).default;
          const latlng = L.latLng(coords.latitude, coords.longitude);
          marker.setLatLng(latlng);
          map.setView(latlng, 15);
        }
      }
    } catch (error: any) {
      console.error('Geolocation error:', error);
      if (error.code === 1) {
        mapError.value = t('app.geolocationDenied') || 'Доступ к геолокации запрещен';
      } else if (error.code === 2) {
        mapError.value = t('app.geolocationUnavailable') || 'Местоположение недоступно. Попробуйте еще раз.';
      } else if (error.code === 3) {
        mapError.value = t('app.geolocationTimeout') || 'Время ожидания истекло';
      } else {
        mapError.value = t('app.geolocationError') || 'Не удалось получить геолокацию';
      }
    } finally {
      geoLoading.value = false;
    }
  }

  async function handleGeolocationClick() {
    if (!map && !mapLoading.value) {
      await initMap();
      return;
    }
    await requestGeolocation();
  }

  async function initMap() {
    if (!mapContainer.value || !process.client) return;

    mapLoading.value = true;
    mapError.value = null;

    try {
      if (map) {
        map.remove();
        map = null;
        marker = null;
      }
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const colorMode = useColorMode();
      const isDark = colorMode.value === 'dark';

      let center: [number, number] = defaultCenter;
      let zoom = defaultZoom;

      if (navigator.geolocation) {
        const coords = await getGeolocationOnce({ timeout: 5000, enableHighAccuracy: false });
        if (coords.latitude !== undefined && coords.longitude !== undefined) {
          center = [coords.latitude, coords.longitude];
          zoom = 12;
          if (!form.value.location.latitude && !form.value.location.longitude) {
            form.value.location.latitude = coords.latitude;
            form.value.location.longitude = coords.longitude;
          }
        } else if (form.value.location.latitude && form.value.location.longitude) {
          center = [Number(form.value.location.latitude), Number(form.value.location.longitude)];
          zoom = 12;
        }
      } else if (form.value.location.latitude && form.value.location.longitude) {
        center = [Number(form.value.location.latitude), Number(form.value.location.longitude)];
        zoom = 12;
      }

      map = L.map(mapContainer.value).setView(center, zoom);

      if (isDark) {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO'
        }).addTo(map);
      } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
      }

      marker = L.marker(center, { draggable: true }).addTo(map);

      marker.on('dragend', () => {
        if (!marker) return;
        const pos = marker.getLatLng();
        form.value.location.latitude = pos.lat;
        form.value.location.longitude = pos.lng;
      });

      map.on('click', (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        form.value.location.latitude = lat;
        form.value.location.longitude = lng;
        if (marker) {
          marker.setLatLng(e.latlng);
        }
      });

      mapLoading.value = false;

      await checkAndRequestGeolocation();
    } catch (error) {
      console.error('Failed to load map:', error);
      mapError.value = 'Failed to load map';
      mapLoading.value = false;
    }
  }

  function disableGeolocation() {
    if (map) {
      map.remove();
      map = null;
      marker = null;
    }
    mapError.value = null;
    mapLoading.value = false;
    form.value.location.latitude = '';
    form.value.location.longitude = '';
    // Not meaningful without coordinates to confirm against
    form.value.location.requireGeoOnCheckIn = false;
  }

  watch(geoEnabled, async (enabled) => {
    if (!process.client) return;
    if (enabled) {
      await nextTick();
      await initMap();
    } else {
      disableGeolocation();
    }
  });

  // Called by the host component (modal or full-screen) when it becomes
  // visible -- sets a default timezone if none is picked yet and (re)inits
  // the map, mirroring what each host previously did in its own
  // `watch(() => props.modelValue, ...)`.
  function activate() {
    if (!process.client) return;
    if (!form.value.location.timezone) {
      form.value.location.timezone = getBrowserTimezone();
    }
    geoEnabled.value = true;
    nextTick(() => {
      initMap();
    });
  }

  function deactivate() {
    disableGeolocation();
  }

  function generatePin() {
    form.value.pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
  }

  return {
    mapContainer,
    mapLoading,
    mapError,
    geoLoading,
    geoEnabled,
    handleGeolocationClick,
    activate,
    deactivate,
    generatePin,
  };
}
