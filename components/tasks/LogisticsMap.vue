<script lang="ts" setup>
// Day route map for the Logistics page: one coloured, numbered pin per task
// (colour = courier, number = position in that courier's route) plus a
// dashed polyline per courier, so the route order reads at a glance.
import type { TaskItem } from '@/api/tasks/task/list';

const props = defineProps<{
  groups: { assigneeId: string | null; tasks: TaskItem[] }[];
  selectedId?: string | null;
}>();
const emit = defineEmits<{ (e: 'select', task: TaskItem): void }>();

// Distinct, colour-blind-friendly-ish palette; cycles for >8 couriers.
const PALETTE = ['#2563eb', '#059669', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
const NO_COURIER = '#9ca3af';

const DEFAULT_CENTER: [number, number] = [43.238293, 76.945465];
const el = ref<HTMLElement | null>(null);
let L: any = null;
let map: any = null;
let layer: any = null;
const markers = new Map<string, any>();

function colorFor(assigneeId: string | null, idx: number): string {
  return assigneeId ? PALETTE[idx % PALETTE.length] : NO_COURIER;
}

function pinIcon(num: number, color: string, selected: boolean) {
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:600 12px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);">${num}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function redraw() {
  if (!map || !L) return;
  layer?.clearLayers();
  markers.clear();
  const bounds: [number, number][] = [];
  props.groups.forEach((g, gi) => {
    const color = colorFor(g.assigneeId, gi);
    const line: [number, number][] = [];
    g.tasks.forEach((tk, i) => {
      if (tk.lat == null || tk.lng == null) return;
      const pos: [number, number] = [tk.lat, tk.lng];
      line.push(pos);
      bounds.push(pos);
      const m = L.marker(pos, { icon: pinIcon(i + 1, color, props.selectedId === tk.id) }).addTo(layer);
      m.bindTooltip(`<b>${i + 1}.</b> ${esc(tk.title)}${tk.textAddress ? `<br>${esc(tk.textAddress)}` : ''}`, { direction: 'top', offset: [0, -14] });
      m.on('click', () => emit('select', tk));
      markers.set(tk.id, m);
    });
    if (line.length > 1) L.polyline(line, { color, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(layer);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
}

onMounted(async () => {
  await import('leaflet/dist/leaflet.css');
  L = await import('leaflet');
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  map = L.map(el.value as HTMLElement).setView(DEFAULT_CENTER, 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
    className: 'issues-map-muted-tiles',
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  redraw();
  // The pane is display:none on the phone's "list" tab; re-measure when it shows.
  ro = new ResizeObserver(() => map?.invalidateSize());
  ro.observe(el.value as HTMLElement);
});
let ro: ResizeObserver | null = null;
onBeforeUnmount(() => { ro?.disconnect(); map?.remove(); });

watch(() => props.groups, redraw, { deep: true });
watch(() => props.selectedId, (id, prev) => {
  if (!L) return;
  props.groups.forEach((g, gi) => g.tasks.forEach((tk, i) => {
    if (tk.id !== id && tk.id !== prev) return;
    markers.get(tk.id)?.setIcon(pinIcon(i + 1, colorFor(g.assigneeId, gi), tk.id === id));
  }));
  const m = id ? markers.get(id) : null;
  if (m && map) map.panTo(m.getLatLng());
});

defineExpose({ colorFor });
</script>

<template>
  <!-- isolate: keeps Leaflet's z-indexes below the task slideover. -->
  <div style="isolation: isolate;" class="h-full w-full">
    <div ref="el" class="h-full w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800" />
  </div>
</template>

<style>
.issues-map-muted-tiles { filter: saturate(0.35) brightness(1.08) contrast(0.92); }
</style>
