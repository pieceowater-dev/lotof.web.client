<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { getGeolocationOnce } from '@/utils/geolocation';
import { TIMEZONES, getBrowserTimezone, getTimezoneLabel } from '@/utils/timezones';

// Format timezones with dynamic offset for display
const TIMEZONES_FORMATTED = computed(() => 
  TIMEZONES.map(tz => ({
    value: tz.value,
    label: getTimezoneLabel(tz.value),
  }))
);

const props = defineProps<{
  modelValue: boolean,
  form: { title: string; description?: string; location: { address?: string; city?: string; latitude?: number | ''; longitude?: number | ''; timezone?: string }; pin: string }
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void,
  (e: 'submit'): void
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const { t } = useI18n();

function generatePin() {
  (props.form as any).pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
}

// Leaflet Map
const mapContainer = ref<HTMLElement | null>(null);
const mapLoading = ref(false);
const mapError = ref<string | null>(null);
const geoLoading = ref(false);
const geoEnabled = ref(true);
let map: any = null;
let marker: any = null;

// Default center (World view)
const defaultCenter: [number, number] = [20, 0];
const defaultZoom = 2;

async function checkAndRequestGeolocation() {
  // Check geolocation permission status
  if (!navigator.permissions || !navigator.geolocation) return;
  
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    
    if (permission.state === 'granted' || permission.state === 'prompt') {
      // Auto-request if granted or prompt (will show browser dialog on prompt)
      await requestGeolocation();
    }
    // If denied, do nothing - user can use the button to try again
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
      props.form.location.latitude = coords.latitude;
      props.form.location.longitude = coords.longitude;
      
      // Update map view
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
    // Dynamic import for client-side only
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    // Fix default icon paths for Safari/production builds
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Get current color mode
    const colorMode = useColorMode();
    const isDark = colorMode.value === 'dark';

    let center: [number, number] = defaultCenter;
    let zoom = defaultZoom;

    // Try to get user's location without re-prompting if already denied
    if (navigator.geolocation) {
      const coords = await getGeolocationOnce({ timeout: 5000, enableHighAccuracy: false });
      if (coords.latitude !== undefined && coords.longitude !== undefined) {
        center = [coords.latitude, coords.longitude];
        zoom = 12;
        if (!props.form.location.latitude && !props.form.location.longitude) {
          props.form.location.latitude = coords.latitude;
          props.form.location.longitude = coords.longitude;
        }
      } else if (props.form.location.latitude && props.form.location.longitude) {
        center = [Number(props.form.location.latitude), Number(props.form.location.longitude)];
        zoom = 12;
      }
    } else if (props.form.location.latitude && props.form.location.longitude) {
      center = [Number(props.form.location.latitude), Number(props.form.location.longitude)];
      zoom = 12;
    }

    map = L.map(mapContainer.value).setView(center, zoom);

    // Use different tile layers based on theme
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

    // Update coordinates on marker drag
    marker.on('dragend', () => {
      if (!marker) return;
      const pos = marker.getLatLng();
      props.form.location.latitude = pos.lat;
      props.form.location.longitude = pos.lng;
    });

    // Set marker on map click
    map.on('click', (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      props.form.location.latitude = lat;
      props.form.location.longitude = lng;
      if (marker) {
        marker.setLatLng(e.latlng);
      }
    });
    
    mapLoading.value = false;
    
    // Check and request geolocation automatically
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
  props.form.location.latitude = '';
  props.form.location.longitude = '';
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

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && process.client) {
    // Initialize timezone with browser timezone if not already set
    if (!props.form.location.timezone) {
      props.form.location.timezone = getBrowserTimezone();
    }
    geoEnabled.value = true;
    nextTick(() => {
      initMap();
    });
  } else if (!isOpen) {
    disableGeolocation();
  }
});
</script>

<template>
  <UModal v-model="open">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('app.atraceAddLocation') }}
          </h3>
          <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="open = false" />
        </div>
      </template>

      <div class="space-y-3">
        <UFormGroup :label="t('common.title')">
          <UInput v-model="props.form.title" :placeholder="t('common.title')" />
        </UFormGroup>
        <UFormGroup :label="t('common.description')">
          <UTextarea v-model="props.form.description" :placeholder="t('common.description')" />
        </UFormGroup>
        <USeparator />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormGroup :label="t('common.address')">
            <UInput v-model="props.form.location.address" :placeholder="t('common.address')" />
          </UFormGroup>
          <UFormGroup :label="t('common.city')">
            <UInput v-model="props.form.location.city" :placeholder="t('common.city')" />
          </UFormGroup>
        </div>
        
        <UFormGroup :label="t('app.timezone')">
          <USelectMenu 
            v-model="props.form.location.timezone" 
            :options="TIMEZONES_FORMATTED" 
            option-attribute="label"
            value-attribute="value"
            searchable
            :placeholder="props.form.location.timezone || t('app.timezone')"
            :popper="{ placement: 'top' }"
          />
          <div class="text-xs text-gray-500 mt-1">{{ t('app.timezoneHint') }}</div>
        </UFormGroup>
        
        <!-- Google Map -->
        <UFormGroup :label="t('app.location')">
          <div class="flex items-center gap-3 mb-2">
            <UToggle v-model="geoEnabled" />
            <span class="text-sm text-gray-700 dark:text-gray-200">
              {{ t('app.allowGeolocation') || 'Разрешить геолокацию' }}
            </span>
          </div>
          <div v-if="geoEnabled">
            <div ref="mapContainer" class="w-full h-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <span v-if="mapLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</span>
              <span v-else-if="mapError" class="text-sm text-red-500">{{ mapError }}</span>
            </div>
            <div class="flex items-center justify-between mt-1">
              <div v-if="props.form.location.latitude && props.form.location.longitude" class="text-xs text-gray-500">
                {{ Number(props.form.location.latitude).toFixed(6) }}, {{ Number(props.form.location.longitude).toFixed(6) }}
              </div>
              <UButton 
                size="xs" 
                color="primary" 
                variant="soft"
                icon="lucide:map-pin" 
                :loading="geoLoading"
                @click="handleGeolocationClick"
              >
                {{ t('app.allowGeolocation') || 'Разрешить геолокацию' }}
              </UButton>
            </div>
          </div>
        </UFormGroup>
        
        <USeparator />
        <UFormGroup :label="t('app.pin6digits')">
          <div class="flex gap-2 items-center">
            <UInput v-model="props.form.pin" maxlength="6" placeholder="******" class="w-32" />
            <UButton size="xs" color="primary" @click="generatePin">{{ t('common.generate') }}</UButton>
          </div>
          <div class="text-xs text-yellow-600 mt-1" v-html="t('app.pinSecurityNote')"></div>
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton icon="lucide:x" color="primary" variant="soft" @click="open = false">{{ t('common.cancel') }}</UButton>
          <UButton icon="lucide:check" color="primary" :disabled="!props.form.title || String(props.form.pin).length !== 6" @click="emit('submit')">{{ t('common.create') }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
