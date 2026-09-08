<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import {
  plansApi,
  type PlansBooking, type PlansLocation, type PlansService, type PlansMaster, type PlansAvailableSlot,
} from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();
const { canManageCalendar } = usePlansStaffRole();

useHead(() => ({ title: titleBySlug(nsSlug.value) ? `${t('app.plans')} — ${titleBySlug(nsSlug.value)}` : t('app.plans') }));

const loading = ref(true);
const locations = ref<PlansLocation[]>([]);
const services = ref<PlansService[]>([]);
const masters = ref<PlansMaster[]>([]);
const bookings = ref<PlansBooking[]>([]);
const selectedDate = ref<string>(new Date().toISOString().slice(0, 10));

const mastersById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m])));
const dayStart = computed(() => new Date(`${selectedDate.value}T00:00:00`));
const dayEnd = computed(() => new Date(`${selectedDate.value}T00:00:00`).getTime() + 86400000);

async function loadRefs() {
  try {
    const [locs, svcs, msts] = await Promise.all([
      plansApi.locations(nsSlug.value, false),
      plansApi.services(nsSlug.value, false),
      plansApi.masters(nsSlug.value, false),
    ]);
    locations.value = locs;
    services.value = svcs;
    masters.value = msts;
    if (!locs.length) return navigateTo(`/${nsSlug.value}/plans/onboarding`);
  } catch (e) {
    logError('[plans/index] loadRefs', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  }
}

async function loadBookings() {
  loading.value = true;
  try {
    const from = new Date(`${selectedDate.value}T00:00:00`).toISOString();
    const to = new Date(dayEnd.value).toISOString();
    const res = await plansApi.bookings(nsSlug.value, { from, to, length: 200 });
    bookings.value = res.rows.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
  } catch (e) {
    logError('[plans/index] loadBookings', e);
  } finally {
    loading.value = false;
  }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function shiftDay(d: number) {
  const dt = new Date(`${selectedDate.value}T00:00:00`);
  dt.setDate(dt.getDate() + d);
  selectedDate.value = dt.toISOString().slice(0, 10);
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Новая', color: 'blue' },
  CONFIRMED: { label: 'Подтверждена', color: 'primary' },
  COMPLETED: { label: 'Завершена', color: 'emerald' },
  CANCELLED: { label: 'Отменена', color: 'red' },
  NO_SHOW: { label: 'Не пришёл', color: 'amber' },
};
function nextStatuses(s: string): string[] {
  if (s === 'NEW') return ['CONFIRMED', 'CANCELLED'];
  if (s === 'CONFIRMED') return ['COMPLETED', 'NO_SHOW', 'CANCELLED'];
  return [];
}
async function setStatus(b: PlansBooking, status: string) {
  try {
    await plansApi.updateBookingStatus(nsSlug.value, b.id, status);
    await loadBookings();
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  }
}

// --- create booking modal ---
const showCreate = ref(false);
const form = reactive({
  locationId: '', serviceId: '', masterId: '', slotStart: '',
  clientName: '', clientPhone: '', comment: '',
});
const slots = ref<PlansAvailableSlot[]>([]);
const slotsLoading = ref(false);
const creating = ref(false);
const formServices = computed(() => services.value.filter(s => s.isActive));
const formMasters = computed(() => masters.value.filter(m => m.isActive && (!form.locationId || m.locationId === form.locationId)));

function openCreate() {
  form.locationId = locations.value.find(l => l.isPrimary)?.id || locations.value[0]?.id || '';
  form.serviceId = ''; form.masterId = ''; form.slotStart = '';
  form.clientName = ''; form.clientPhone = ''; form.comment = '';
  slots.value = [];
  showCreate.value = true;
}

async function loadSlots() {
  slots.value = []; form.slotStart = '';
  if (!form.locationId || !form.serviceId) return;
  slotsLoading.value = true;
  try {
    slots.value = await plansApi.availableSlots(nsSlug.value, form.locationId, form.serviceId, selectedDate.value, form.masterId || undefined);
  } catch (e) {
    logError('[plans/index] loadSlots', e);
  } finally {
    slotsLoading.value = false;
  }
}
watch(() => [form.locationId, form.serviceId, form.masterId, selectedDate.value], loadSlots);

async function createBooking() {
  if (!form.slotStart || !form.clientName || !form.clientPhone) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired') || 'Заполните обязательные поля', color: 'red' });
    return;
  }
  creating.value = true;
  try {
    await plansApi.createBooking(nsSlug.value, {
      locationId: form.locationId,
      masterId: form.masterId || null,
      clientName: form.clientName,
      clientPhone: form.clientPhone,
      startAt: form.slotStart,
      services: [{ serviceId: form.serviceId, masterId: form.masterId || null }],
      comment: form.comment || null,
    });
    showCreate.value = false;
    toast.add({ title: t('common.success'), description: t('plans.bookingCreated') || 'Запись создана', color: 'emerald' });
    await loadBookings();
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally {
    creating.value = false;
  }
}

onMounted(async () => { await loadRefs(); await loadBookings(); });
watch(selectedDate, loadBookings);
</script>

<template>
  <div class="max-w-5xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('app.plans') }}</h1>
      <UButton v-if="canManageCalendar" icon="lucide:plus" size="sm" @click="openCreate">
        {{ t('plans.newBooking') || 'Новая запись' }}
      </UButton>
    </div>

    <PlansNavTabs />

    <div class="flex items-center justify-center gap-2">
      <UButton icon="lucide:chevron-left" size="xs" variant="ghost" @click="shiftDay(-1)" />
      <input type="date" v-model="selectedDate" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
      <UButton icon="lucide:chevron-right" size="xs" variant="ghost" @click="shiftDay(1)" />
      <UButton size="xs" variant="soft" @click="selectedDate = new Date().toISOString().slice(0,10)">
        {{ t('plans.today') || 'Сегодня' }}
      </UButton>
    </div>

    <div v-if="loading" class="py-16 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
    </div>
    <div v-else-if="!bookings.length" class="py-16 text-center text-gray-500 dark:text-gray-400">
      <UIcon name="lucide:calendar-x" class="w-10 h-10 mx-auto mb-3 opacity-60" />
      {{ t('plans.noBookingsForDay') || 'На этот день записей нет' }}
    </div>
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="b in bookings"
        :key="b.id"
        class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-wrap items-center gap-x-4 gap-y-2"
      >
        <div class="font-mono text-sm font-semibold w-24">{{ fmtTime(b.startAt) }}–{{ fmtTime(b.endAt) }}</div>
        <div class="flex-1 min-w-[140px]">
          <div class="font-medium text-gray-900 dark:text-white">{{ b.clientName }}</div>
          <div class="text-xs text-gray-500">{{ b.clientPhone }}</div>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-300 min-w-[120px]">
          {{ b.masterId ? (mastersById[b.masterId]?.name || '—') : (t('plans.anyMaster') || 'Любой мастер') }}
        </div>
        <UBadge :color="(STATUS_META[b.status]?.color as any) || 'gray'" variant="subtle" size="xs">
          {{ STATUS_META[b.status]?.label || b.status }}
        </UBadge>
        <div v-if="canManageCalendar" class="flex gap-1">
          <UButton
            v-for="ns in nextStatuses(b.status)" :key="ns"
            size="2xs" variant="soft" :color="(STATUS_META[ns]?.color as any) || 'gray'"
            @click="setStatus(b, ns)"
          >{{ STATUS_META[ns]?.label || ns }}</UButton>
        </div>
      </div>
    </div>

    <UModal v-model="showCreate">
      <div class="p-5 flex flex-col gap-3">
        <h3 class="text-base font-semibold">{{ t('plans.newBooking') || 'Новая запись' }} — {{ selectedDate }}</h3>
        <label class="text-xs font-medium text-gray-500">{{ t('plans.location') || 'Точка' }}</label>
        <select v-model="form.locationId" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
        <label class="text-xs font-medium text-gray-500">{{ t('plans.service') || 'Услуга' }}</label>
        <select v-model="form.serviceId" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          <option value="">—</option>
          <option v-for="s in formServices" :key="s.id" :value="s.id">{{ s.name }} · {{ s.durationMinutes }}мин · {{ s.price }}</option>
        </select>
        <label class="text-xs font-medium text-gray-500">{{ t('plans.master') || 'Мастер' }}</label>
        <select v-model="form.masterId" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          <option value="">{{ t('plans.anyMaster') || 'Любой доступный' }}</option>
          <option v-for="m in formMasters" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <label class="text-xs font-medium text-gray-500">{{ t('plans.slot') || 'Свободное окно' }}</label>
        <div v-if="slotsLoading" class="text-sm text-gray-500 py-2">{{ t('common.loading') || 'Загрузка…' }}</div>
        <div v-else-if="form.serviceId && !slots.length" class="text-sm text-gray-500 py-2">{{ t('plans.noSlots') || 'Свободных окон нет' }}</div>
        <div v-else class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          <button
            v-for="sl in slots" :key="sl.startAt" type="button"
            class="px-2.5 py-1.5 rounded-lg border text-sm"
            :class="form.slotStart === sl.startAt ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300' : 'border-gray-300 dark:border-gray-700'"
            @click="form.slotStart = sl.startAt"
          >{{ fmtTime(sl.startAt) }}</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="form.clientName" :placeholder="t('plans.clientName') || 'Имя клиента'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          <input v-model="form.clientPhone" :placeholder="t('plans.clientPhone') || 'Телефон'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        </div>
        <input v-model="form.comment" :placeholder="t('plans.comment') || 'Комментарий'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <div class="flex justify-end gap-2 mt-1">
          <UButton variant="ghost" color="gray" @click="showCreate = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton :loading="creating" @click="createBooking">{{ t('common.create') || 'Создать' }}</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
