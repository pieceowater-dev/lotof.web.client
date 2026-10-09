<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { getErrorMessage } from '@/utils/types/errors';
import { plansPublicApi, type PlansBooking, type PlansAvailableSlot, type PlansSettings } from '@/api/plans/ops';
import { getContrastTextColor } from '@/utils/color';
import StorefrontHero from '@/components/storefront/StorefrontHero.vue';
import StorefrontTopBar from '@/components/storefront/StorefrontTopBar.vue';

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

// Tenant brand: colours + name come from the same public settings the booking page uses.
const brandSettings = ref<PlansSettings | null>(null);
const accent = computed(() => brandSettings.value?.primaryColor || '#7c3aed');
const onAccent = computed(() => getContrastTextColor(accent.value));
const brandVars = computed(() => ({ '--brand': accent.value, '--brand-ink': onAccent.value }));
onMounted(async () => {
  try { brandSettings.value = await plansPublicApi.settings(nsSlug.value); } catch { /* neutral default */ }
});

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
  <div class="sf" :style="brandVars">
    <StorefrontTopBar :powered-label="t('plans.poweredBy') || 'Работает на lota'" />
    <StorefrontHero
      compact
      :name="brandSettings?.name || t('plans.yourBooking') || 'Ваша запись'"
      :logo-url="brandSettings?.logoUrl"
      fallback-icon="lucide:calendar-check"
      :back-label="t('plans.newBookingLink') || 'Записаться ещё раз'"
      @back="navigateTo(`/to/${nsSlug}/plans`)"
    />

    <div class="mx-auto max-w-md px-4 py-8">
      <!-- checking session -->
      <div v-if="authChecking" class="flex justify-center py-24">
        <UIcon name="i-heroicons-arrow-path" class="h-7 w-7 animate-spin" :style="{ color: accent }" />
      </div>

      <!-- must be a signed-in patron -->
      <div v-else-if="!patron.isLoggedIn.value" class="sf-card flex flex-col items-center gap-3 p-7 text-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10"><UIcon name="lucide:lock" class="h-6 w-6" /></span>
        <p class="text-sm text-gray-500">{{ t('plans.trackSignInHint') || 'Войдите как клиент lota, чтобы открыть запись.' }}</p>
        <button type="button" class="sf-btn sf-btn--block" @click="patron.login()">
          <UIcon name="simple-icons:google" class="h-4 w-4" />
          {{ t('app.login') || 'Войти' }}
        </button>
      </div>

      <div v-else-if="loading" class="flex justify-center py-24">
        <UIcon name="i-heroicons-arrow-path" class="h-7 w-7 animate-spin" :style="{ color: accent }" />
      </div>

      <div v-else-if="forbidden" class="sf-card p-7 text-center text-sm text-gray-500">
        {{ t('plans.notYourBooking') || 'Эта запись принадлежит другому клиенту.' }}
      </div>

      <div v-else-if="err || !booking" class="py-24 text-center text-sm text-gray-500">
        {{ err || (t('plans.bookingNotFound') || 'Запись не найдена') }}
      </div>

      <template v-else>
        <div class="sf-card overflow-hidden">
          <div class="flex items-center justify-between gap-2 p-5 sf-tint !rounded-none">
            <h1 class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.yourBooking') || 'Ваша запись' }}</h1>
            <UBadge :color="(statusMeta.color as any)" variant="subtle" size="xs">{{ statusMeta.label }}</UBadge>
          </div>

          <div class="flex flex-col gap-3 p-5">
            <div class="text-xl font-extrabold capitalize tracking-tight" :style="{ color: accent }">{{ fmt(booking.startAt) }}</div>
            <div class="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <div v-if="serviceName" class="flex items-center gap-2"><UIcon name="lucide:sparkles" class="h-4 w-4 text-gray-400" />{{ serviceName }}</div>
              <div class="flex items-center gap-2"><UIcon name="lucide:user" class="h-4 w-4 text-gray-400" />{{ booking.clientName }} · {{ booking.clientPhone }}</div>
              <div v-if="booking.totalPrice" class="flex items-center gap-2"><UIcon name="lucide:wallet" class="h-4 w-4 text-gray-400" />{{ booking.totalPrice }}</div>
            </div>

            <div v-if="canManage" class="flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
              <button v-if="serviceId" type="button" class="sf-btn sf-btn--soft !py-2 !text-sm" :disabled="busy" @click="openReschedule">
                <UIcon name="lucide:calendar-clock" class="h-4 w-4" />{{ t('plans.reschedule') || 'Перенести' }}
              </button>
              <button type="button" class="sf-btn !py-2 !text-sm !shadow-none" style="--brand: #e11d48; --brand-ink: #fff; background: rgba(225, 29, 72, 0.1); color: #e11d48" :disabled="busy" @click="cancel">
                <UIcon name="lucide:x" class="h-4 w-4" />{{ t('plans.cancelBooking') || 'Отменить' }}
              </button>
            </div>
            <p v-else-if="booking.status === 'CANCELLED'" class="text-xs text-gray-500">{{ t('plans.bookingCancelled') || 'Запись отменена.' }}</p>
          </div>
        </div>
      </template>
    </div>

    <UModal v-model="rescheduleOpen" :ui="{ width: 'sm:max-w-md', rounded: 'rounded-[2rem]', background: 'bg-white dark:bg-[#1a1a1a]', ring: 'ring-1 ring-black/5 dark:ring-white/10', shadow: 'shadow-2xl' }">
      <div class="sf-fields p-6" :style="brandVars">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.reschedule') || 'Перенести запись' }}</h3>
          <button type="button" class="sf-sheet-close" aria-label="Закрыть" @click="rescheduleOpen = false"><UIcon name="lucide:x" class="h-4 w-4" /></button>
        </div>
        <div class="space-y-3">
          <UInput v-model="rDate" type="date" size="lg" :min="new Date().toISOString().slice(0,10)" />
          <div v-if="rLoading" class="py-4 text-center text-sm text-gray-500">{{ t('common.loading') || 'Загрузка…' }}</div>
          <div v-else-if="!rSlots.length" class="py-4 text-center text-sm text-gray-500">{{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}</div>
          <div v-else class="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            <button
              v-for="sl in rSlots"
              :key="sl.startAt"
              type="button"
              class="sf-option px-2 py-2.5 text-sm font-semibold text-gray-900 dark:text-white"
              :class="rSlot?.startAt === sl.startAt ? 'sf-option--on' : ''"
              @click="rSlot = sl"
            >{{ fmtTime(sl.startAt) }}</button>
          </div>
        </div>
        <div class="mt-5 flex items-center justify-end gap-2">
          <button type="button" class="rounded-full px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" @click="rescheduleOpen = false">{{ t('common.cancel') || 'Отмена' }}</button>
          <button type="button" class="sf-btn" :disabled="busy || !rSlot" @click="doReschedule">{{ t('plans.moveHere') || 'Перенести' }}</button>
        </div>
      </div>
    </UModal>
  </div>
</template>
