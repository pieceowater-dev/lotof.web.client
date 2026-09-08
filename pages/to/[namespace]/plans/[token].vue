<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { getErrorMessage } from '@/utils/types/errors';
import { plansPublicApi, type PlansBooking, type PlansAvailableSlot } from '@/api/plans/ops';

definePageMeta({ layout: false });

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const token = computed(() => route.params.token as string);

useHead(() => ({ title: t('plans.manageBooking') || 'Ваша запись' }));

const loading = ref(true);
const booking = ref<PlansBooking | null>(null);
const busy = ref(false);
const err = ref('');

const rescheduleOpen = ref(false);
const rDate = ref<string>('');
const rSlots = ref<PlansAvailableSlot[]>([]);
const rSlot = ref<PlansAvailableSlot | null>(null);
const rLoading = ref(false);

async function load() {
  loading.value = true;
  try {
    booking.value = await plansPublicApi.booking(nsSlug.value, token.value);
    if (!booking.value) err.value = t('plans.bookingNotFound') || 'Запись не найдена';
  } catch (e) { err.value = getErrorMessage(e, t); }
  finally { loading.value = false; }
}
function fmt(iso?: string | null) { return iso ? new Date(iso).toLocaleString('ru', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''; }

async function cancel() {
  if (!confirm(t('plans.confirmCancel') || 'Отменить запись?')) return;
  busy.value = true;
  try { booking.value = await plansPublicApi.cancelBooking(nsSlug.value, token.value); }
  catch (e) { alert(getErrorMessage(e, t)); }
  finally { busy.value = false; }
}

async function openReschedule() {
  rDate.value = new Date().toISOString().slice(0, 10);
  rescheduleOpen.value = true;
  await loadRSlots();
}
async function loadRSlots() {
  rSlots.value = []; rSlot.value = null;
  if (!booking.value) return;
  rLoading.value = true;
  try {
    // We don't know serviceId from the public booking payload; the gateway
    // recomputes duration from the existing booking's services, so any of
    // this location's services works to enumerate the grid — but simplest
    // is: rely on availableSlots needing a serviceId. Fall back: hide the
    // reschedule action when we can't resolve it.
    rSlots.value = [];
  } finally { rLoading.value = false; }
}
async function doReschedule(slot: PlansAvailableSlot) {
  busy.value = true;
  try {
    booking.value = await plansPublicApi.rescheduleBooking(nsSlug.value, token.value, slot.startAt, booking.value?.masterId || undefined);
    rescheduleOpen.value = false;
  } catch (e) { alert(getErrorMessage(e, t)); }
  finally { busy.value = false; }
}
watch(rDate, loadRSlots);

const statusLabel = computed(() => ({
  NEW: 'Ожидает подтверждения', CONFIRMED: 'Подтверждена', COMPLETED: 'Завершена',
  CANCELLED: 'Отменена', NO_SHOW: 'Пропущена',
}[booking.value?.status || ''] || booking.value?.status));

onMounted(load);
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="max-w-md mx-auto px-4 py-10">
      <div v-if="loading" class="py-24 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" /></div>
      <div v-else-if="err || !booking" class="py-24 text-center text-gray-500">{{ err || (t('plans.bookingNotFound') || 'Запись не найдена') }}</div>
      <template v-else>
        <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3">
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('plans.yourBooking') || 'Ваша запись' }}</h1>
          <div class="text-sm">
            <div class="text-gray-500">{{ t('plans.when') || 'Когда' }}</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ fmt(booking.startAt) }}</div>
          </div>
          <div class="text-sm">
            <div class="text-gray-500">{{ t('plans.client') || 'Клиент' }}</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ booking.clientName }} · {{ booking.clientPhone }}</div>
          </div>
          <UBadge :color="booking.status === 'CANCELLED' ? 'red' : booking.status === 'CONFIRMED' ? 'primary' : 'blue'" variant="subtle" class="self-start">{{ statusLabel }}</UBadge>

          <div v-if="booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED'" class="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <UButton color="red" variant="soft" :loading="busy" @click="cancel">{{ t('plans.cancelBooking') || 'Отменить' }}</UButton>
          </div>
          <p v-else-if="booking.status === 'CANCELLED'" class="text-sm text-gray-500">{{ t('plans.bookingCancelled') || 'Запись отменена.' }}</p>
        </div>
        <NuxtLink :to="`/to/${nsSlug}/plans`" class="block text-center text-sm text-primary-600 hover:underline mt-4">{{ t('plans.newBookingLink') || 'Записаться ещё раз' }}</NuxtLink>
      </template>
    </div>
  </div>
</template>
