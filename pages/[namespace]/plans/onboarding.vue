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

const TZ_OPTIONS = ['Asia/Almaty', 'Asia/Aqtobe', 'Asia/Aqtau', 'Asia/Oral', 'Europe/Moscow', 'Asia/Bishkek', 'Asia/Tashkent', 'Europe/Kyiv'];
const tzGuess = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Asia/Almaty'; } })();

const busy = ref(false);
const form = reactive({
  locationName: '', address: '', timezone: TZ_OPTIONS.includes(tzGuess) ? tzGuess : 'Asia/Almaty',
  serviceName: 'Консультация', duration: 60, price: 0, masterName: '',
});

async function run() {
  if (!form.locationName.trim() || !form.serviceName.trim() || !form.masterName.trim()) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired') || 'Заполните поля', color: 'red' });
    return;
  }
  busy.value = true;
  try {
    await getToken(nsSlug.value);
    const loc = await plansApi.createLocation(nsSlug.value, { name: form.locationName.trim(), address: form.address.trim(), timezone: form.timezone, isPrimary: true });
    const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isDayOff: d === 0 }));
    await plansApi.setLocationWorkingHours(nsSlug.value, loc.id, hours);
    const svc = await plansApi.createService(nsSlug.value, { name: form.serviceName.trim(), durationMinutes: form.duration, bufferAfterMinutes: 0, price: form.price, requiresMaster: true });
    const master = await plansApi.createMaster(nsSlug.value, { locationId: loc.id, name: form.masterName.trim(), seedWorkingHoursFromLocation: true });
    await plansApi.setMasterServices(nsSlug.value, master.id, [{ serviceId: svc.id }]);
    toast.add({ title: t('common.success'), description: t('plans.onboardingDone') || 'Готово! Можно записывать клиентов.', color: 'emerald' });
    navigateTo(`/${nsSlug.value}/plans`);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { busy.value = false; }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-10">
    <div class="text-center mb-6">
      <div class="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center mx-auto mb-3">
        <UIcon name="lucide:calendar-check" class="w-6 h-6 text-violet-500" />
      </div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.onboardingTitle') || 'Настроим запись за минуту' }}</h1>
      <p class="text-sm text-gray-500 mt-1">{{ t('plans.onboardingSub') || 'Одна точка, одна услуга и один мастер — остальное добавите потом.' }}</p>
    </div>

    <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
      <div class="space-y-3.5">
        <UFormGroup :label="t('plans.locationName') || 'Название точки'" required>
          <UInput v-model="form.locationName" placeholder="Барбершоп в центре" autofocus />
        </UFormGroup>
        <UFormGroup :label="t('plans.address') || 'Адрес'">
          <UInput v-model="form.address" />
        </UFormGroup>
        <UFormGroup :label="t('plans.timezone') || 'Часовой пояс'">
          <USelectMenu v-model="form.timezone" :options="TZ_OPTIONS" searchable :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <div class="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-3">
          <UFormGroup class="col-span-3" :label="t('plans.firstService') || 'Первая услуга'" required>
            <UInput v-model="form.serviceName" />
          </UFormGroup>
          <UFormGroup :label="t('plans.durationMin') || 'Мин'">
            <UInput v-model.number="form.duration" type="number" min="5" step="5" />
          </UFormGroup>
          <UFormGroup class="col-span-2" :label="t('plans.price') || 'Цена'">
            <UInput v-model.number="form.price" type="number" min="0" />
          </UFormGroup>
        </div>

        <UFormGroup class="pt-3 border-t border-gray-100 dark:border-gray-800" :label="t('plans.firstMaster') || 'Первый мастер'" required>
          <UInput v-model="form.masterName" :placeholder="t('plans.firstMasterHint') || 'Работаете один? Впишите своё имя'" />
        </UFormGroup>

        <UButton block size="lg" :loading="busy" @click="run">{{ t('plans.finish') || 'Готово' }}</UButton>
      </div>
    </UCard>
  </div>
</template>
