<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { useNamespace } from '@/composables/useNamespace';
import { getErrorMessage } from '@/utils/types/errors';
import { plansApi } from '@/api/plans/ops';
import { PLANS_BRAND_COLORS } from '@/utils/color';
import PlansImageUpload from '@/components/plans/PlansImageUpload.vue';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();

useHead(() => ({ title: `${t('app.plans')} — ${titleBySlug(nsSlug.value) || ''}` }));

const TZ_OPTIONS = ['Asia/Almaty', 'Asia/Aqtobe', 'Asia/Aqtau', 'Asia/Oral', 'Europe/Moscow', 'Asia/Bishkek', 'Asia/Tashkent', 'Europe/Kyiv'];
const tzGuess = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Asia/Almaty'; } })();
const CURRENCIES = ['KZT', 'KGS', 'UZS', 'RUB', 'USD', 'EUR'];

const step = ref<1 | 2 | 3>(1);
const busy = ref(false);
const booting = ref(true);

const brand = reactive({
  name: titleBySlug(nsSlug.value) || '',
  logoUrl: '',
  primaryColor: '#7c3aed',
  welcomeMessage: '',
  currency: 'KZT',
});
const loc = reactive({
  name: '', address: '',
  timezone: TZ_OPTIONS.includes(tzGuess) ? tzGuess : 'Asia/Almaty',
});
const svc = reactive({ name: 'Консультация', duration: 60, price: 0 });

// keep the rest of the settings intact when we upsert the brand fields
let existingSettings: Record<string, any> = {};

onMounted(async () => {
  try {
    await getToken(nsSlug.value);
    const s = await plansApi.settings(nsSlug.value).catch(() => null);
    if (s) {
      existingSettings = { ...s };
      if (s.name) brand.name = s.name;
      if (s.logoUrl) brand.logoUrl = s.logoUrl;
      if (s.primaryColor) brand.primaryColor = s.primaryColor;
      if (s.welcomeMessage) brand.welcomeMessage = s.welcomeMessage;
      if (s.currency) brand.currency = s.currency;
    }
  } catch { /* fresh tenant — defaults are fine */ }
  finally { booting.value = false; }
});

function next() {
  if (step.value === 1 && !brand.name.trim()) {
    toast.add({ title: t('common.error') || 'Ошибка', description: t('plans.brandNameRequired') || 'Укажите название', color: 'red' });
    return;
  }
  if (step.value === 2 && !loc.name.trim()) {
    toast.add({ title: t('common.error') || 'Ошибка', description: t('plans.locationNameRequired') || 'Укажите название точки', color: 'red' });
    return;
  }
  step.value = (step.value + 1) as 1 | 2 | 3;
}

async function finish() {
  if (!svc.name.trim()) {
    toast.add({ title: t('common.error') || 'Ошибка', description: t('plans.serviceNameRequired') || 'Укажите услугу', color: 'red' });
    return;
  }
  busy.value = true;
  try {
    await getToken(nsSlug.value);

    // 1. brand — full upsert, brand fields merged over whatever's there
    await plansApi.upsertSettings(nsSlug.value, {
      name: brand.name.trim(),
      logoUrl: brand.logoUrl || '',
      primaryColor: brand.primaryColor || '#7c3aed',
      secondaryColor: existingSettings.secondaryColor || '#c026d3',
      welcomeMessage: brand.welcomeMessage.trim() || '',
      socialLinks: existingSettings.socialLinks || '',
      seoTitle: existingSettings.seoTitle || `${brand.name.trim()} — запись`,
      seoDescription: existingSettings.seoDescription || '',
      currency: brand.currency || 'KZT',
      autoConfirmBookings: existingSettings.autoConfirmBookings ?? true,
      minLeadTimeMinutes: existingSettings.minLeadTimeMinutes ?? 0,
      maxAdvanceDays: existingSettings.maxAdvanceDays ?? 90,
      cancellationWindowHours: existingSettings.cancellationWindowHours ?? 1,
      defaultBufferMinutes: existingSettings.defaultBufferMinutes ?? 0,
      reminderFirstHoursBefore: existingSettings.reminderFirstHoursBefore ?? 24,
      reminderSecondHoursBefore: existingSettings.reminderSecondHoursBefore ?? 2,
    });

    // 2. location + a default Mon–Sat 09:00–18:00 week
    const location = await plansApi.createLocation(nsSlug.value, {
      name: loc.name.trim(), address: loc.address.trim(), timezone: loc.timezone, isPrimary: true,
    });
    const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isDayOff: d === 0 }));
    await plansApi.setLocationWorkingHours(nsSlug.value, location.id, hours);

    // 3. first service. No standalone master — masters are namespace members
    //    with the "мастер" flag, added from Settings → Сотрудники.
    await plansApi.createService(nsSlug.value, {
      name: svc.name.trim(), durationMinutes: svc.duration, bufferAfterMinutes: 0, price: svc.price, requiresMaster: false,
    });

    toast.add({ title: t('common.success') || 'Готово', description: t('plans.onboardingDone') || 'Готово! Отметьте мастеров в «Сотрудниках» и делитесь ссылкой записи.', color: 'emerald' });
    navigateTo(`/${nsSlug.value}/plans?tour=1`);
  } catch (e) {
    toast.add({ title: t('common.error') || 'Ошибка', description: getErrorMessage(e, t), color: 'red' });
  } finally { busy.value = false; }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-10">
    <div class="text-center mb-6">
      <div class="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center mx-auto mb-3">
        <UIcon name="lucide:calendar-check" class="w-6 h-6 text-violet-500" />
      </div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.onboardingTitle') || 'Настроим запись за пару минут' }}</h1>
      <p class="text-sm text-gray-500 mt-1">{{ t('plans.onboardingSub') || 'Бренд, точка и первая услуга — мастеров добавите из «Сотрудников».' }}</p>
    </div>

    <div class="flex items-center gap-1.5 mb-4">
      <span v-for="n in 3" :key="n" class="flex-1 h-1 rounded-full transition-colors"
            :class="step >= n ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-800'" />
    </div>

    <div v-if="booting" class="py-16 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" /></div>

    <UCard v-else :ui="{ body: { padding: 'p-4 sm:p-5' } }">
      <!-- STEP 1 — brand -->
      <div v-if="step === 1" class="space-y-4">
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.brandStep') || 'Оформление' }}</h2>
        <div class="flex items-start gap-4">
          <PlansImageUpload v-model="brand.logoUrl" :ns-slug="nsSlug" :label="t('plans.logo') || 'Логотип'" />
          <div class="flex-1 space-y-3">
            <UFormGroup :label="t('plans.brandName') || 'Название для клиентов'" required>
              <UInput v-model="brand.name" size="lg" placeholder="Салон красоты «Айгерим»" autofocus />
            </UFormGroup>
            <UFormGroup :label="t('plans.currency') || 'Валюта'">
              <USelectMenu v-model="brand.currency" :options="CURRENCIES" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>
        </div>
        <UFormGroup :label="t('plans.primaryColor') || 'Основной цвет'" :hint="t('plans.primaryColorHint') || 'Цвет шапки публичной страницы'">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in PLANS_BRAND_COLORS" :key="c" type="button"
              class="h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110"
              :class="brand.primaryColor.toLowerCase() === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'"
              :style="{ background: c }"
              @click="brand.primaryColor = c"
            />
          </div>
        </UFormGroup>
        <UFormGroup :label="t('plans.welcomeMessage') || 'Приветствие'">
          <UTextarea v-model="brand.welcomeMessage" :rows="2" autoresize :placeholder="t('plans.welcomePlaceholder') || 'Пара слов для клиентов на странице записи'" />
        </UFormGroup>
        <UButton block size="lg" @click="next">{{ t('common.next') || 'Далее' }}</UButton>
      </div>

      <!-- STEP 2 — location -->
      <div v-else-if="step === 2" class="space-y-4">
        <button class="text-xs text-gray-400 flex items-center gap-1" @click="step = 1"><UIcon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}</button>
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.locationStep') || 'Точка' }}</h2>
        <UFormGroup :label="t('plans.locationName') || 'Название точки'" required>
          <UInput v-model="loc.name" size="lg" placeholder="Филиал в центре" autofocus />
        </UFormGroup>
        <UFormGroup :label="t('plans.address') || 'Адрес'">
          <UInput v-model="loc.address" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('plans.timezone') || 'Часовой пояс'">
          <USelectMenu v-model="loc.timezone" :options="TZ_OPTIONS" searchable :popper="{ strategy: 'fixed' }" />
        </UFormGroup>
        <p class="text-xs text-gray-400">{{ t('plans.defaultWeekHint') || 'Часы работы Пн–Сб 09:00–18:00 поставим по умолчанию — поменяете в настройках.' }}</p>
        <UButton block size="lg" @click="next">{{ t('common.next') || 'Далее' }}</UButton>
      </div>

      <!-- STEP 3 — first service -->
      <div v-else class="space-y-4">
        <button class="text-xs text-gray-400 flex items-center gap-1" @click="step = 2"><UIcon name="lucide:arrow-left" class="w-3.5 h-3.5" />{{ t('common.back') || 'Назад' }}</button>
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.firstService') || 'Первая услуга' }}</h2>
        <UFormGroup :label="t('plans.serviceName') || 'Название услуги'" required>
          <UInput v-model="svc.name" size="lg" autofocus />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('plans.durationMin') || 'Длительность, мин'">
            <UInput v-model.number="svc.duration" type="number" min="5" step="5" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('plans.price') || 'Цена'">
            <UInput v-model.number="svc.price" type="number" min="0" size="lg" />
          </UFormGroup>
        </div>
        <p class="text-xs text-gray-400">{{ t('plans.mastersLaterHint') || 'Мастера — это участники неймспейса с отметкой «мастер». Добавите их в Настройках → Сотрудники.' }}</p>
        <UButton block size="lg" :loading="busy" @click="finish">{{ t('plans.finish') || 'Завершить' }}</UButton>
      </div>
    </UCard>
  </div>
</template>
