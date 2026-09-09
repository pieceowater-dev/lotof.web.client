<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { usePlansToken } from '@/composables/usePlansToken';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { LSKeys } from '@/utils/storageKeys';
import { useOnboarding } from '@/composables/useOnboarding';
import { plansTour } from '@/config/tours';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import PlansCalendar from '@/components/plans/PlansCalendar.vue';
import BookingFormModal from '@/components/plans/BookingFormModal.vue';
import BookingDetailModal from '@/components/plans/BookingDetailModal.vue';
import {
  plansApi,
  type PlansBooking, type PlansLocation, type PlansService, type PlansMaster, type PlansWorkingHours,
} from '@/api/plans/ops';

type CalView = 'day' | 'week' | 'month';

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();
const { canManageCalendar, canSetBookingStatus, isOwnerOrManager } = usePlansStaffRole();

useHead(() => ({ title: titleBySlug(nsSlug.value) ? `${t('app.plans')} — ${titleBySlug(nsSlug.value)}` : t('app.plans') }));

const booting = ref(true);
const notSetUp = ref(false);
const loading = ref(false);
const locations = ref<PlansLocation[]>([]);
const services = ref<PlansService[]>([]);
const masters = ref<PlansMaster[]>([]);
const bookings = ref<PlansBooking[]>([]);
const serviceNames = ref<Record<string, string>>({});
const locationHours = ref<PlansWorkingHours[]>([]);

const VIEWS: { key: CalView; label: string }[] = [
  { key: 'day', label: t('plans.viewDay') || 'День' },
  { key: 'week', label: t('plans.viewWeek') || 'Неделя' },
  { key: 'month', label: t('plans.viewMonth') || 'Месяц' },
];
const view = ref<CalView>(['day', 'week', 'month'].includes(route.query.view as string) ? route.query.view as CalView : 'week');
const selectedDate = ref<string>(ymd(new Date()));
const selectedLocationId = ref<string>('');

const locationOptions = computed(() => locations.value.map(l => ({ label: l.name, value: l.id })));
const mastersForLocation = computed(() =>
  masters.value.filter(m => m.isActive && m.locationId === selectedLocationId.value).sort((a, b) => a.sortOrder - b.sortOrder));
const mastersById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m])));
const scopedBookings = computed(() => bookings.value.filter(b => b.locationId === selectedLocationId.value));
const dayBookings = computed(() =>
  scopedBookings.value.filter(b => b.status !== 'CANCELLED' && b.startAt.slice(0, 10) === selectedDate.value));

function mondayOf(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
// visible fetch range per view (month view grabs the padded 6-week grid)
const range = computed(() => {
  const anchor = new Date(selectedDate.value + 'T00:00:00');
  if (view.value === 'day') {
    const s = new Date(anchor); const e = new Date(anchor); e.setDate(e.getDate() + 1);
    return { start: s, end: e };
  }
  if (view.value === 'week') {
    const s = mondayOf(selectedDate.value); const e = new Date(s); e.setDate(e.getDate() + 7);
    return { start: s, end: e };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const s = mondayOf(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`);
  const e = new Date(s); e.setDate(e.getDate() + 42);
  return { start: s, end: e };
});

const gridHours = computed(() => {
  const rows = locationHours.value.filter(h => !h.isDayOff);
  if (!rows.length) return { start: 8, end: 21 };
  const startH = (s: string) => parseInt(s.slice(0, 2), 10);
  const endCeilH = (s: string) => Math.ceil((parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10)) / 60);
  const start = Math.max(0, Math.min(...rows.map(r => startH(r.startTime))));
  const end = Math.min(24, Math.max(start + 4, ...rows.map(r => endCeilH(r.endTime))));
  return { start, end };
});

const rangeLabel = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00');
  if (view.value === 'day') return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
  if (view.value === 'month') return d.toLocaleDateString('ru', { month: 'long', year: 'numeric' });
  const s = mondayOf(selectedDate.value); const e = new Date(s); e.setDate(e.getDate() + 6);
  return `${s.toLocaleDateString('ru', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}`;
});
const isToday = computed(() => selectedDate.value === ymd(new Date()));

function shift(dir: number) {
  const dt = new Date(selectedDate.value + 'T00:00:00');
  if (view.value === 'day') dt.setDate(dt.getDate() + dir);
  else if (view.value === 'week') dt.setDate(dt.getDate() + dir * 7);
  else dt.setMonth(dt.getMonth() + dir);
  selectedDate.value = ymd(dt);
}
function goToday() { selectedDate.value = ymd(new Date()); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }

const dateInput = ref<HTMLInputElement | null>(null);
function openDatePicker() {
  const el = dateInput.value;
  if (!el) return;
  // Chromium exposes showPicker(); Safari/FF fall back to focus+click
  try { (el as any).showPicker ? (el as any).showPicker() : el.click(); } catch { el.click(); }
}

async function loadRefs() {
  const [locs, svcs, msts] = await Promise.all([
    plansApi.locations(nsSlug.value, false),
    plansApi.services(nsSlug.value, false),
    plansApi.masters(nsSlug.value, false),
  ]);
  locations.value = locs; services.value = svcs; masters.value = msts;
  if (!locs.length) {
    // first-run: only an owner/manager can actually set things up
    if (isOwnerOrManager.value) { await navigateTo(`/${nsSlug.value}/plans/onboarding`); return false; }
    notSetUp.value = true;
    return false;
  }
  if (!selectedLocationId.value || !locs.some(l => l.id === selectedLocationId.value)) {
    selectedLocationId.value = locs.find(l => l.isPrimary)?.id || locs[0].id;
  }
  return true;
}
async function loadLocationHours() {
  if (!selectedLocationId.value) return;
  try { locationHours.value = await plansApi.locationWorkingHours(nsSlug.value, selectedLocationId.value); }
  catch { locationHours.value = []; }
}
async function loadBookings(silent = false) {
  if (!silent) loading.value = true;
  try {
    const res = await plansApi.bookings(nsSlug.value, { from: range.value.start.toISOString(), to: range.value.end.toISOString(), length: 800 });
    bookings.value = res.rows.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
    const ids = bookings.value.map(b => b.id);
    if (ids.length) {
      const lines = await plansApi.bookingServicesByBookings(nsSlug.value, ids);
      const byB: Record<string, string[]> = {};
      for (const l of lines) (byB[l.bookingId] ||= []).push(l.serviceName);
      serviceNames.value = Object.fromEntries(Object.entries(byB).map(([k, v]) => [k, v.join(', ')]));
    } else {
      serviceNames.value = {};
    }
  } catch (e) {
    logError('[plans/index] loadBookings', e);
    if (!silent) toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally {
    if (!silent) loading.value = false;
  }
}

// --- create ---
const showCreate = ref(false);
const creating = ref(false);
const createPreset = ref<{ locationId?: string; masterId?: string; startAt?: string } | null>(null);
function openCreate(preset?: { masterId?: string; startAt?: string }) {
  createPreset.value = { locationId: selectedLocationId.value, ...(preset || {}) };
  showCreate.value = true;
}
async function submitCreate(payload: any) {
  creating.value = true;
  try {
    await plansApi.createBooking(nsSlug.value, payload);
    showCreate.value = false;
    toast.add({ title: t('common.success'), description: t('plans.bookingCreated') || 'Запись создана', color: 'emerald' });
    await loadBookings(true);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally {
    creating.value = false;
  }
}

// --- detail ---
const showDetail = ref(false);
const detailBooking = ref<PlansBooking | null>(null);
function openDetail(b: PlansBooking) { detailBooking.value = b; showDetail.value = true; }

// --- drag reschedule ---
async function onReschedule(p: { booking: PlansBooking; startAt: string; masterId: string | null }) {
  const prev = bookings.value;
  try {
    await plansApi.rescheduleBooking(nsSlug.value, p.booking.id, p.startAt, p.masterId || undefined);
    toast.add({ title: t('plans.rescheduled') || 'Запись перенесена', color: 'emerald' });
    await loadBookings(true);
  } catch (e) {
    bookings.value = prev;
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  }
}

function onPickDay(d: string) { selectedDate.value = d; view.value = 'day'; }

// --- live updates: WebSocket (bookingChanged) + a slow poll as safety net ---
const autoRefresh = ref(true);
const liveConnected = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsDispose: (() => void) | null = null;
let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

function readAutoRefreshPref() {
  try { const v = localStorage.getItem(LSKeys.PLANS_CAL_AUTOREFRESH); if (v !== null) autoRefresh.value = v === '1'; } catch {}
}
function queueReload() {
  if (reloadDebounce) clearTimeout(reloadDebounce);
  reloadDebounce = setTimeout(() => { if (!showCreate.value) loadBookings(true); }, 400);
}
async function startLive() {
  stopLive();
  if (!autoRefresh.value) return;
  // slow safety-net poll (2 min) in case a WS event is missed or the socket drops
  pollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (showCreate.value || showDetail.value) return;
    loadBookings(true);
  }, 120000);
  try {
    const token = usePlansToken().current();
    if (!token) return;
    const { subscribeBookingChanged } = await import('@/api/plans/subscriptions');
    wsDispose = subscribeBookingChanged(token, nsSlug.value, () => { liveConnected.value = true; queueReload(); }, () => { liveConnected.value = false; });
    liveConnected.value = true;
  } catch { liveConnected.value = false; }
}
function stopLive() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (wsDispose) { wsDispose(); wsDispose = null; }
  liveConnected.value = false;
}
watch(autoRefresh, (v) => {
  try { localStorage.setItem(LSKeys.PLANS_CAL_AUTOREFRESH, v ? '1' : '0'); } catch {}
  startLive();
});

onMounted(async () => {
  readAutoRefreshPref();
  try {
    await getToken(nsSlug.value);
    if (await loadRefs()) { await loadLocationHours(); await loadBookings(); }
  } catch (e) {
    logError('[plans/index] boot', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally {
    booting.value = false;
    startLive();
    maybeStartTour();
  }
});

// Auto-run the intro tour right after onboarding (?tour=1) or on a fresh
// calendar the owner hasn't toured yet.
function maybeStartTour() {
  const { isCompleted, startTour } = useOnboarding();
  const asked = route.query.tour === '1';
  if (isCompleted(plansTour.id) && !asked) return;
  if (!isOwnerOrManager.value) return;
  if (!asked && bookings.value.length) return;
  setTimeout(() => startTour(plansTour), asked ? 700 : 1200);
  if (asked) navigateTo({ query: {} }, { replace: true });
}
onBeforeUnmount(stopLive);
watch([selectedDate, view], () => loadBookings());
watch(selectedLocationId, async () => { await loadLocationHours(); await loadBookings(); });
</script>

<template>
  <div class="h-full flex flex-col p-4 min-h-0 gap-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center flex-shrink-0">
      <div class="min-w-0">
        <h1 data-tour="plans-title" class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('app.plans') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ t('plans.subtitle') || 'Онлайн-запись клиентов и расписание мастеров' }}
        </p>
      </div>
      <div class="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
        <UButton
          data-tour="plans-public-link" icon="lucide:external-link" size="xs" color="gray" variant="soft"
          :to="`/to/${nsSlug}/plans`" target="_blank"
        >
          {{ t('plans.openPublicPage') || 'Страница записи' }}
        </UButton>
        <UButton
          v-if="isOwnerOrManager" data-tour="plans-settings-btn" icon="lucide:settings" size="xs" color="primary" variant="soft"
          :to="`/${nsSlug}/plans/settings`"
        >
          {{ t('plans.settings') || 'Настройки' }}
        </UButton>
      </div>
    </div>

    <div class="flex-shrink-0"><PlansNavTabs /></div>

    <!-- toolbar -->
    <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
      <div class="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <UButton icon="lucide:chevron-left" size="xs" variant="ghost" color="gray" @click="shift(-1)" />
        <button
          class="relative px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 capitalize min-w-[10rem] text-center hover:bg-gray-50 dark:hover:bg-gray-800/60"
          @click="openDatePicker"
        >
          {{ rangeLabel }}
          <input
            ref="dateInput" type="date" v-model="selectedDate"
            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            tabindex="-1"
          />
        </button>
        <UButton icon="lucide:chevron-right" size="xs" variant="ghost" color="gray" @click="shift(1)" />
      </div>
      <UButton size="xs" variant="soft" color="gray" :disabled="isToday" @click="goToday">
        {{ t('plans.today') || 'Сегодня' }}
      </UButton>

      <div data-tour="plans-views" class="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5">
        <button
          v-for="v in VIEWS" :key="v.key" type="button"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
          :class="view === v.key ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="view = v.key"
        >{{ v.label }}</button>
      </div>

      <span class="flex-1" />

      <button
        type="button"
        data-tour="plans-live"
        class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors"
        :class="autoRefresh
          ? 'border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40'
          : 'border-gray-200 dark:border-gray-800 text-gray-500'"
        :title="autoRefresh ? (t('plans.liveOn') || 'Живые обновления включены') : (t('plans.liveOff') || 'Живые обновления выключены')"
        @click="autoRefresh = !autoRefresh"
      >
        <span v-if="autoRefresh" class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" :class="liveConnected ? 'bg-emerald-400' : 'bg-amber-400'" />
          <span class="relative inline-flex h-2 w-2 rounded-full" :class="liveConnected ? 'bg-emerald-500' : 'bg-amber-500'" />
        </span>
        <UIcon v-else name="lucide:wifi-off" class="w-3.5 h-3.5" />
        <span class="hidden md:inline">{{ t('plans.live') || 'Онлайн' }}</span>
      </button>

      <USelectMenu
        v-if="locations.length > 1"
        v-model="selectedLocationId"
        :options="locationOptions" value-attribute="value" option-attribute="label"
        size="xs" icon="lucide:map-pin" class="min-w-[9rem]" :popper="{ strategy: 'fixed' }" />

      <UButton v-if="canManageCalendar" data-tour="plans-new-btn" icon="lucide:plus" size="xs" @click="openCreate()">
        {{ t('plans.newBooking') || 'Новая запись' }}
      </UButton>
    </div>

    <div v-if="booting" class="flex-1 flex justify-center items-center">
      <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
    </div>

    <div v-else-if="notSetUp"
         class="flex-1 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 p-8">
      <UIcon name="lucide:calendar-clock" class="w-9 h-9 mb-2 opacity-60" />
      <p>{{ t('plans.notSetUp') || 'Онлайн-запись ещё не настроена. Обратитесь к владельцу аккаунта.' }}</p>
    </div>

    <!-- The calendar renders even with zero masters: day view falls back to a
         single "Без мастера" column (resource-style bookings — courts, bays,
         fields), week view is by weekday. Masters are optional, not required. -->
    <template v-else>
        <!-- desktop / tablet -->
        <div class="hidden sm:block flex-1 min-h-0 relative">
          <PlansCalendar
            :view="view"
            :date="selectedDate"
            :masters="mastersForLocation"
            :bookings="scopedBookings"
            :service-names="serviceNames"
            :start-hour="gridHours.start"
            :end-hour="gridHours.end"
            :can-manage="canManageCalendar"
            @select="openDetail"
            @create-at="(p) => openCreate(p)"
            @pick-day="onPickDay"
            @reschedule="onReschedule"
          />
        </div>

        <!-- mobile: agenda for the selected day -->
        <div class="sm:hidden flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
          <div v-if="loading && !bookings.length" class="py-10 flex justify-center">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
          </div>
          <div v-else-if="!dayBookings.length" class="py-14 text-center text-gray-500 dark:text-gray-400">
            <UIcon name="lucide:calendar-x" class="w-9 h-9 mx-auto mb-2 opacity-60" />
            {{ t('plans.noBookingsForDay') || 'На этот день записей нет' }}
          </div>
          <button
            v-for="b in dayBookings" :key="b.id" type="button"
            class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3 text-left"
            @click="openDetail(b)"
          >
            <div class="font-mono text-sm font-semibold w-14 flex-shrink-0">{{ fmtTime(b.startAt) }}</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">{{ b.clientName }}</div>
              <div class="text-xs text-gray-500 truncate">
                {{ serviceNames[b.id] || '' }}<span v-if="b.masterId"> · {{ mastersById[b.masterId]?.name }}</span>
              </div>
            </div>
            <UBadge :color="({ NEW:'blue', CONFIRMED:'primary', COMPLETED:'emerald', NO_SHOW:'amber' } as any)[b.status] || 'gray'" variant="subtle" size="xs">
              {{ ({ NEW:'Новая', CONFIRMED:'Подтв.', COMPLETED:'Готово', NO_SHOW:'Не пришёл' } as any)[b.status] || b.status }}
            </UBadge>
          </button>
        </div>
    </template>

    <BookingFormModal
      v-model="showCreate"
      :ns-slug="nsSlug"
      :date="createPreset?.startAt ? createPreset.startAt.slice(0,10) : selectedDate"
      :locations="locations"
      :services="services"
      :masters="masters"
      :preset="createPreset"
      :saving="creating"
      @submit="submitCreate"
    />

    <BookingDetailModal
      v-model="showDetail"
      :ns-slug="nsSlug"
      :booking="detailBooking"
      :master="detailBooking?.masterId ? (mastersById[detailBooking.masterId] || null) : null"
      :masters="mastersForLocation"
      :service-name="detailBooking ? serviceNames[detailBooking.id] : ''"
      :can-manage="canManageCalendar"
      :can-set-status="canSetBookingStatus"
      @changed="loadBookings(true)"
    />
  </div>
</template>
