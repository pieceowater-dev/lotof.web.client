<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import 'leaflet/dist/leaflet.css';

const { t } = useI18n();

const props = defineProps<{
  lat?: number | null;
  lng?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update', lat: number, lng: number): void;
}>();

// Almaty as a reasonable default center when no coordinates are set yet —
// the map still needs *some* starting view before the user places a pin.
const DEFAULT_CENTER: [number, number] = [43.238293, 76.945465];

const mapEl = ref<HTMLElement | null>(null);
let map: any = null;
let marker: any = null;

async function initMap() {
  const L = await import('leaflet');
  // Vite bundles Leaflet's default marker icon with relative paths that
  // break once bundled — point them at the actual asset URLs instead.
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: (await import('leaflet/dist/images/marker-icon-2x.png')).default,
    iconUrl: (await import('leaflet/dist/images/marker-icon.png')).default,
    shadowUrl: (await import('leaflet/dist/images/marker-shadow.png')).default,
  });

  const center: [number, number] = props.lat && props.lng ? [props.lat, props.lng] : DEFAULT_CENTER;
  map = L.map(mapEl.value as HTMLElement).setView(center, props.lat && props.lng ? 15 : 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  if (props.lat && props.lng) {
    marker = L.marker(center, { draggable: true }).addTo(map);
    bindMarkerEvents(L);
  }

  map.on('click', (e: any) => {
    const { lat, lng } = e.latlng;
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      bindMarkerEvents(L);
    }
    emit('update', lat, lng);
  });
}

function bindMarkerEvents(L: any) {
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    emit('update', pos.lat, pos.lng);
  });
}

onMounted(() => {
  initMap();
});
onBeforeUnmount(() => {
  map?.remove();
});
</script>

<template>
  <div>
    <div ref="mapEl" class="w-full h-56 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800" />
    <p class="text-xs text-gray-400 mt-1.5">{{ t('menu.mapPickHint') || 'Click the map (or drag the pin) to set the branch location.' }}</p>
  </div>
</template>
