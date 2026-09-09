<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { parseSocialLinks, socialIcon, socialLabel } from '@/utils/social';
import { telHref } from '@/utils/phoneLinks';
import { twoGisSearchHref } from '@/utils/geo';
import { formatDisplayPhoneUniversal, normalizePhoneForStorage } from '@/utils/phone';
import { resolveSiteUrl } from '@/utils/siteUrl';
import { getContrastTextColor } from '@/utils/color';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import {
  plansPublicApi,
  type PlansLocation, type PlansService, type PlansMaster, type ServiceCategory, type PlansSettings, type PlansAvailableSlot, type PlansBooking,
} from '@/api/plans/ops';

definePageMeta({ layout: false });

const { t, locale, setLocale, available } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const sourceTag = computed(() => (route.query.t as string) || '');
const locationSlug = computed(() => (route.query.l as string) || '');
const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
const LOCALE_LABELS: Record<string, string> = { ru: 'RU', kk: 'KZ', en: 'EN' };

const patron = usePatronAuth();

const { data, pending, error: fetchError } = await useAsyncData(`plans-public-${nsSlug.value}`, async () => {
  const [settings, locations, categories, services] = await Promise.all([
    plansPublicApi.settings(nsSlug.value).catch(() => null),
    plansPublicApi.locations(nsSlug.value).catch(() => [] as PlansLocation[]),
    plansPublicApi.categories(nsSlug.value).catch(() => [] as ServiceCategory[]),
    plansPublicApi.services(nsSlug.value).catch(() => [] as PlansService[]),
  ]);
  return { settings, locations, categories, services };
});

const settings = computed<PlansSettings | null>(() => data.value?.settings || null);
const locations = computed<PlansLocation[]>(() => data.value?.locations || []);
const categories = computed<ServiceCategory[]>(() => data.value?.categories || []);
const services = computed<PlansService[]>(() => (data.value?.services || []).filter(s => s.isActive));

const brandName = computed(() => settings.value?.name || locations.value[0]?.name || 'lota Plans');
const accent = computed(() => settings.value?.primaryColor || '#7c3aed');
const onAccent = computed(() => getContrastTextColor(accent.value));
const currency = computed(() => settings.value?.currency || '');
const socialLinks = computed(() => parseSocialLinks(settings.value?.socialLinks));

// Back-to-Catalog: shown only when the visitor actually arrived from
// /catalog or /stores (a client-side NuxtLink hop leaves that path in
// history.state.back). A hard refresh / direct link clears it → button
// hides, since there's no known origin to go back to. Same behaviour as
// the lota Menu storefront.
const backHref = ref<string | null>(null);
onMounted(() => {
  const back = window.history.state?.back as string | undefined;
  if (back === '/catalog' || back === '/stores') backHref.value = back;
});

useHead(() => ({
  title: `${t('plans.book') || 'Онлайн-запись'} — ${brandName.value}`,
  meta: [{ name: 'description', content: settings.value?.welcomeMessage || `${t('plans.book') || 'Онлайн-запись'} — ${brandName.value}` }],
}));

const location = computed<PlansLocation | null>(() => {
  if (locationSlug.value) return locations.value.find(l => l.slug === locationSlug.value) || null;
  return locations.value.find(l => l.isPrimary) || locations.value[0] || null;
});

// ---------------- wizard ----------------
const step = ref<1 | 2 | 3 | 4>(1);
// true when the service needs no master pick — the wizard is then 2 steps
// (service -> time), not 3.
const masterStepSkipped = ref(false);
const totalSteps = computed(() => (masterStepSkipped.value ? 2 : 3));
// which progress segment the current step lights up
const progressStep = computed(() => (masterStepSkipped.value && step.value === 3 ? 2 : step.value));
const chosenService = ref<PlansService | null>(null);
const chosenMasterId = ref<string>('');
const chosenDate = ref<string>(new Date().toISOString().slice(0, 10));
const chosenSlot = ref<PlansAvailableSlot | null>(null);
const eligibleMasters = ref<PlansMaster[]>([]);
const slots = ref<PlansAvailableSlot[]>([]);
const openDays = ref<Set<string>>(new Set());
const slotsLoading = ref(false);

const form = reactive({ name: '', phone: '', comment: '' });
const submitting = ref(false);
const doneToken = ref<string>('');

// prefill: patron name, last-used phone from a previous booking on this device
onMounted(async () => {
  try { await patron.fetchMe(); } catch {}
  if (patron.me.value?.name && !form.name) form.name = patron.me.value.name;
  try {
    const p = localStorage.getItem('plans:lastPhone');
    if (p && !form.phone) form.phone = p;
  } catch {}
});
watch(() => patron.me.value?.name, (n) => { if (n && !form.name) form.name = n; });

const catsWithServices = computed(() =>
  categories.value.map(c => ({ cat: c, list: services.value.filter(s => (s.categoryId || null) === c.id) })).filter(x => x.list.length));
const uncategorized = computed(() => services.value.filter(s => !s.categoryId));

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }
function fmtDayShort(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return { wd: dt.toLocaleDateString('ru', { weekday: 'short' }), dm: dt.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) };
}

async function pickService(s: PlansService) {
  chosenService.value = s;
  chosenMasterId.value = '';
  eligibleMasters.value = [];
  try {
    eligibleMasters.value = (await plansPublicApi.masters(nsSlug.value, s.id, location.value?.id)).filter(m => m.isActive);
  } catch (e) { logError('[plans public] masters', e); }
  // Skip the master step entirely unless the service actually requires the
  // client to pick one: "requiresMaster: false" means any available master
  // (or a resource-style booking — court, field, bay — with no masters at
  // all). The slot's own masterIds resolve the assignment at submit.
  if (!s.requiresMaster || !eligibleMasters.value.length) {
    masterStepSkipped.value = true;
    chosenMasterId.value = '';
    goToSlots();
    return;
  }
  masterStepSkipped.value = false;
  step.value = 2;
}

function goToSlots() { step.value = 3; loadDays(); loadSlots(); }

// upcoming 21 days as a horizontal strip; grey out days with no availability
const dayStrip = computed(() => {
  const out: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 21; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
});
async function loadDays() {
  if (!location.value || !chosenService.value) return;
  const months = [...new Set(dayStrip.value.map(d => d.slice(0, 7)))];
  try {
    const results = await Promise.all(months.map(m =>
      plansPublicApi.availableDays(nsSlug.value, location.value!.id, chosenService.value!.id, m, chosenMasterId.value || undefined)));
    openDays.value = new Set(results.flat());
  } catch { openDays.value = new Set(); }
}
async function loadSlots() {
  chosenSlot.value = null; slots.value = [];
  if (!location.value || !chosenService.value) return;
  slotsLoading.value = true;
  try {
    slots.value = await plansPublicApi.availableSlots(nsSlug.value, location.value.id, chosenService.value.id, chosenDate.value, chosenMasterId.value || undefined);
  } catch (e) { logError('[plans public] slots', e); }
  finally { slotsLoading.value = false; }
}
watch([chosenMasterId, chosenDate], () => { if (step.value === 3) { loadDays(); loadSlots(); } });

async function submit() {
  if (!chosenSlot.value || !chosenService.value || !location.value || !form.name.trim() || !form.phone.trim()) return;
  submitting.value = true;
  try {
    const cgid = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
    const masterId = chosenMasterId.value || (chosenSlot.value.masterIds[0] || null);
    const phone = normalizePhoneForStorage(form.phone) || form.phone.trim();
    const booking = await plansPublicApi.createBooking(nsSlug.value, {
      locationId: location.value.id,
      masterId,
      clientName: form.name.trim(),
      clientPhone: phone,
      clientId: patron.me.value?.id || null,
      startAt: chosenSlot.value.startAt,
      services: [{ serviceId: chosenService.value.id, masterId }],
      comment: form.comment.trim() || null,
      sourceTag: sourceTag.value || null,
    }, cgid);
    try {
      localStorage.setItem('plans:lastPhone', form.phone.trim());
      localStorage.setItem('plans:lastManage', `/to/${nsSlug.value}/plans/${booking.publicToken}`);
    } catch {}
    doneToken.value = booking.publicToken;
    step.value = 4;
  } catch (e) {
    const msg = getErrorMessage(e, t) || '';
    if (/no longer available|slot|занят|precondition/i.test(msg)) {
      chosenSlot.value = null;
      await loadSlots();
      useToast().add({ title: t('plans.slotJustTaken') || 'Это время только что заняли', description: t('plans.pickAnother') || 'Выберите, пожалуйста, другое время', color: 'amber' });
    } else {
      useToast().add({ title: t('common.error') || 'Ошибка', description: msg || (t('plans.bookFailed') || 'Не удалось создать запись'), color: 'red' });
    }
  } finally { submitting.value = false; }
}

const manageUrl = computed(() => `/to/${nsSlug.value}/plans/${doneToken.value}`);
function restart() {
  step.value = 1; chosenService.value = null; chosenMasterId.value = ''; chosenSlot.value = null;
  chosenDate.value = new Date().toISOString().slice(0, 10); form.comment = ''; doneToken.value = '';
}

// ---------------- booking tracking ----------------
// A booking is opened only via its unguessable per-booking link (kept in this
// device's localStorage after a successful booking). No phone lookup — that
// would let anyone enumerate other people's bookings.
const trackOpen = ref(false);
const lastManageLink = ref('');
const myBookings = ref<PlansBooking[] | null>(null);
const myBookingsLoading = ref(false);
async function openTrack() {
  trackOpen.value = true;
  try { lastManageLink.value = localStorage.getItem('plans:lastManage') || ''; } catch {}
  if (patron.isLoggedIn.value && patron.token.value) {
    myBookingsLoading.value = true;
    try { myBookings.value = await plansPublicApi.myBookings(nsSlug.value, patron.token.value); }
    catch { myBookings.value = []; }
    finally { myBookingsLoading.value = false; }
  }
}
const STATUS_RU: Record<string, string> = {
  NEW: 'Ожидает подтверждения', CONFIRMED: 'Подтверждена', COMPLETED: 'Завершена',
  CANCELLED: 'Отменена', NO_SHOW: 'Пропущена',
};
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="h-screen overflow-y-auto bg-gray-50 dark:bg-gray-950">
    <div class="min-h-full flex flex-col">
      <!-- slim platform bar: locale + attribution -->
      <div class="w-full max-w-3xl mx-auto px-4 py-1.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-0.5">
          <button v-for="loc in available" :key="loc" type="button"
            class="px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
            :class="locale === loc ? 'text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
            @click="setLocale(loc)">{{ LOCALE_LABELS[loc] || String(loc).toUpperCase() }}</button>
        </div>
        <a :href="siteUrl" target="_blank" rel="noopener"
           class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <UIcon name="lucide:calendar-check" class="w-3 h-3" /> {{ t('plans.poweredBy') || 'Работает на lota' }}
        </a>
      </div>

      <div v-if="pending" class="flex-1 flex items-center justify-center py-24">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>
      <div v-else-if="fetchError || !location" class="flex-1 flex items-center justify-center py-24 px-4 text-center text-gray-500">
        {{ t('plans.publicUnavailable') || 'Страница записи недоступна' }}
      </div>

      <template v-else>
        <!-- brand hero band (tenant's own primary colour) -->
        <div :style="{ backgroundColor: accent }">
          <div class="max-w-3xl mx-auto px-4 pt-7 pb-8">
            <button
              v-if="backHref"
              type="button"
              class="mb-3 inline-flex items-center gap-1.5 text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
              :style="{ color: onAccent }"
              @click="navigateTo(backHref)"
            >
              <UIcon name="lucide:arrow-left" class="w-3.5 h-3.5" />
              {{ t('menu.backToCatalog') || 'Каталог' }}
            </button>
            <div class="flex items-start gap-4">
              <div class="w-20 h-20 rounded-2xl bg-white shadow-lg ring-4 ring-white/30 flex-shrink-0 overflow-hidden flex items-center justify-center">
                <img v-if="settings?.logoUrl" :src="settings.logoUrl" alt="" class="w-full h-full object-contain p-1.5" />
                <UIcon v-else name="lucide:calendar-check" class="w-9 h-9 text-gray-300" />
              </div>
              <div class="min-w-0 flex-1 pt-1">
                <h1 class="text-2xl font-bold truncate" :style="{ color: onAccent }">{{ brandName }}</h1>
                <p v-if="settings?.welcomeMessage" class="text-sm mt-0.5 line-clamp-2" :style="{ color: onAccent, opacity: 0.85 }">
                  {{ settings.welcomeMessage }}
                </p>
              </div>
              <UButton size="2xs" class="flex-shrink-0 border-0" :style="{ backgroundColor: 'rgba(255,255,255,0.16)', color: onAccent }" icon="lucide:ticket" @click="openTrack">
                <span class="hidden sm:inline">{{ t('plans.myBookings') || 'Мои записи' }}</span>
              </UButton>
            </div>
            <div class="mt-4 flex items-center gap-2 flex-wrap">
              <a v-if="location.address" :href="twoGisSearchHref(location.address)" target="_blank" rel="noopener"
                 class="inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                 :style="{ backgroundColor: 'rgba(255,255,255,0.16)', color: onAccent }">
                <UIcon name="lucide:map-pin" class="w-3.5 h-3.5 flex-shrink-0" />
                <span class="truncate">{{ location.address }}</span>
                <UIcon name="lucide:external-link" class="w-3 h-3 flex-shrink-0 opacity-70" />
              </a>
              <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0"
                    :style="{ backgroundColor: 'rgba(255,255,255,0.16)', color: onAccent }">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {{ t('plans.bookingOpen') || 'Онлайн-запись открыта' }}
              </span>
            </div>
          </div>
        </div>

        <!-- wizard -->
        <div class="flex-1 w-full">
          <div class="max-w-2xl mx-auto px-4 py-6 sm:py-8">
            <!-- step progress -->
            <div v-if="step < 4" class="flex items-center gap-1.5 mb-4">
              <span v-for="n in totalSteps" :key="n" class="flex-1 h-1 rounded-full transition-colors"
                    :style="{ background: progressStep > n - 1 ? accent : '' }"
                    :class="progressStep > n - 1 ? '' : 'bg-gray-200 dark:bg-gray-800'" />
            </div>

            <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
              <!-- STEP 1: service -->
              <div v-if="step === 1" class="flex flex-col gap-4">
                <h2 class="font-semibold text-lg text-gray-900 dark:text-white">{{ t('plans.chooseService') || 'Выберите услугу' }}</h2>
                <div v-if="!services.length" class="text-sm text-gray-500 py-8 text-center">{{ t('plans.noServicesYet') || 'Услуги ещё не добавлены' }}</div>
                <div v-for="grp in catsWithServices" :key="grp.cat.id">
                  <div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{{ grp.cat.name }}</div>
                  <button v-for="s in grp.list" :key="s.id" type="button"
                    class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 mb-2 hover:border-primary-400 hover:shadow-sm transition flex items-center gap-3"
                    @click="pickService(s)">
                    <span class="w-1.5 h-11 rounded-full flex-shrink-0" :style="{ background: s.color || accent }" />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ s.name }}</div>
                      <div class="text-xs text-gray-500">{{ s.durationMinutes }} {{ t('plans.min') || 'мин' }}<span v-if="s.price"> · {{ s.price }} {{ currency }}</span></div>
                    </div>
                    <UIcon name="lucide:chevron-right" class="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                </div>
                <div v-if="uncategorized.length">
                  <button v-for="s in uncategorized" :key="s.id" type="button"
                    class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 mb-2 hover:border-primary-400 hover:shadow-sm transition flex items-center gap-3"
                    @click="pickService(s)">
                    <span class="w-1.5 h-11 rounded-full flex-shrink-0" :style="{ background: s.color || accent }" />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-gray-900 dark:text-white truncate">{{ s.name }}</div>
                      <div class="text-xs text-gray-500">{{ s.durationMinutes }} {{ t('plans.min') || 'мин' }}<span v-if="s.price"> · {{ s.price }} {{ currency }}</span></div>
                    </div>
                    <UIcon name="lucide:chevron-right" class="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                </div>
              </div>

              <!-- STEP 2: master / resource — grid of cards -->
              <div v-else-if="step === 2" class="flex flex-col gap-3">
                <button class="text-xs text-gray-400 flex items-center gap-1 self-start" @click="step = 1">
                  <UIcon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}
                </button>
                <h2 class="font-semibold text-lg text-gray-900 dark:text-white">{{ t('plans.chooseMaster') || 'Выберите мастера' }}</h2>
                <div class="text-sm text-gray-500 -mt-1">{{ chosenService?.name }}</div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
                  <button v-if="!chosenService?.requiresMaster" type="button"
                    class="rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition hover:shadow-sm"
                    :class="chosenMasterId === '' ? '' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-300'"
                    :style="chosenMasterId === '' ? { borderColor: accent, background: accent + '14' } : {}"
                    @click="chosenMasterId = ''; goToSlots()">
                    <span class="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                      <UIcon name="lucide:shuffle" class="w-6 h-6" />
                    </span>
                    <div class="font-medium text-sm text-gray-900 dark:text-white leading-tight">{{ t('plans.anyMaster') || 'Любой доступный' }}</div>
                    <div class="text-[11px] text-gray-500 leading-tight">{{ t('plans.anyMasterHint') || 'подберём по времени' }}</div>
                  </button>

                  <button v-for="m in eligibleMasters" :key="m.id" type="button"
                    class="rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition hover:shadow-sm"
                    :class="chosenMasterId === m.id ? '' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-300'"
                    :style="chosenMasterId === m.id ? { borderColor: accent, background: accent + '14' } : {}"
                    @click="chosenMasterId = m.id; goToSlots()">
                    <img v-if="m.photoUrl" :src="m.photoUrl" alt="" class="w-16 h-16 rounded-full object-cover" />
                    <span v-else class="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-semibold" :style="{ background: m.color || accent }">
                      {{ m.name.slice(0, 1).toUpperCase() }}
                    </span>
                    <div class="font-medium text-sm text-gray-900 dark:text-white leading-tight line-clamp-2">{{ m.name }}</div>
                    <div v-if="m.bio" class="text-[11px] text-gray-500 leading-tight line-clamp-2">{{ m.bio }}</div>
                  </button>
                </div>
                <div v-if="!eligibleMasters.length && chosenService?.requiresMaster" class="text-sm text-gray-500 py-6 text-center">
                  {{ t('plans.noMastersForService') || 'Нет мастеров для этой услуги' }}
                </div>
              </div>

              <!-- STEP 3: day + slot + contact -->
              <div v-else-if="step === 3" class="flex flex-col gap-3">
                <button class="text-xs text-gray-400 flex items-center gap-1 self-start" @click="step = masterStepSkipped ? 1 : 2">
                  <UIcon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}
                </button>
                <h2 class="font-semibold text-lg text-gray-900 dark:text-white">{{ t('plans.chooseTime') || 'Выберите время' }}</h2>

                <div class="flex gap-1.5 overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6 pb-1">
                  <button v-for="d in dayStrip" :key="d" type="button"
                    class="flex-shrink-0 w-14 rounded-xl border py-2 flex flex-col items-center gap-0.5 transition"
                    :class="[
                      chosenDate === d ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-800',
                      !openDays.has(d) && chosenDate !== d ? 'opacity-40' : '',
                    ]"
                    @click="chosenDate = d">
                    <span class="text-[10px] uppercase text-gray-400">{{ fmtDayShort(d).wd }}</span>
                    <span class="text-sm font-semibold">{{ fmtDayShort(d).dm.split(' ')[0] }}</span>
                  </button>
                </div>

                <div v-if="slotsLoading" class="py-6 text-center text-sm text-gray-500">{{ t('common.loading') || 'Загрузка…' }}</div>
                <div v-else-if="!slots.length" class="py-6 text-center text-sm text-gray-500">{{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}</div>
                <div v-else class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  <button v-for="sl in slots" :key="sl.startAt" type="button"
                    class="px-2 py-2.5 rounded-lg border text-sm font-medium transition"
                    :class="chosenSlot?.startAt === sl.startAt ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-800 hover:border-primary-300'"
                    @click="chosenSlot = sl">{{ fmtTime(sl.startAt) }}</button>
                </div>

                <div v-if="chosenSlot" class="border-t border-gray-200 dark:border-gray-800 pt-4 mt-1 flex flex-col gap-2.5">
                  <UInput v-model="form.name" size="lg" icon="i-heroicons-user" :placeholder="t('plans.yourName') || 'Ваше имя'" />
                  <PhoneInput v-model="form.phone" size="lg" :placeholder="t('plans.yourPhone') || 'Телефон'" />
                  <UInput v-model="form.comment" size="lg" icon="i-heroicons-chat-bubble-bottom-center-text" :placeholder="t('plans.commentOptional') || 'Комментарий (необязательно)'" />
                  <UButton block size="lg" class="border-0" :loading="submitting" :disabled="!form.name.trim() || !form.phone.trim()" :style="{ background: accent, color: onAccent }" @click="submit">
                    {{ t('plans.book') || 'Записаться' }} · {{ fmtDayShort(chosenDate).dm }}, {{ fmtTime(chosenSlot.startAt) }}
                  </UButton>
                  <p class="text-[11px] text-center text-gray-400">
                    {{ t('plans.agreeHint') || 'Нажимая «Записаться», вы соглашаетесь на обработку данных для записи.' }}
                  </p>
                </div>
              </div>

              <!-- STEP 4: done -->
              <div v-else class="text-center py-8 flex flex-col items-center gap-3">
                <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <UIcon name="lucide:check" class="w-8 h-8 text-emerald-600" />
                </div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('plans.booked') || 'Вы записаны!' }}</h2>
                <p class="text-sm text-gray-500">{{ chosenService?.name }} · {{ fmtDayShort(chosenDate).dm }} {{ chosenSlot ? fmtTime(chosenSlot.startAt) : '' }}</p>
                <div class="flex flex-col gap-2 w-full max-w-xs mt-2">
                  <UButton block variant="soft" :to="manageUrl">{{ t('plans.manageBooking') || 'Управлять записью' }}</UButton>
                  <UButton block variant="ghost" color="gray" @click="restart">{{ t('plans.newBookingLink') || 'Записаться ещё раз' }}</UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- footer -->
      <footer v-if="!pending && location" class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="max-w-3xl mx-auto px-4 py-6 space-y-3">
          <div class="font-semibold text-gray-900 dark:text-white">{{ brandName }}</div>
          <div v-if="location.address" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
            <UIcon name="lucide:map-pin" class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{{ location.address }}</span>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <a v-if="location.address" :href="twoGisSearchHref(location.address)" target="_blank" rel="noopener"
               class="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 transition-colors">
              <UIcon name="lucide:map" class="w-3.5 h-3.5" /> {{ t('menu.openIn2gis') || '2GIS' }}
            </a>
            <a v-if="location.phone" :href="telHref(location.phone)"
               class="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 transition-colors">
              <UIcon name="lucide:phone" class="w-3.5 h-3.5" /> {{ formatDisplayPhoneUniversal(location.phone) }}
            </a>
          </div>
          <div v-if="socialLinks.length" class="flex items-center gap-2 pt-1">
            <a v-for="link in socialLinks" :key="link.link" :href="link.link" target="_blank" rel="noopener"
               class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
               :aria-label="link.description || socialLabel(link.name)">
              <UIcon :name="socialIcon(link.name)" class="w-4 h-4" />
            </a>
          </div>
          <a :href="siteUrl" target="_blank" rel="noopener"
             class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors pt-2">
            <UIcon name="lucide:calendar-check" class="w-3 h-3" /> {{ t('plans.poweredBy') || 'Работает на lota' }}
          </a>
        </div>
      </footer>
    </div>

    <!-- "my bookings" modal — patron-authed list, or the link fallback -->
    <UModal v-model="trackOpen" :ui="{ width: 'sm:max-w-md' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ t('plans.myBookings') || 'Мои записи' }}</h3>
        </template>

        <!-- signed in as a patron: real history -->
        <div v-if="patron.isLoggedIn.value" class="space-y-2">
          <div v-if="myBookingsLoading" class="py-6 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" /></div>
          <template v-else>
            <div v-if="!myBookings || !myBookings.length" class="text-sm text-gray-500 py-4 text-center">
              {{ t('plans.noBookingsFound') || 'Записей не найдено' }}
            </div>
            <NuxtLink v-for="b in (myBookings || [])" :key="b.id" :to="`/to/${nsSlug}/plans/${b.publicToken}`"
              class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:border-primary-400 transition block">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-gray-900 dark:text-white text-sm">{{ fmtDateTime(b.startAt) }}</span>
                <UBadge :color="b.status === 'CANCELLED' ? 'red' : b.status === 'CONFIRMED' ? 'primary' : b.status === 'COMPLETED' ? 'emerald' : 'blue'" variant="subtle" size="xs">
                  {{ STATUS_RU[b.status] || b.status }}
                </UBadge>
              </div>
            </NuxtLink>
          </template>
        </div>

        <!-- not signed in: patron login + the local link fallback -->
        <div v-else class="space-y-3 text-sm">
          <p class="text-gray-500">
            {{ t('plans.trackSignInHint') || 'Войдите как клиент lota, чтобы видеть все свои записи здесь.' }}
          </p>
          <UButton block color="white" variant="solid" class="ring-1 ring-gray-300 dark:ring-gray-600" @click="patron.login()">
            <UIcon name="simple-icons:google" class="w-4 h-4" />
            {{ t('app.login') || 'Войти' }}
          </UButton>
          <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p class="text-gray-400 mb-2">{{ t('plans.trackByLinkHint') || 'Или откройте последнюю запись по сохранённой ссылке:' }}</p>
            <UButton v-if="lastManageLink" block variant="soft" :to="lastManageLink" icon="lucide:external-link">
              {{ t('plans.openMyLastBooking') || 'Открыть мою последнюю запись' }}
            </UButton>
            <p v-else class="text-gray-400">{{ t('plans.noLocalBooking') || 'На этом устройстве записей ещё нет.' }}</p>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
