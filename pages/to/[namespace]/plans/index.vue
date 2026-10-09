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
import StorefrontTopBar from '@/components/storefront/StorefrontTopBar.vue';
import StorefrontHero from '@/components/storefront/StorefrontHero.vue';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.vue';
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
const brandVars = computed(() => ({ '--brand': accent.value, '--brand-ink': onAccent.value }));
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
  <div class="sf h-screen overflow-y-auto" :style="brandVars">
    <div class="flex min-h-full flex-col">
      <StorefrontTopBar :powered-label="t('plans.poweredBy') || 'Работает на'" />

      <div v-if="pending" class="flex flex-1 items-center justify-center py-24">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin" :style="{ color: accent }" />
      </div>
      <div v-else-if="fetchError || !location" class="flex flex-1 items-center justify-center px-4 py-24 text-center text-gray-500">
        {{ t('plans.publicUnavailable') || 'Страница записи недоступна' }}
      </div>

      <template v-else>
        <StorefrontHero
          :name="brandName"
          :description="settings?.welcomeMessage"
          :logo-url="settings?.logoUrl"
          fallback-icon="lucide:calendar-check"
          :back-label="backHref ? (t('menu.backToCatalog') || 'Каталог') : null"
          @back="backHref && navigateTo(backHref)"
        >
          <template #actions>
            <button type="button" class="sf-pill" @click="openTrack">
              <UIcon name="lucide:ticket" class="h-4 w-4" />
              <span class="hidden sm:inline">{{ t('plans.myBookings') || 'Мои записи' }}</span>
            </button>
          </template>
          <template #chips>
            <a v-if="location.address" :href="twoGisSearchHref(location.address)" target="_blank" rel="noopener" class="sf-pill">
              <UIcon name="lucide:map-pin" class="h-3.5 w-3.5 flex-shrink-0" />
              <span class="truncate">{{ location.address }}</span>
              <UIcon name="lucide:external-link" class="h-3 w-3 flex-shrink-0 opacity-70" />
            </a>
            <span class="sf-pill flex-shrink-0">
              <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              {{ t('plans.bookingOpen') || 'Онлайн-запись открыта' }}
            </span>
          </template>
        </StorefrontHero>

        <!-- wizard -->
        <div class="w-full flex-1">
          <div class="mx-auto max-w-2xl px-4 py-7 sm:py-9">
            <!-- step progress -->
            <div v-if="step < 4" class="mb-5 flex items-center gap-1.5">
              <span
                v-for="n in totalSteps"
                :key="n"
                class="h-1.5 flex-1 rounded-full transition-colors duration-500"
                :style="{ background: progressStep > n - 1 ? 'var(--brand)' : '' }"
                :class="progressStep > n - 1 ? '' : 'bg-gray-200 dark:bg-white/10'"
              />
            </div>

            <div class="sf-card p-5 sm:p-7">
              <!-- STEP 1: service -->
              <div v-if="step === 1" class="flex flex-col gap-4">
                <h2 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.chooseService') || 'Выберите услугу' }}</h2>
                <div v-if="!services.length" class="py-8 text-center text-sm text-gray-500">{{ t('plans.noServicesYet') || 'Услуги ещё не добавлены' }}</div>
                <div v-for="grp in catsWithServices" :key="grp.cat.id">
                  <div class="sf-label mb-2">{{ grp.cat.name }}</div>
                  <button
                    v-for="s in grp.list"
                    :key="s.id"
                    type="button"
                    class="sf-option mb-2 flex w-full items-center gap-3 p-3.5 text-left"
                    @click="pickService(s)"
                  >
                    <span class="h-11 w-1.5 flex-shrink-0 rounded-full" :style="{ background: s.color || accent }" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-semibold text-gray-900 dark:text-white">{{ s.name }}</div>
                      <div class="text-xs text-gray-500">{{ s.durationMinutes }} {{ t('plans.min') || 'мин' }}<span v-if="s.price"> · {{ s.price }} {{ currency }}</span></div>
                    </div>
                    <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300" />
                  </button>
                </div>
                <div v-if="uncategorized.length">
                  <button
                    v-for="s in uncategorized"
                    :key="s.id"
                    type="button"
                    class="sf-option mb-2 flex w-full items-center gap-3 p-3.5 text-left"
                    @click="pickService(s)"
                  >
                    <span class="h-11 w-1.5 flex-shrink-0 rounded-full" :style="{ background: s.color || accent }" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-semibold text-gray-900 dark:text-white">{{ s.name }}</div>
                      <div class="text-xs text-gray-500">{{ s.durationMinutes }} {{ t('plans.min') || 'мин' }}<span v-if="s.price"> · {{ s.price }} {{ currency }}</span></div>
                    </div>
                    <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300" />
                  </button>
                </div>
              </div>

              <!-- STEP 2: master / resource — grid of cards -->
              <div v-else-if="step === 2" class="flex flex-col gap-3">
                <button type="button" class="flex items-center gap-1 self-start text-xs font-semibold text-gray-400 hover:text-gray-600" @click="step = 1">
                  <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />{{ t('common.back') || 'Назад' }}
                </button>
                <h2 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.chooseMaster') || 'Выберите мастера' }}</h2>
                <div class="-mt-1 text-sm text-gray-500">{{ chosenService?.name }}</div>

                <div class="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    v-if="!chosenService?.requiresMaster"
                    type="button"
                    class="sf-option flex flex-col items-center gap-2 p-4 text-center"
                    :class="chosenMasterId === '' ? 'sf-option--on' : ''"
                    @click="chosenMasterId = ''; goToSlots()"
                  >
                    <span class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10">
                      <UIcon name="lucide:shuffle" class="h-6 w-6" />
                    </span>
                    <div class="text-sm font-semibold leading-tight text-gray-900 dark:text-white">{{ t('plans.anyMaster') || 'Любой доступный' }}</div>
                    <div class="text-[11px] leading-tight text-gray-500">{{ t('plans.anyMasterHint') || 'подберём по времени' }}</div>
                  </button>

                  <button
                    v-for="m in eligibleMasters"
                    :key="m.id"
                    type="button"
                    class="sf-option flex flex-col items-center gap-2 p-4 text-center"
                    :class="chosenMasterId === m.id ? 'sf-option--on' : ''"
                    @click="chosenMasterId = m.id; goToSlots()"
                  >
                    <img v-if="m.photoUrl" :src="m.photoUrl" alt="" class="h-16 w-16 rounded-full object-cover">
                    <span v-else class="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white" :style="{ background: m.color || accent }">
                      {{ m.name.slice(0, 1).toUpperCase() }}
                    </span>
                    <div class="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 dark:text-white">{{ m.name }}</div>
                    <div v-if="m.bio" class="line-clamp-2 text-[11px] leading-tight text-gray-500">{{ m.bio }}</div>
                  </button>
                </div>
                <div v-if="!eligibleMasters.length && chosenService?.requiresMaster" class="py-6 text-center text-sm text-gray-500">
                  {{ t('plans.noMastersForService') || 'Нет мастеров для этой услуги' }}
                </div>
              </div>

              <!-- STEP 3: day + slot + contact -->
              <div v-else-if="step === 3" class="flex flex-col gap-3">
                <button type="button" class="flex items-center gap-1 self-start text-xs font-semibold text-gray-400 hover:text-gray-600" @click="step = masterStepSkipped ? 1 : 2">
                  <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />{{ t('common.back') || 'Назад' }}
                </button>
                <h2 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.chooseTime') || 'Выберите время' }}</h2>

                <div class="sf-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7">
                  <button
                    v-for="d in dayStrip"
                    :key="d"
                    type="button"
                    class="sf-option flex w-14 flex-shrink-0 flex-col items-center gap-0.5 py-2.5"
                    :class="[chosenDate === d ? 'sf-option--on' : '', !openDays.has(d) && chosenDate !== d ? 'opacity-40' : '']"
                    @click="chosenDate = d"
                  >
                    <span class="text-[10px] font-semibold uppercase text-gray-400">{{ fmtDayShort(d).wd }}</span>
                    <span class="text-sm font-bold text-gray-900 dark:text-white">{{ fmtDayShort(d).dm.split(' ')[0] }}</span>
                  </button>
                </div>

                <div v-if="slotsLoading" class="py-6 text-center text-sm text-gray-500">{{ t('common.loading') || 'Загрузка…' }}</div>
                <div v-else-if="!slots.length" class="py-6 text-center text-sm text-gray-500">{{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}</div>
                <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  <button
                    v-for="sl in slots"
                    :key="sl.startAt"
                    type="button"
                    class="sf-option px-2 py-2.5 text-sm font-semibold text-gray-900 dark:text-white"
                    :class="chosenSlot?.startAt === sl.startAt ? 'sf-option--on' : ''"
                    @click="chosenSlot = sl"
                  >{{ fmtTime(sl.startAt) }}</button>
                </div>

                <div v-if="chosenSlot" class="mt-1 flex flex-col gap-2.5 border-t border-gray-200 pt-4 dark:border-white/10">
                  <UInput v-model="form.name" size="lg" icon="i-heroicons-user" :placeholder="t('plans.yourName') || 'Ваше имя'" />
                  <PhoneInput v-model="form.phone" size="lg" :placeholder="t('plans.yourPhone') || 'Телефон'" />
                  <UInput v-model="form.comment" size="lg" icon="i-heroicons-chat-bubble-bottom-center-text" :placeholder="t('plans.commentOptional') || 'Комментарий (необязательно)'" />
                  <button type="button" class="sf-btn sf-btn--block mt-1" :disabled="submitting || !form.name.trim() || !form.phone.trim()" @click="submit">
                    <UIcon v-if="submitting" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                    {{ t('plans.book') || 'Записаться' }} · {{ fmtDayShort(chosenDate).dm }}, {{ fmtTime(chosenSlot.startAt) }}
                  </button>
                  <p class="text-center text-[11px] text-gray-400">
                    {{ t('plans.agreeHint') || 'Нажимая «Записаться», вы соглашаетесь на обработку данных для записи.' }}
                  </p>
                </div>
              </div>

              <!-- STEP 4: done -->
              <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
                <span class="flex h-16 w-16 items-center justify-center rounded-full" :style="{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: accent }">
                  <UIcon name="lucide:check" class="h-8 w-8" />
                </span>
                <h2 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.booked') || 'Вы записаны!' }}</h2>
                <p class="text-sm text-gray-500">{{ chosenService?.name }} · {{ fmtDayShort(chosenDate).dm }} {{ chosenSlot ? fmtTime(chosenSlot.startAt) : '' }}</p>
                <div class="mt-2 flex w-full max-w-xs flex-col gap-2">
                  <NuxtLink :to="manageUrl" class="sf-btn sf-btn--block">{{ t('plans.manageBooking') || 'Управлять записью' }}</NuxtLink>
                  <button type="button" class="sf-btn sf-btn--soft sf-btn--block" @click="restart">{{ t('plans.newBookingLink') || 'Записаться ещё раз' }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <StorefrontFooter
        v-if="!pending && location"
        :name="brandName"
        :address="location.address"
        :phone="location.phone"
        :socials="socialLinks"
        :map-label="t('menu.openIn2gis') || '2GIS'"
        :powered-label="t('plans.poweredBy') || 'Работает на lota'"
      />
    </div>

    <!-- "my bookings" modal — patron-authed list, or the link fallback -->
    <UModal v-model="trackOpen" :ui="{ width: 'sm:max-w-md', rounded: 'rounded-[2rem]', background: 'bg-white dark:bg-[#1a1a1a]', ring: 'ring-1 ring-black/5 dark:ring-white/10', shadow: 'shadow-2xl' }">
      <div class="sf-fields p-6" :style="brandVars">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ t('plans.myBookings') || 'Мои записи' }}</h3>
          <button type="button" class="sf-sheet-close" aria-label="Закрыть" @click="trackOpen = false"><UIcon name="lucide:x" class="h-4 w-4" /></button>
        </div>

        <!-- signed in as a patron: real history -->
        <div v-if="patron.isLoggedIn.value" class="space-y-2">
          <div v-if="myBookingsLoading" class="flex justify-center py-6"><UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin" :style="{ color: accent }" /></div>
          <template v-else>
            <div v-if="!myBookings || !myBookings.length" class="py-4 text-center text-sm text-gray-500">
              {{ t('plans.noBookingsFound') || 'Записей не найдено' }}
            </div>
            <NuxtLink
              v-for="b in (myBookings || [])"
              :key="b.id"
              :to="`/to/${nsSlug}/plans/${b.publicToken}`"
              class="sf-option block p-3.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ fmtDateTime(b.startAt) }}</span>
                <UBadge :color="b.status === 'CANCELLED' ? 'red' : b.status === 'CONFIRMED' ? 'primary' : b.status === 'COMPLETED' ? 'emerald' : 'blue'" variant="subtle" size="xs">
                  {{ STATUS_RU[b.status] || b.status }}
                </UBadge>
              </div>
            </NuxtLink>
          </template>
        </div>

        <!-- not signed in: patron login + the local link fallback -->
        <div v-else class="space-y-3 text-sm">
          <p class="text-gray-500">{{ t('plans.trackSignInHint') || 'Войдите как клиент lota, чтобы видеть все свои записи здесь.' }}</p>
          <button type="button" class="sf-btn sf-btn--block" @click="patron.login()">
            <UIcon name="simple-icons:google" class="h-4 w-4" />
            {{ t('app.login') || 'Войти' }}
          </button>
          <div class="border-t border-gray-100 pt-3 dark:border-white/10">
            <p class="mb-2 text-gray-400">{{ t('plans.trackByLinkHint') || 'Или откройте последнюю запись по сохранённой ссылке:' }}</p>
            <NuxtLink v-if="lastManageLink" :to="lastManageLink" class="sf-btn sf-btn--soft sf-btn--block">
              <UIcon name="lucide:external-link" class="h-4 w-4" />
              {{ t('plans.openMyLastBooking') || 'Открыть мою последнюю запись' }}
            </NuxtLink>
            <p v-else class="text-gray-400">{{ t('plans.noLocalBooking') || 'На этом устройстве записей ещё нет.' }}</p>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>
