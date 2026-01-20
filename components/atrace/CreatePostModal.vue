<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { getGeolocationOnce } from '@/utils/geolocation';

const props = defineProps<{
  modelValue: boolean,
  form: { title: string; description?: string; location: { address?: string; city?: string; latitude?: number | ''; longitude?: number | '' }; pin: string }
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
let map: any = null;
let marker: any = null;

// Default center (World view)
const defaultCenter: [number, number] = [20, 0];
const defaultZoom = 2;

async function initMap() {
  if (!mapContainer.value || !process.client) return;
  
  mapLoading.value = true;
  mapError.value = null;
  
  try {
    // Dynamic import for client-side only
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

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
  } catch (error) {
    console.error('Failed to load map:', error);
    mapError.value = 'Failed to load map';
    mapLoading.value = false;
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && process.client) {
    nextTick(() => {
      initMap();
    });
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
        
        <!-- Google Map -->
        <UFormGroup :label="t('app.location')">
          <div ref="mapContainer" class="w-full h-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
            <span v-if="mapLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</span>
            <span v-else-if="mapError" class="text-sm text-red-500">{{ mapError }}</span>
          </div>
          <div v-if="props.form.location.latitude && props.form.location.longitude" class="text-xs text-gray-500 mt-1">
            {{ Number(props.form.location.latitude).toFixed(6) }}, {{ Number(props.form.location.longitude).toFixed(6) }}
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
