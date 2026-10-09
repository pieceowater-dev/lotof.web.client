<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { isAtracePermissionError } from '@/utils/atracePermissions';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const lateArrivalTime = ref('09:15');
const earlyLeaveTime = ref('18:15');
const allowLatenessMakeup = ref(false);
const roundingMinutes = ref(0);
// USelectMenu treats a numeric 0 as "nothing selected" and shows an empty field; bind a string instead.
const roundingModel = computed({
  get: () => String(roundingMinutes.value),
  set: (v: string) => { roundingMinutes.value = Number(v) || 0; },
});
const roundingOptions = [
  { value: '0', label: t('app.roundingOff') || 'Без округления' },
  { value: '5', label: '5 ' + (t('app.minShort') || 'мин') },
  { value: '10', label: '10 ' + (t('app.minShort') || 'мин') },
  { value: '15', label: '15 ' + (t('app.minShort') || 'мин') },
];
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const readOnly = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetAttendanceSettings } = await import('@/api/atrace/attendance/settings');
    const settings = await atraceGetAttendanceSettings(nsSlug.value);
    lateArrivalTime.value = settings.lateArrivalThreshold;
    earlyLeaveTime.value = settings.earlyLeaveThreshold;
    allowLatenessMakeup.value = settings.allowLatenessMakeup;
    roundingMinutes.value = settings.roundingMinutes ?? 0;
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.attendance.view')
      ? (t('app.attendancePermissionError') || 'Недостаточно прав')
      : (t('app.attendanceLoadFailed') || 'Не удалось загрузить');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const { atraceUpdateAttendanceSettings } = await import('@/api/atrace/attendance/settings');
    const settings = await atraceUpdateAttendanceSettings(lateArrivalTime.value, earlyLeaveTime.value, allowLatenessMakeup.value, roundingMinutes.value, nsSlug.value);
    lateArrivalTime.value = settings.lateArrivalThreshold;
    earlyLeaveTime.value = settings.earlyLeaveThreshold;
    allowLatenessMakeup.value = settings.allowLatenessMakeup;
    roundingMinutes.value = settings.roundingMinutes ?? 0;
  } catch (e: any) {
    if (isAtracePermissionError(e, 'tracker.attendance.manage')) {
      readOnly.value = true;
      error.value = t('app.attendancePermissionError') || 'Недостаточно прав для изменения';
    } else {
      error.value = t('app.saveFailed') || 'Не удалось сохранить';
    }
  } finally {
    saving.value = false;
  }
}

onMounted(load);
import SectionHead from '@/components/atrace/SectionHead.vue';
import SectionEmpty from '@/components/atrace/SectionEmpty.vue';
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col max-w-2xl">
    <SectionHead
      :title="t('app.timeThresholds') || 'Пороги времени'"
      :hint="t('app.timeThresholdsHint') || 'Используется для подсветки опозданий/ранних уходов и подсчёта соответствующей статистики'"
    />

    <div
      v-if="error"
      class="at-notice at-notice--err"
    >
      {{ error }}
    </div>

    <div class="at-form">
      <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <UFormGroup :label="t('app.lateArrivalAfter')">
          <UInput
            v-model="lateArrivalTime"
            type="time"
            size="md"
            icon="i-heroicons-clock"
            :disabled="loading || readOnly"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
        <UFormGroup :label="t('app.earlyLeaveBefore')">
          <UInput
            v-model="earlyLeaveTime"
            type="time"
            size="md"
            icon="i-heroicons-clock"
            :disabled="loading || readOnly"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
      </div>

      <UFormGroup
        :label="t('app.roundWorkedHours') || 'Округление отработанных часов'"
        :help="t('app.roundWorkedHoursHint') || 'Итог за день округляется до ближайшего значения. Без округления — точный учёт до минуты.'"
      >
        <USelectMenu
          v-model="roundingModel"
          :options="roundingOptions"
          value-attribute="value"
          option-attribute="label"
          size="md"
          class="max-w-[260px]"
          :disabled="loading || readOnly"
          :popper="{ strategy: 'fixed' }"
        />
      </UFormGroup>

      <div class="at-switch">
        <UToggle
          v-model="allowLatenessMakeup"
          class="mt-0.5"
          :disabled="loading || readOnly"
        />
        <div>
          <p class="text-sm font-semibold">
            {{ t('app.allowLatenessMakeup') || 'Режим досидки' }}
          </p>
          <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">
            {{ t('app.allowLatenessMakeupHint') || 'Если сотрудник опоздал, но задержался на работе на столько же минут после конца смены — опоздание не засчитывается.' }}
          </p>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          size="md"
          color="primary"
          icon="i-heroicons-check"
          :loading="saving"
          :disabled="readOnly"
          @click="save"
        >
          {{ t('common.apply') || 'Применить' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
