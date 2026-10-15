<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
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

const VIEWS = computed<{ key: CalView; label: string }[]>(() => [
  { key: 'day', label: t('plans.viewDay') || 'День' },
  { key: 'week', label: t('plans.viewWeek') || 'Неделя' },
  { key: 'month', label: t('plans.viewMonth') || 'Месяц' },
]);
const view = ref<CalView>(['day', 'week', 'month'].includes(route.query.view as string) ? route.query.view as CalView : 'week');
const selectedDate = ref<string>(ymd(new Date()));
const selectedLocationId = ref<string>('');

const locationOptions = computed(() => locations.value.map(l => ({ label: l.name, value: l.id })));
const mastersForLocation = computed(() =>
  masters.value.filter(m => m.isActive && m.locationId === selectedLocationId.value).sort((a, b) => a.sortOrder - b.sortOrder));
const mastersById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m])));
const scopedBookings = computed(() => bookings.value.filter(b => b.locationId === selectedLocationId.value));

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
// Phone agenda: every booking of the visible period (day / week / month),
// grouped by day. It used to show only the selected day whatever the view
// switch said, so "Неделя" looked empty on a phone.
const agendaGroups = computed(() => {
  const sorted = scopedBookings.value
    .filter(b => b.status !== 'CANCELLED')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const map = new Map<string, typeof sorted>();
  for (const b of sorted) {
    const d = b.startAt.slice(0, 10);
    if (view.value === 'day' && d !== selectedDate.value) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(b);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
});
function fmtDayHead(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'long' });
}

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
    if (!silent) toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
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
    useAnalytics().track('plans_booking_created', { source: 'staff' });
    showCreate.value = false;
    toast.add({ title: t('common.success'), description: t('plans.bookingCreated') || 'Запись создана', color: 'emerald' });
    await loadBookings(true);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
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
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  }
}

function onPickDay(d: string) { selectedDate.value = d; view.value = 'day'; }

// --- live updates: WebSocket (bookingChanged) + a slow poll as safety net ---
const autoRefresh = ref(false); // live updates are opt-in; the choice is remembered
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
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
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
  <div class="at-scope ct-scope h-full flex flex-col p-4 min-h-0 gap-3">
    <PageHeader :title="t('app.plans')" :subtitle="t('plans.subtitle') || 'Онлайн-запись клиентов и расписание мастеров'" tour-title="plans-title">
      <template v-if="canManageCalendar" #primary>
        <button type="button" class="at-btn at-btn--primary" data-tour="plans-new-btn" @click="openCreate()">
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span class="hidden min-[440px]:inline">{{ t('plans.newBooking') || 'Новая запись' }}</span>
          <span class="sr-only min-[440px]:hidden">{{ t('plans.newBooking') || 'Новая запись' }}</span>
        </button>
      </template>
      <template #actions>
        <NuxtLink data-tour="plans-public-link" :to="`/to/${nsSlug}/plans`" target="_blank" class="at-btn !px-2.5 xl:!px-3.5" :aria-label="t('plans.openPublicPage') || 'Страница записи'" :title="t('plans.openPublicPage') || 'Страница записи'">
          <Icon name="lucide:external-link" class="h-4 w-4" /><span class="hidden xl:inline">{{ t('plans.openPublicPage') || 'Страница записи' }}</span>
        </NuxtLink>
        <NuxtLink v-if="isOwnerOrManager" data-tour="plans-settings-btn" :to="`/${nsSlug}/plans/settings`" class="at-btn !px-2.5" :aria-label="t('plans.settings') || 'Настройки'" :title="t('plans.settings') || 'Настройки'">
          <Icon name="lucide:settings" class="h-4 w-4" />
        </NuxtLink>
      </template>
    </PageHeader>

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
            aria-hidden="true"
            tabindex="-1"
          />
        </button>
        <UButton icon="lucide:chevron-right" size="xs" variant="ghost" color="gray" @click="shift(1)" />
      </div>
      <UButton size="xs" variant="soft" color="gray" :disabled="isToday" @click="goToday">
        {{ t('plans.today') || 'Сегодня' }}
      </UButton>

      <div data-tour="plans-views" class="at-seg">
        <button
          v-for="v in VIEWS" :key="v.key" type="button"
          class="at-seg__btn"
          :class="view === v.key ? 'at-seg__btn--on' : ''"
          @click="view = v.key"
        >{{ v.label }}</button>
      </div>

      <span class="hidden sm:block flex-1" />

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
        <span class="hidden sm:inline">{{ t('plans.live') || 'Онлайн' }}</span>
      </button>

      <USelectMenu
        v-if="locations.length > 1"
        v-model="selectedLocationId"
        :options="locationOptions" value-attribute="value" option-attribute="label"
        size="xs" icon="lucide:map-pin" class="min-w-[9rem]" :popper="{ strategy: 'fixed' }" />

    </div>

    <div v-if="booting" class="flex-1 min-h-0 overflow-hidden"><AppSkeleton variant="panel" :rows="2" /></div>

    <!-- First steps: nothing can be booked until there is at least one service. -->
    <div v-else-if="!notSetUp && !services.length" class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
      <UIcon name="lucide:sparkles" class="h-9 w-9 text-primary-500" />
      <div class="text-base font-semibold">{{ t('plans.firstStepsTitle') }}</div>
      <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('plans.firstStepsHint') }}</p>
      <NuxtLink :to="`/${nsSlug}/plans/catalog`" class="at-btn at-btn--primary"><UIcon name="lucide:plus" class="h-4 w-4" />{{ t('plans.firstStepsAction') }}</NuxtLink>
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
          <div v-if="loading && !bookings.length" class="py-4"><AppSkeleton variant="list" :rows="3" /></div>
          <div v-else-if="!agendaGroups.length" class="py-14 text-center text-gray-500 dark:text-gray-400">
            <UIcon name="lucide:calendar-x" class="w-9 h-9 mx-auto mb-2 opacity-60" />
            {{ t('plans.noBookingsForDay') || 'На этот день записей нет' }}
          </div>
          <template v-for="g in agendaGroups" :key="g.date">
            <div v-if="view !== 'day'" class="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 first:pt-0">
              {{ fmtDayHead(g.date) }}
            </div>
            <button
              v-for="b in g.items" :key="b.id" type="button"
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
                {{ ({ NEW: t('plans.statusNew'), CONFIRMED: t('plans.statusConfirmed'), COMPLETED: t('plans.statusCompleted'), CANCELLED: t('plans.statusCancelled'), NO_SHOW: t('plans.statusNoShow') } as any)[b.status] || b.status }}
              </UBadge>
            </button>
          </template>
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
