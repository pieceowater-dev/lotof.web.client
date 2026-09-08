<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { useNamespace } from '@/composables/useNamespace';
import { getErrorMessage } from '@/utils/types/errors';
import { plansApi } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();

useHead(() => ({ title: `${t('app.plans')} — ${titleBySlug(nsSlug.value) || ''}` }));

const busy = ref(false);
const form = reactive({
  locationName: '',
  address: '',
  timezone: 'Asia/Almaty',
  serviceName: 'Консультация',
  duration: 60,
  price: 0,
  masterName: '',
});

const tzGuess = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Asia/Almaty'; } })();
form.timezone = tzGuess;

async function run() {
  if (!form.locationName || !form.serviceName || !form.masterName) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired') || 'Заполните поля', color: 'red' });
    return;
  }
  busy.value = true;
  try {
    await getToken(nsSlug.value);
    const loc = await plansApi.createLocation(nsSlug.value, { name: form.locationName, address: form.address, timezone: form.timezone, isPrimary: true });
    const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isDayOff: d === 0 }));
    await plansApi.setLocationWorkingHours(nsSlug.value, loc.id, hours);
    const svc = await plansApi.createService(nsSlug.value, { name: form.serviceName, durationMinutes: form.duration, bufferAfterMinutes: 0, price: form.price, requiresMaster: true });
    const master = await plansApi.createMaster(nsSlug.value, { locationId: loc.id, name: form.masterName, seedWorkingHoursFromLocation: true });
    await plansApi.setMasterServices(nsSlug.value, master.id, [{ serviceId: svc.id }]);
    toast.add({ title: t('common.success'), description: t('plans.onboardingDone') || 'Готово! Можно записывать клиентов.', color: 'emerald' });
    navigateTo(`/${nsSlug.value}/plans`);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { busy.value = false; }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-10 flex flex-col gap-4">
    <div class="text-center">
      <Icon name="lucide:calendar-check" class="w-10 h-10 mx-auto text-violet-500 mb-2" />
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.onboardingTitle') || 'Настроим запись за минуту' }}</h1>
      <p class="text-sm text-gray-500 mt-1">{{ t('plans.onboardingSub') || 'Одна точка, одна услуга и один мастер — остальное добавите потом.' }}</p>
    </div>

    <label class="text-xs font-medium text-gray-500">{{ t('plans.locationName') || 'Название точки' }}
      <input v-model="form.locationName" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm mt-1" placeholder="Барбершоп в центре" /></label>
    <label class="text-xs font-medium text-gray-500">{{ t('plans.address') || 'Адрес' }}
      <input v-model="form.address" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm mt-1" /></label>
    <label class="text-xs font-medium text-gray-500">{{ t('plans.timezone') || 'Часовой пояс' }}
      <input v-model="form.timezone" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm mt-1" /></label>

    <div class="grid grid-cols-3 gap-2">
      <label class="text-xs font-medium text-gray-500 col-span-3">{{ t('plans.firstService') || 'Первая услуга' }}
        <input v-model="form.serviceName" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm mt-1" /></label>
      <label class="text-xs text-gray-500">{{ t('plans.durationMin') || 'Мин' }}<input v-model.number="form.duration" type="number" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
      <label class="text-xs text-gray-500 col-span-2">{{ t('plans.price') || 'Цена' }}<input v-model.number="form.price" type="number" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
    </div>

    <label class="text-xs font-medium text-gray-500">{{ t('plans.firstMaster') || 'Первый мастер' }}
      <input v-model="form.masterName" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm mt-1" placeholder="Я работаю один → впишите своё имя" /></label>

    <UButton block size="lg" :loading="busy" @click="run">{{ t('plans.finish') || 'Готово' }}</UButton>
  </div>
</template>
