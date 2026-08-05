<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { TaskItem } from '@/api/tasks/task/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  task: TaskItem | null;
  currentPosition: { lat: number; lng: number } | null;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const mapEl = ref<HTMLElement | null>(null);
let L: any = null;
let map: any = null;
let taskMarker: any = null;
let meMarker: any = null;

function taskIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="background:#ef4444;color:#fff;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13z"/><circle cx="12" cy="9" r="2.5"/></svg></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}
function meIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:9999px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

async function initMap() {
  if (!props.task?.lat || !props.task?.lng || !mapEl.value) return;
  await import('leaflet/dist/leaflet.css');
  L = await import('leaflet');
  const center: [number, number] = [props.task.lat, props.task.lng];
  map = L.map(mapEl.value).setView(center, 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);
  taskMarker = L.marker(center, { icon: taskIcon() }).addTo(map);
  syncMePosition();
}

function syncMePosition() {
  if (!map || !L || !props.currentPosition) return;
  const pos: [number, number] = [props.currentPosition.lat, props.currentPosition.lng];
  if (meMarker) {
    meMarker.setLatLng(pos);
  } else {
    meMarker = L.marker(pos, { icon: meIcon() }).addTo(map);
  }
  if (taskMarker) {
    map.fitBounds([taskMarker.getLatLng(), pos], { padding: [40, 40], maxZoom: 16 });
  }
}

watch(() => props.currentPosition, () => syncMePosition());
watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  await initMap();
});
onBeforeUnmount(() => {
  map?.remove();
  map = null;
  taskMarker = null;
  meMarker = null;
});
</script>

<template>
  <USlideover v-model="isOpen" side="bottom" :ui="{ height: 'h-[70vh]' }">
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <h3 class="text-base font-semibold truncate">{{ task?.title }}</h3>
        <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
      </div>
      <div class="flex-1 min-h-0" style="isolation: isolate;">
        <div ref="mapEl" class="w-full h-full" />
      </div>
      <div v-if="task?.textAddress" class="px-4 py-2.5 border-t border-gray-100 text-sm text-gray-600 flex items-center gap-1.5 flex-shrink-0">
        <UIcon name="lucide:map-pin" class="w-4 h-4 flex-shrink-0 text-gray-400" />{{ task.textAddress }}
      </div>
      <div v-if="task?.lat && task?.lng" class="px-4 pb-4 pt-2 flex-shrink-0">
        <a
          :href="`https://2gis.kz/geo/${task.lng},${task.lat}`"
          target="_blank"
          class="flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-gray-700 px-3 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <UIcon name="lucide:external-link" class="w-4 h-4" />{{ t('tasks.zenOpenIn2gis') || 'Open in 2GIS' }}
        </a>
      </div>
    </div>
  </USlideover>
</template>
