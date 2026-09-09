<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { getErrorMessage } from '@/utils/types/errors';
import { plansPublicApi, type PlansBooking, type PlansAvailableSlot } from '@/api/plans/ops';

definePageMeta({ layout: false });

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const token = computed(() => route.params.token as string);
const patron = usePatronAuth();

useHead(() => ({ title: t('plans.yourBooking') || 'Ваша запись' }));

const authChecking = ref(true);
const loading = ref(false);
const booking = ref<PlansBooking | null>(null);
const serviceId = ref('');
const serviceName = ref('');
const busy = ref(false);
const err = ref('');
const forbidden = ref(false);

const rescheduleOpen = ref(false);
const rDate = ref('');
const rSlots = ref<PlansAvailableSlot[]>([]);
const rSlot = ref<PlansAvailableSlot | null>(null);
const rLoading = ref(false);

async function load() {
  loading.value = true;
  try {
    booking.value = await plansPublicApi.booking(nsSlug.value, token.value);
    if (!booking.value) { err.value = t('plans.bookingNotFound') || 'Запись не найдена'; return; }
    // Only the patron this booking belongs to may open it.
    if (booking.value.clientId && booking.value.clientId !== patron.me.value?.id) {
      forbidden.value = true; booking.value = null; return;
    }
    try {
      const lines = await plansPublicApi.bookingServices(nsSlug.value, token.value);
      serviceId.value = lines[0]?.serviceId || '';
      serviceName.value = lines.map(l => l.serviceName).join(', ');
    } catch { /* reschedule just stays hidden */ }
  } catch (e) { err.value = getErrorMessage(e, t); }
  finally { loading.value = false; }
}

onMounted(async () => {
  try { await patron.fetchMe(); } catch {}
  authChecking.value = false;
  if (patron.isLoggedIn.value) await load();
});

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString('ru', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
}
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }

async function cancel() {
  if (!confirm(t('plans.confirmCancel') || 'Отменить запись?')) return;
  busy.value = true;
  try { booking.value = await plansPublicApi.cancelBooking(nsSlug.value, token.value); }
  catch (e) { useToast().add({ title: t('common.error') || 'Ошибка', description: getErrorMessage(e, t), color: 'red' }); }
  finally { busy.value = false; }
}

function openReschedule() {
  rDate.value = new Date().toISOString().slice(0, 10);
  rescheduleOpen.value = true;
  loadRSlots();
}
async function loadRSlots() {
  rSlots.value = []; rSlot.value = null;
  if (!booking.value || !serviceId.value) return;
  rLoading.value = true;
  try {
    rSlots.value = await plansPublicApi.availableSlots(
      nsSlug.value, booking.value.locationId, serviceId.value, rDate.value, booking.value.masterId || undefined);
  } catch { rSlots.value = []; }
  finally { rLoading.value = false; }
}
watch(rDate, () => { if (rescheduleOpen.value) loadRSlots(); });

async function doReschedule() {
  if (!rSlot.value) return;
  busy.value = true;
  try {
    booking.value = await plansPublicApi.rescheduleBooking(nsSlug.value, token.value, rSlot.value.startAt, booking.value?.masterId || undefined);
    rescheduleOpen.value = false;
  } catch (e) {
    const msg = getErrorMessage(e, t);
    if (/no longer available|slot|занят/i.test(msg)) { await loadRSlots(); }
    useToast().add({ title: t('common.error') || 'Ошибка', description: msg, color: 'red' });
  } finally { busy.value = false; }
}

const canManage = computed(() => booking.value && booking.value.status !== 'CANCELLED' && booking.value.status !== 'COMPLETED');
const statusMeta = computed(() => {
  const s = booking.value?.status || '';
  const map: Record<string, { label: string; color: string }> = {
    NEW: { label: 'Ожидает подтверждения', color: 'blue' },
    CONFIRMED: { label: 'Подтверждена', color: 'primary' },
    COMPLETED: { label: 'Завершена', color: 'emerald' },
    CANCELLED: { label: 'Отменена', color: 'red' },
    NO_SHOW: { label: 'Пропущена', color: 'amber' },
  };
  return map[s] || { label: s, color: 'gray' };
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="max-w-sm mx-auto px-4 py-10">
      <!-- checking session -->
      <div v-if="authChecking" class="py-24 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
      </div>

      <!-- must be a signed-in patron -->
      <div v-else-if="!patron.isLoggedIn.value" class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center flex flex-col items-center gap-3">
        <UIcon name="lucide:lock" class="w-8 h-8 text-gray-300" />
        <p class="text-sm text-gray-500">{{ t('plans.trackSignInHint') || 'Войдите как клиент lota, чтобы открыть запись.' }}</p>
        <UButton block color="white" variant="solid" class="ring-1 ring-gray-300 dark:ring-gray-600" @click="patron.login()">
          <UIcon name="simple-icons:google" class="w-4 h-4" />
          {{ t('app.login') || 'Войти' }}
        </UButton>
      </div>

      <div v-else-if="loading" class="py-24 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
      </div>

      <div v-else-if="forbidden" class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center text-sm text-gray-500">
        {{ t('plans.notYourBooking') || 'Эта запись принадлежит другому клиенту.' }}
      </div>

      <div v-else-if="err || !booking" class="py-24 text-center text-sm text-gray-500">
        {{ err || (t('plans.bookingNotFound') || 'Запись не найдена') }}
      </div>

      <template v-else>
        <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2">
            <h1 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('plans.yourBooking') || 'Ваша запись' }}</h1>
            <UBadge :color="(statusMeta.color as any)" variant="subtle" size="xs">{{ statusMeta.label }}</UBadge>
          </div>

          <div class="text-sm text-gray-900 dark:text-gray-100 font-medium capitalize">{{ fmt(booking.startAt) }}</div>
          <div class="text-xs text-gray-500 space-y-1">
            <div v-if="serviceName">{{ serviceName }}</div>
            <div>{{ booking.clientName }} · {{ booking.clientPhone }}</div>
            <div v-if="booking.totalPrice">{{ booking.totalPrice }}</div>
          </div>

          <div v-if="canManage" class="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            <UButton v-if="serviceId" size="sm" variant="soft" icon="lucide:calendar-clock" :loading="busy" @click="openReschedule">{{ t('plans.reschedule') || 'Перенести' }}</UButton>
            <UButton size="sm" color="red" variant="soft" icon="lucide:x" :loading="busy" @click="cancel">{{ t('plans.cancelBooking') || 'Отменить' }}</UButton>
          </div>
          <p v-else-if="booking.status === 'CANCELLED'" class="text-xs text-gray-500">{{ t('plans.bookingCancelled') || 'Запись отменена.' }}</p>
        </div>
        <NuxtLink :to="`/to/${nsSlug}/plans`" class="block text-center text-xs text-primary-600 hover:underline mt-3">{{ t('plans.newBookingLink') || 'Записаться ещё раз' }}</NuxtLink>
      </template>
    </div>

    <UModal v-model="rescheduleOpen" :ui="{ width: 'sm:max-w-md' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header><h3 class="text-base font-semibold">{{ t('plans.reschedule') || 'Перенести запись' }}</h3></template>
        <div class="space-y-3">
          <UInput v-model="rDate" type="date" size="lg" :min="new Date().toISOString().slice(0,10)" />
          <div v-if="rLoading" class="py-4 text-center text-sm text-gray-500">{{ t('common.loading') || 'Загрузка…' }}</div>
          <div v-else-if="!rSlots.length" class="py-4 text-center text-sm text-gray-500">{{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}</div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
            <button v-for="sl in rSlots" :key="sl.startAt" type="button"
              class="px-2 py-2.5 rounded-lg border text-sm font-medium transition"
              :class="rSlot?.startAt === sl.startAt ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700' : 'border-gray-200 dark:border-gray-800'"
              @click="rSlot = sl">{{ fmtTime(sl.startAt) }}</button>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="gray" @click="rescheduleOpen = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton :loading="busy" :disabled="!rSlot" @click="doReschedule">{{ t('plans.moveHere') || 'Перенести' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
