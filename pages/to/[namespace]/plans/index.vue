<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { plansPublicApi, type PlansLocation, type PlansService, type PlansMaster, type ServiceCategory, type PlansSettings, type PlansAvailableSlot } from '@/api/plans/ops';

definePageMeta({ layout: false });

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const sourceTag = computed(() => (route.query.t as string) || '');
const locationSlug = computed(() => (route.query.l as string) || '');

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

useHead(() => ({
  title: `Запись — ${brandName.value}`,
  meta: [{ name: 'description', content: settings.value?.welcomeMessage || `Онлайн-запись — ${brandName.value}` }],
}));

const location = computed<PlansLocation | null>(() => {
  if (locationSlug.value) return locations.value.find(l => l.slug === locationSlug.value) || null;
  return locations.value.find(l => l.isPrimary) || locations.value[0] || null;
});

// wizard
const step = ref<1 | 2 | 3 | 4>(1);
const chosenService = ref<PlansService | null>(null);
const chosenMasterId = ref<string>(''); // '' = any
const chosenDate = ref<string>(new Date().toISOString().slice(0, 10));
const chosenSlot = ref<PlansAvailableSlot | null>(null);
const eligibleMasters = ref<PlansMaster[]>([]);
const slots = ref<PlansAvailableSlot[]>([]);
const slotsLoading = ref(false);

const form = reactive({ name: '', phone: '', comment: '' });
const submitting = ref(false);
const doneToken = ref<string>('');

function servicesInCategory(catId: string | null) {
  return services.value.filter(s => (s.categoryId || null) === catId);
}
const uncategorized = computed(() => services.value.filter(s => !s.categoryId));

async function pickService(s: PlansService) {
  chosenService.value = s;
  chosenMasterId.value = '';
  eligibleMasters.value = [];
  try {
    eligibleMasters.value = (await plansPublicApi.masters(nsSlug.value, s.id, location.value?.id)).filter(m => m.isActive);
  } catch (e) { logError('[plans public] masters', e); }
  step.value = 2;
}

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }
function shiftDay(n: number) {
  const d = new Date(`${chosenDate.value}T00:00:00`); d.setDate(d.getDate() + n);
  chosenDate.value = d.toISOString().slice(0, 10);
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
watch([chosenMasterId, chosenDate, step], () => { if (step.value === 3) loadSlots(); });

function goToSlots() { step.value = 3; loadSlots(); }

async function submit() {
  if (!chosenSlot.value || !chosenService.value || !location.value || !form.name || !form.phone) return;
  submitting.value = true;
  try {
    const cgid = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
    const masterId = chosenMasterId.value || (chosenSlot.value.masterIds[0] || null);
    const booking = await plansPublicApi.createBooking(nsSlug.value, {
      locationId: location.value.id,
      masterId,
      clientName: form.name,
      clientPhone: form.phone,
      startAt: chosenSlot.value.startAt,
      services: [{ serviceId: chosenService.value.id, masterId }],
      comment: form.comment || null,
      sourceTag: sourceTag.value || null,
    }, cgid);
    doneToken.value = booking.publicToken;
    step.value = 4;
  } catch (e) {
    alert(getErrorMessage(e, t) || 'Не удалось создать запись, попробуйте другое время');
  } finally { submitting.value = false; }
}

const manageUrl = computed(() => `/to/${nsSlug.value}/plans/${doneToken.value}`);
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="max-w-lg mx-auto px-4 py-6">
      <div v-if="pending" class="py-24 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" /></div>
      <div v-else-if="fetchError || !location" class="py-24 text-center text-gray-500">
        {{ t('plans.publicUnavailable') || 'Страница записи недоступна' }}
      </div>
      <template v-else>
        <!-- header card -->
        <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0" :style="{ background: accent }">
              <Icon name="lucide:calendar-check" class="w-6 h-6" />
            </div>
            <div class="min-w-0">
              <h1 class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ brandName }}</h1>
              <p class="text-xs text-gray-500 truncate">{{ location.address || location.name }}</p>
            </div>
          </div>
          <p v-if="settings?.welcomeMessage" class="text-sm text-gray-600 dark:text-gray-300 mt-3">{{ settings.welcomeMessage }}</p>
          <div v-if="location.categoryTags?.length" class="flex flex-wrap gap-1.5 mt-3">
            <span v-for="tag in location.categoryTags" :key="tag" class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">{{ tag }}</span>
          </div>
        </div>

        <!-- step indicator -->
        <div class="flex items-center gap-1.5 mb-4 text-xs">
          <span v-for="n in 3" :key="n" class="flex-1 h-1 rounded-full" :style="{ background: step > n - 1 ? accent : '' }" :class="step > n - 1 ? '' : 'bg-gray-200 dark:bg-gray-800'" />
        </div>

        <!-- STEP 1: service -->
        <div v-if="step === 1" class="flex flex-col gap-4">
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.chooseService') || 'Выберите услугу' }}</h2>
          <div v-if="!services.length" class="text-sm text-gray-500 py-8 text-center">{{ t('plans.noServicesYet') || 'Услуги ещё не добавлены' }}</div>
          <template v-for="cat in categories" :key="cat.id">
            <div v-if="servicesInCategory(cat.id).length">
              <div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{{ cat.name }}</div>
              <button v-for="s in servicesInCategory(cat.id)" :key="s.id" type="button"
                class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 mb-2 hover:border-primary-400 transition"
                @click="pickService(s)">
                <div class="font-medium text-gray-900 dark:text-white">{{ s.name }}</div>
                <div class="text-xs text-gray-500">{{ s.durationMinutes }} мин · {{ s.price }} {{ settings?.currency || '' }}</div>
              </button>
            </div>
          </template>
          <div v-if="uncategorized.length">
            <button v-for="s in uncategorized" :key="s.id" type="button"
              class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 mb-2 hover:border-primary-400 transition"
              @click="pickService(s)">
              <div class="font-medium text-gray-900 dark:text-white">{{ s.name }}</div>
              <div class="text-xs text-gray-500">{{ s.durationMinutes }} мин · {{ s.price }} {{ settings?.currency || '' }}</div>
            </button>
          </div>
        </div>

        <!-- STEP 2: master -->
        <div v-else-if="step === 2" class="flex flex-col gap-3">
          <button class="text-xs text-gray-400 flex items-center gap-1 self-start" @click="step = 1"><Icon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}</button>
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.chooseMaster') || 'Выберите мастера' }}</h2>
          <div class="text-sm text-gray-500 -mt-1">{{ chosenService?.name }}</div>
          <button v-if="!chosenService?.requiresMaster" type="button"
            class="w-full text-left rounded-xl border p-3 transition"
            :class="chosenMasterId === '' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'"
            @click="chosenMasterId = ''; goToSlots()">
            <div class="font-medium text-gray-900 dark:text-white">{{ t('plans.anyMaster') || 'Любой доступный' }}</div>
            <div class="text-xs text-gray-500">{{ t('plans.anyMasterHint') || 'подберём по свободному времени' }}</div>
          </button>
          <button v-for="m in eligibleMasters" :key="m.id" type="button"
            class="w-full text-left rounded-xl border p-3 transition flex items-center gap-3"
            :class="chosenMasterId === m.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'"
            @click="chosenMasterId = m.id; goToSlots()">
            <span class="w-2.5 h-2.5 rounded-full" :style="{ background: m.color || accent }" />
            <div class="min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">{{ m.name }}</div>
              <div v-if="m.bio" class="text-xs text-gray-500 truncate">{{ m.bio }}</div>
            </div>
          </button>
          <div v-if="!eligibleMasters.length && chosenService?.requiresMaster" class="text-sm text-gray-500 py-6 text-center">{{ t('plans.noMastersForService') || 'Нет мастеров для этой услуги' }}</div>
        </div>

        <!-- STEP 3: date + slot + contact -->
        <div v-else-if="step === 3" class="flex flex-col gap-3">
          <button class="text-xs text-gray-400 flex items-center gap-1 self-start" @click="step = 2"><Icon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}</button>
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.chooseTime') || 'Выберите время' }}</h2>
          <div class="flex items-center justify-center gap-2">
            <UButton icon="lucide:chevron-left" size="xs" variant="ghost" @click="shiftDay(-1)" />
            <input type="date" v-model="chosenDate" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
            <UButton icon="lucide:chevron-right" size="xs" variant="ghost" @click="shiftDay(1)" />
          </div>
          <div v-if="slotsLoading" class="py-6 text-center text-sm text-gray-500">{{ t('common.loading') || 'Загрузка…' }}</div>
          <div v-else-if="!slots.length" class="py-6 text-center text-sm text-gray-500">{{ t('plans.noSlotsDay') || 'На этот день свободных окон нет' }}</div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            <button v-for="sl in slots" :key="sl.startAt" type="button"
              class="px-2 py-2 rounded-lg border text-sm"
              :class="chosenSlot?.startAt === sl.startAt ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300' : 'border-gray-300 dark:border-gray-700'"
              @click="chosenSlot = sl">{{ fmtTime(sl.startAt) }}</button>
          </div>

          <template v-if="chosenSlot">
            <div class="border-t border-gray-200 dark:border-gray-800 pt-3 flex flex-col gap-2">
              <input v-model="form.name" :placeholder="t('plans.yourName') || 'Ваше имя'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
              <input v-model="form.phone" type="tel" :placeholder="t('plans.yourPhone') || 'Телефон'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
              <input v-model="form.comment" :placeholder="t('plans.commentOptional') || 'Комментарий (необязательно)'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
              <UButton block size="lg" :loading="submitting" :disabled="!form.name || !form.phone" :style="{ background: accent }" @click="submit">
                {{ t('plans.book') || 'Записаться' }} · {{ fmtTime(chosenSlot.startAt) }}
              </UButton>
            </div>
          </template>
        </div>

        <!-- STEP 4: done -->
        <div v-else class="text-center py-10 flex flex-col items-center gap-3">
          <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Icon name="lucide:check" class="w-8 h-8 text-emerald-600" />
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('plans.booked') || 'Вы записаны!' }}</h2>
          <p class="text-sm text-gray-500">{{ chosenService?.name }} · {{ chosenDate }} {{ chosenSlot ? fmtTime(chosenSlot.startAt) : '' }}</p>
          <NuxtLink :to="manageUrl" class="text-sm text-primary-600 hover:underline">{{ t('plans.manageBooking') || 'Управлять записью (отмена / перенос)' }}</NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
