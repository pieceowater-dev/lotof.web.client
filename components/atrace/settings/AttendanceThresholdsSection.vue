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
const roundingOptions = [
  { value: 0, label: t('app.roundingOff') || 'Без округления' },
  { value: 5, label: '5 ' + (t('app.minShort') || 'мин') },
  { value: 10, label: '10 ' + (t('app.minShort') || 'мин') },
  { value: 15, label: '15 ' + (t('app.minShort') || 'мин') },
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
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col max-w-xl">
    <h2 class="text-base font-medium mb-1">
      {{ t('app.timeThresholds') || 'Пороги времени' }}
    </h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
      {{ t('app.timeThresholdsHint') || 'Используется для подсветки опозданий/ранних уходов и подсчёта соответствующей статистики' }}
    </p>

    <div
      v-if="error"
      class="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
      <UFormGroup :label="t('app.lateArrivalAfter')">
        <UInput
          v-model="lateArrivalTime"
          type="time"
          size="sm"
          icon="i-heroicons-clock"
          :disabled="loading || readOnly"
          :ui="{ base: 'font-mono' }"
        />
      </UFormGroup>
      <UFormGroup :label="t('app.earlyLeaveBefore')">
        <UInput
          v-model="earlyLeaveTime"
          type="time"
          size="sm"
          icon="i-heroicons-clock"
          :disabled="loading || readOnly"
          :ui="{ base: 'font-mono' }"
        />
      </UFormGroup>
    </div>

    <UFormGroup
      :label="t('app.roundWorkedHours') || 'Округление отработанных часов'"
      :help="t('app.roundWorkedHoursHint') || 'Итог за день округляется до ближайшего значения. Без округления — точный учёт до минуты.'"
      class="mb-4"
    >
      <USelectMenu
        v-model="roundingMinutes"
        :options="roundingOptions"
        value-attribute="value"
        option-attribute="label"
        size="sm"
        class="max-w-[220px]"
        :disabled="loading || readOnly"
        :popper="{ strategy: 'fixed' }"
      />
    </UFormGroup>

    <div class="flex items-start gap-3 mb-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <UToggle
        v-model="allowLatenessMakeup"
        :disabled="loading || readOnly"
      />
      <div>
        <p class="text-sm font-medium">
          {{ t('app.allowLatenessMakeup') || 'Режим досидки' }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('app.allowLatenessMakeupHint') || 'Если сотрудник опоздал, но задержался на работе на столько же минут после конца смены — опоздание не засчитывается.' }}
        </p>
      </div>
    </div>

    <div>
      <UButton
        size="sm"
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
</template>
