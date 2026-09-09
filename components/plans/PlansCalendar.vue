<script lang="ts" setup>
// Apple-Calendar-style calendar for lota Plans.
//  view="day"   -> time grid, one column per master (+ "no master")
//  view="week"  -> time grid, one column per weekday
//  view="month" -> month grid, day cells with booking chips
// Fills its parent's height; only the inner body scrolls (never the page).
// Blocks in day/week can be dragged to reschedule (emits "reschedule").
import { useI18n } from '@/composables/useI18n';
import type { PlansBooking, PlansMaster } from '@/api/plans/ops';

const props = withDefaults(defineProps<{
  view: 'day' | 'week' | 'month';
  date: string;                                   // YYYY-MM-DD (anchor)
  masters: PlansMaster[];
  bookings: PlansBooking[];                        // scoped to the visible range + location
  serviceNames?: Record<string, string>;
  startHour?: number;
  endHour?: number;
  now?: Date;
  canManage?: boolean;
}>(), { serviceNames: () => ({}), startHour: 8, endHour: 21, canManage: false });

const emit = defineEmits<{
  (e: 'select', booking: PlansBooking): void;
  (e: 'createAt', payload: { masterId: string; startAt: string }): void;
  (e: 'pickDay', date: string): void;
  (e: 'reschedule', payload: { booking: PlansBooking; startAt: string; masterId: string | null }): void;
}>();

const { t } = useI18n();

const PX_PER_MIN = computed(() => (props.view === 'week' ? 1.3 : 1.7));
const SNAP_MIN = 15;
const gridStartMin = computed(() => props.startHour * 60);
const gridEndMin = computed(() => props.endHour * 60);
const gridHeight = computed(() => (gridEndMin.value - gridStartMin.value) * PX_PER_MIN.value);
const hourMarks = computed(() => {
  const out: number[] = [];
  for (let h = props.startHour; h <= props.endHour; h++) out.push(h);
  return out;
});
const mastersById = computed(() => Object.fromEntries(props.masters.map(m => [m.id, m])));

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localYmd(iso: string) { return ymd(new Date(iso)); }
function minutesOf(iso: string) { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
function fmt(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }
function mondayOf(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const STATUS_STYLE: Record<string, { bar: string; bg: string; text: string; dot: string }> = {
  NEW:       { bar: '#3b82f6', bg: 'rgba(59,130,246,.13)', text: '#1d4ed8', dot: '#3b82f6' },
  CONFIRMED: { bar: '#7c3aed', bg: 'rgba(124,58,237,.13)', text: '#6d28d9', dot: '#7c3aed' },
  COMPLETED: { bar: '#10b981', bg: 'rgba(16,185,129,.13)', text: '#047857', dot: '#10b981' },
  NO_SHOW:   { bar: '#f59e0b', bg: 'rgba(245,158,11,.13)', text: '#b45309', dot: '#f59e0b' },
};
const styleFor = (s: string) => STATUS_STYLE[s] || STATUS_STYLE.NEW;

// ======================= day / week (time grid) =========================
interface Col { key: string; title: string; sub?: string; date: string; masterId: string | null; color?: string; isToday?: boolean; }

const columns = computed<Col[]>(() => {
  const todayStr = ymd(props.now ?? new Date());
  if (props.view === 'day') {
    return [
      ...props.masters.map(m => ({ key: m.id, title: m.name, color: m.color || '#7c3aed', date: props.date, masterId: m.id })),
      { key: '__none__', title: t('plans.anyMaster') || 'Без мастера', color: '#94a3b8', date: props.date, masterId: null },
    ];
  }
  const mon = mondayOf(props.date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const s = ymd(d);
    return {
      key: s, date: s, masterId: null,
      title: d.toLocaleDateString('ru', { weekday: 'short' }),
      sub: d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }),
      isToday: s === todayStr,
    };
  });
});

interface Positioned { b: PlansBooking; top: number; height: number; lane: number; lanes: number; }
function layout(list: PlansBooking[]): Positioned[] {
  const items = list.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
  const laneEnds: number[] = [];
  const placed = items.map((b) => {
    const s = minutesOf(b.startAt);
    const e = Math.max(minutesOf(b.endAt), s + 10);
    let lane = laneEnds.findIndex(end => end <= s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); } else { laneEnds[lane] = e; }
    return { b, s, e, lane };
  });
  return placed.map((p) => {
    const overlapping = placed.filter(q => q.s < p.e && q.e > p.s);
    return {
      b: p.b,
      top: Math.max(0, (p.s - gridStartMin.value) * PX_PER_MIN.value),
      height: Math.max(20, (p.e - p.s) * PX_PER_MIN.value - 2),
      lane: p.lane,
      lanes: Math.max(...overlapping.map(q => q.lane)) + 1,
    };
  });
}
const columnBlocks = computed(() => Object.fromEntries(columns.value.map((c) => {
  const list = props.bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    return props.view === 'day' ? (b.masterId || null) === c.masterId : localYmd(b.startAt) === c.date;
  });
  return [c.key, layout(list)];
})));

function nowTopFor(dateStr: string) {
  const n = props.now ?? new Date();
  if (ymd(n) !== dateStr) return null;
  const m = n.getHours() * 60 + n.getMinutes();
  if (m < gridStartMin.value || m > gridEndMin.value) return null;
  return (m - gridStartMin.value) * PX_PER_MIN.value;
}
const dayNowTop = computed(() => (props.view === 'day' ? nowTopFor(props.date) : null));

// ---- drag to reschedule (day/week) ----
// A single floating "ghost" follows the pointer on BOTH axes: X snaps to a
// column (master in day view / weekday in week view), Y snaps to a 15-min
// time slot. The real block just dims while its own ghost is live.
const gridInnerRef = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const drag = ref<{
  booking: PlansBooking;
  startX: number; startY: number; moved: boolean;
  colIdx: number; startMin: number; durMin: number;
} | null>(null);

function onBlockPointerDown(ev: PointerEvent, b: PlansBooking) {
  if (!props.canManage || props.view === 'month') return;
  if (b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW') return;
  drag.value = {
    booking: b,
    startX: ev.clientX, startY: ev.clientY, moved: false,
    colIdx: Math.max(0, columns.value.findIndex(c => (props.view === 'day' ? (b.masterId || null) === c.masterId : localYmd(b.startAt) === c.date))),
    startMin: minutesOf(b.startAt),
    durMin: Math.max(15, minutesOf(b.endAt) - minutesOf(b.startAt)),
  };
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
}
function onDragMove(ev: PointerEvent) {
  const d = drag.value; if (!d) return;
  if (!d.moved && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 4) return;
  d.moved = true;
  ev.preventDefault();
  const el = gridInnerRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const colW = (r.width - 56) / columns.value.length;

  // X → column (master / weekday)
  const rawCol = Math.floor((ev.clientX - r.left - 56) / colW);
  d.colIdx = Math.max(0, Math.min(columns.value.length - 1, rawCol));

  // Y → start minute. newTop = original block top + how far the pointer moved
  // vertically since grab; the grid rect cancels out so scrolling mid-drag is
  // harmless.
  const origTopPx = (minutesOf(d.booking.startAt) - gridStartMin.value) * PX_PER_MIN.value;
  const newTopPx = origTopPx + (ev.clientY - d.startY);
  let m = gridStartMin.value + Math.round((newTopPx / PX_PER_MIN.value) / SNAP_MIN) * SNAP_MIN;
  m = Math.max(gridStartMin.value, Math.min(gridEndMin.value - d.durMin, m));
  d.startMin = m;
}

// set for one tick after a real drag so the synthetic click that follows
// pointerup doesn't fall through to onColumnClick (opening the create modal)
const suppressClick = ref(false);

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  const d = drag.value; drag.value = null;
  if (!d) return;
  if (!d.moved) { emit('select', d.booking); return; }
  suppressClick.value = true;
  setTimeout(() => { suppressClick.value = false; }, 0);
  const col = columns.value[d.colIdx];
  const base = new Date(col.date + 'T00:00:00');
  base.setMinutes(d.startMin);
  const startAt = base.toISOString();
  const sameTime = Math.abs(d.startMin - minutesOf(d.booking.startAt)) < 1 && col.date === localYmd(d.booking.startAt);
  const newMasterId = props.view === 'day' ? col.masterId : (d.booking.masterId || null);
  const sameMaster = newMasterId === (d.booking.masterId || null);
  if (sameTime && sameMaster) return;
  emit('reschedule', { booking: d.booking, startAt, masterId: newMasterId });
}

const ghostStyle = computed(() => {
  const d = drag.value;
  if (!d || !d.moved) return null;
  const n = columns.value.length;
  const st = styleFor(d.booking.status);
  return {
    top: (d.startMin - gridStartMin.value) * PX_PER_MIN.value + 'px',
    height: Math.max(20, d.durMin * PX_PER_MIN.value - 2) + 'px',
    left: `calc(56px + ${d.colIdx} * (100% - 56px) / ${n} + 2px)`,
    width: `calc((100% - 56px) / ${n} - 4px)`,
    background: st.bg,
    borderLeft: `3px solid ${st.bar}`,
    color: st.text,
  } as Record<string, string>;
});
const ghostTime = computed(() => {
  const d = drag.value;
  if (!d) return '';
  const base = new Date((columns.value[d.colIdx]?.date || props.date) + 'T00:00:00');
  base.setMinutes(d.startMin);
  return base.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
});
const dragColKey = computed(() => (drag.value?.moved ? columns.value[drag.value.colIdx]?.key : null));
const draggingId = computed(() => (drag.value?.moved ? drag.value.booking.id : null));

function onColumnClick(ev: MouseEvent, col: Col) {
  if (drag.value || suppressClick.value) return;
  const el = gridInnerRef.value;
  const top = el ? el.getBoundingClientRect().top : (ev.currentTarget as HTMLElement).getBoundingClientRect().top;
  const y = ev.clientY - top;
  let minute = gridStartMin.value + Math.round((y / PX_PER_MIN.value) / SNAP_MIN) * SNAP_MIN;
  minute = Math.max(gridStartMin.value, Math.min(gridEndMin.value - SNAP_MIN, minute));
  const dd = new Date(col.date + 'T00:00:00'); dd.setMinutes(minute);
  emit('createAt', { masterId: col.masterId || '', startAt: dd.toISOString() });
}

// auto-scroll the time grid to ~now
function scrollToRelevant() {
  const el = bodyEl.value; if (!el) return;
  const n = props.now ?? new Date();
  const nowMin = n.getHours() * 60 + n.getMinutes();
  const target = Math.max(gridStartMin.value, Math.min(nowMin - 60, gridEndMin.value - 120));
  el.scrollTop = Math.max(0, (target - gridStartMin.value) * PX_PER_MIN.value);
}
onMounted(() => nextTick(scrollToRelevant));
watch(() => [props.view, props.date], () => nextTick(scrollToRelevant));

// ============================== month =================================
const monthWeeks = computed(() => {
  if (props.view !== 'month') return [];
  const anchor = new Date(props.date + 'T00:00:00');
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(ymd(first));
  const weeks: { date: string; day: number; inMonth: boolean; isToday: boolean }[][] = [];
  const todayStr = ymd(props.now ?? new Date());
  const cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row: { date: string; day: number; inMonth: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const s = ymd(cur);
      row.push({ date: s, day: cur.getDate(), inMonth: cur.getMonth() === anchor.getMonth(), isToday: s === todayStr });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
});
const bookingsByDay = computed(() => {
  const map: Record<string, PlansBooking[]> = {};
  for (const b of props.bookings) {
    if (b.status === 'CANCELLED') continue;
    (map[localYmd(b.startAt)] ||= []).push(b);
  }
  for (const k in map) map[k].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return map;
});
const weekdayHeads = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
</script>

<template>
  <div class="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
    <!-- ================= MONTH ================= -->
    <template v-if="view === 'month'">
      <div class="flex-shrink-0 grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        <div v-for="wd in weekdayHeads" :key="wd" class="py-2 text-center text-xs font-medium text-gray-500">{{ wd }}</div>
      </div>
      <div class="flex-1 min-h-0 grid grid-rows-6">
        <div v-for="(week, wi) in monthWeeks" :key="wi" class="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800/70 last:border-b-0 min-h-0">
          <button
            v-for="cell in week" :key="cell.date" type="button"
            class="border-r border-gray-100 dark:border-gray-800/70 last:border-r-0 p-1 text-left flex flex-col gap-0.5 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
            :class="!cell.inMonth && 'bg-gray-50/50 dark:bg-gray-950/30'"
            @click="emit('pickDay', cell.date)"
          >
            <span class="text-[11px] font-semibold self-end w-6 h-6 flex items-center justify-center rounded-full"
                  :class="cell.isToday ? 'bg-primary-500 text-white' : cell.inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'">
              {{ cell.day }}
            </span>
            <span
              v-for="b in (bookingsByDay[cell.date] || []).slice(0, 3)" :key="b.id"
              class="text-[10px] leading-tight truncate rounded px-1 py-0.5"
              :style="{ background: styleFor(b.status).bg, color: styleFor(b.status).text }"
              @click.stop="emit('select', b)"
            >{{ fmt(b.startAt) }} {{ b.clientName }}</span>
            <span v-if="(bookingsByDay[cell.date] || []).length > 3" class="text-[10px] text-gray-400 px-1">
              +{{ (bookingsByDay[cell.date] || []).length - 3 }}
            </span>
          </button>
        </div>
      </div>
    </template>

    <!-- ============== DAY / WEEK (time grid) ============== -->
    <template v-else>
      <div class="flex-shrink-0 grid border-b border-gray-200 dark:border-gray-800"
           :style="{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))` }">
        <div class="py-2" />
        <button
          v-for="c in columns" :key="c.key" type="button"
          class="py-2 px-2 text-center border-l border-gray-100 dark:border-gray-800 transition-colors"
          :class="[view === 'week' && 'hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer', c.isToday && 'bg-primary-50/60 dark:bg-primary-950/30']"
          @click="view === 'week' ? emit('pickDay', c.date) : null"
        >
          <div class="flex items-center justify-center gap-1.5">
            <span v-if="c.color && view === 'day'" class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: c.color }" />
            <span class="text-sm font-medium capitalize truncate"
                  :class="c.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-800 dark:text-gray-100'">{{ c.title }}</span>
          </div>
          <div v-if="c.sub" class="text-[11px] tabular-nums" :class="c.isToday ? 'text-primary-500' : 'text-gray-400'">{{ c.sub }}</div>
        </button>
      </div>

      <div ref="bodyEl" class="flex-1 min-h-0 overflow-y-auto">
        <div ref="gridInnerRef" class="grid relative"
             :style="{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))`, height: gridHeight + 'px' }">
          <div class="relative">
            <div v-for="h in hourMarks" :key="h"
                 class="absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums text-gray-400 select-none"
                 :style="{ top: (h * 60 - gridStartMin) * PX_PER_MIN + 'px' }">{{ String(h).padStart(2, '0') }}:00</div>
          </div>

          <div v-for="c in columns" :key="c.key"
               class="relative border-l border-gray-100 dark:border-gray-800 cursor-copy"
               :class="[c.isToday && 'bg-primary-50/30 dark:bg-primary-950/20', dragColKey === c.key && 'bg-primary-100/40 dark:bg-primary-900/20']"
               @click="onColumnClick($event, c)">
            <div v-for="h in hourMarks" :key="h" class="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800/70"
                 :style="{ top: (h * 60 - gridStartMin) * PX_PER_MIN + 'px' }" />
            <div v-for="h in hourMarks" :key="'half' + h" class="absolute inset-x-0 border-t border-dashed border-gray-100/60 dark:border-gray-800/40"
                 :style="{ top: (h * 60 + 30 - gridStartMin) * PX_PER_MIN + 'px' }" />

            <div
              v-for="p in columnBlocks[c.key]" :key="p.b.id"
              class="absolute rounded-md text-left px-1.5 py-1 overflow-hidden ring-1 ring-black/5 hover:ring-2 hover:ring-primary-400 transition-shadow"
              :class="[
                canManage && !['COMPLETED','CANCELLED','NO_SHOW'].includes(p.b.status) ? 'cursor-grab active:cursor-grabbing touch-none select-none' : 'cursor-pointer',
                draggingId === p.b.id && 'opacity-30',
              ]"
              :style="{
                top: p.top + 'px', height: p.height + 'px',
                left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`, width: `calc(${100 / p.lanes}% - 4px)`,
                background: styleFor(p.b.status).bg, borderLeft: `3px solid ${styleFor(p.b.status).bar}`,
              }"
              @pointerdown="onBlockPointerDown($event, p.b)"
              @click.stop="(drag && drag.moved) || suppressClick ? null : emit('select', p.b)"
            >
              <div class="flex items-center gap-1 text-[11px] font-semibold leading-tight tabular-nums" :style="{ color: styleFor(p.b.status).text }">
                <span v-if="view === 'week' && p.b.masterId" class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: mastersById[p.b.masterId]?.color || '#94a3b8' }" />
                {{ fmt(p.b.startAt) }}
              </div>
              <div class="text-[12px] font-medium text-gray-900 dark:text-gray-100 leading-tight truncate">{{ p.b.clientName }}</div>
              <div v-if="p.height > 40" class="text-[11px] text-gray-500 dark:text-gray-400 leading-tight truncate">
                {{ serviceNames[p.b.id] || (view === 'week' ? (mastersById[p.b.masterId || '']?.name || '') : '') }}
              </div>
            </div>
          </div>

          <!-- drag ghost: follows the pointer on both axes, snaps to column + 15 min -->
          <div v-if="ghostStyle" class="absolute rounded-md px-1.5 py-1 overflow-hidden pointer-events-none z-50 ring-2 ring-primary-500"
               :style="{ ...ghostStyle, boxShadow: '0 10px 28px rgba(0,0,0,.22)' }">
            <div class="text-[11px] font-bold leading-tight tabular-nums">{{ ghostTime }}</div>
            <div class="text-[12px] font-medium text-gray-900 dark:text-gray-100 leading-tight truncate">{{ drag?.booking.clientName }}</div>
          </div>

          <div v-if="dayNowTop !== null" class="absolute inset-x-0 z-20 pointer-events-none" :style="{ top: dayNowTop + 'px' }">
            <div class="h-px bg-red-500 ml-14" />
            <div class="absolute left-[52px] -top-1 w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
