<script lang="ts" setup>
import AppTable from '@/components/ui/AppTable.vue';
import { useI18n } from '@/composables/useI18n';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import { CURRENCIES, DEFAULT_CURRENCY_CODE, formatMoney } from '@/utils/currency';
import type { AtraceOvertimeRate, AtracePenaltyRule } from '@/api/atrace/salary/payroll';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

const overtimeRates = ref<AtraceOvertimeRate[]>([]);
const penaltyRules = ref<AtracePenaltyRule[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

const showOvertimeModal = ref(false);
const overtimeEditing = ref<AtraceOvertimeRate | null>(null);
const overtimeForm = ref<Omit<AtraceOvertimeRate, 'id'> & { id?: string }>({
  name: '',
  calcType: 'multiplier',
  multiplier: 1.5,
  fixedAmountPerHour: 0,
  currency: DEFAULT_CURRENCY_CODE,
  comment: '',
});

const showPenaltyModal = ref(false);
const penaltyEditing = ref<AtracePenaltyRule | null>(null);
const penaltyForm = ref<Omit<AtracePenaltyRule, 'id'> & { id?: string }>({
  name: '',
  type: 'absence',
  calcType: 'percent',
  percentOfSalary: 10,
  amount: 0,
  lateThresholdCount: 3,
  currency: DEFAULT_CURRENCY_CODE,
  comment: '',
});

const overtimeColumns = computed(() => ([
  { key: 'name', label: t('common.name') || 'Название' },
  { key: 'rate', label: t('app.overtimeRate') || 'Ставка' },
  { key: 'actions', label: t('common.actions') },
]));

const penaltyColumns = computed(() => ([
  { key: 'name', label: t('common.name') || 'Название' },
  { key: 'type', label: t('app.penaltyType') || 'Тип' },
  { key: 'penaltyValue', label: t('app.penaltyAmount') || 'Сумма' },
  { key: 'actions', label: t('common.actions') },
]));

function overtimeRateLabel(rate: AtraceOvertimeRate): string {
  return rate.calcType === 'fixed'
    ? formatMoney(rate.fixedAmountPerHour, rate.currency) + '/' + (t('app.perHour') || 'ч')
    : `x${rate.multiplier}`;
}

function penaltyValueLabel(rule: AtracePenaltyRule): string {
  return rule.calcType === 'percent'
    ? `${rule.percentOfSalary}%`
    : formatMoney(rule.amount, rule.currency);
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetOvertimeRates, atraceGetPenaltyRules } = await import('@/api/atrace/salary/payroll');
    const [rates, rules] = await Promise.all([
      atraceGetOvertimeRates(nsSlug.value),
      atraceGetPenaltyRules(nsSlug.value),
    ]);
    overtimeRates.value = rates;
    penaltyRules.value = rules;
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.salary.manage')
      ? (t('app.salaryPermissionError') || 'Недостаточно прав')
      : (t('app.attendanceLoadFailed') || 'Не удалось загрузить');
  } finally {
    loading.value = false;
  }
}

function openCreateOvertime() {
  overtimeEditing.value = null;
  overtimeForm.value = {
    name: '',
    calcType: 'multiplier',
    multiplier: 1.5,
    fixedAmountPerHour: 0,
    currency: DEFAULT_CURRENCY_CODE,
    comment: '',
  };
  showOvertimeModal.value = true;
}
function openEditOvertime(rate: AtraceOvertimeRate) {
  overtimeEditing.value = rate;
  overtimeForm.value = { ...rate, comment: rate.comment || '' };
  showOvertimeModal.value = true;
}
async function saveOvertime() {
  saving.value = true;
  error.value = null;
  try {
    if (overtimeEditing.value) {
      const { atraceUpdateOvertimeRate } = await import('@/api/atrace/salary/payroll');
      await atraceUpdateOvertimeRate({ ...overtimeForm.value, id: overtimeEditing.value.id } as AtraceOvertimeRate, nsSlug.value);
    } else {
      const { atraceCreateOvertimeRate } = await import('@/api/atrace/salary/payroll');
      await atraceCreateOvertimeRate(overtimeForm.value, nsSlug.value);
    }
    showOvertimeModal.value = false;
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}
async function removeOvertime(rate: AtraceOvertimeRate) {
  try {
    const { atraceDeleteOvertimeRate } = await import('@/api/atrace/salary/payroll');
    await atraceDeleteOvertimeRate(rate.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось удалить';
  }
}

function openCreatePenalty() {
  penaltyEditing.value = null;
  penaltyForm.value = {
    name: '',
    type: 'absence',
    calcType: 'percent',
    percentOfSalary: 10,
    amount: 0,
    lateThresholdCount: 3,
    currency: DEFAULT_CURRENCY_CODE,
    comment: '',
  };
  showPenaltyModal.value = true;
}
function openEditPenalty(rule: AtracePenaltyRule) {
  penaltyEditing.value = rule;
  penaltyForm.value = { ...rule, comment: rule.comment || '' };
  showPenaltyModal.value = true;
}
async function savePenalty() {
  saving.value = true;
  error.value = null;
  try {
    if (penaltyEditing.value) {
      const { atraceUpdatePenaltyRule } = await import('@/api/atrace/salary/payroll');
      await atraceUpdatePenaltyRule({ ...penaltyForm.value, id: penaltyEditing.value.id } as AtracePenaltyRule, nsSlug.value);
    } else {
      const { atraceCreatePenaltyRule } = await import('@/api/atrace/salary/payroll');
      await atraceCreatePenaltyRule(penaltyForm.value, nsSlug.value);
    }
    showPenaltyModal.value = false;
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}
async function removePenalty(rule: AtracePenaltyRule) {
  try {
    const { atraceDeletePenaltyRule } = await import('@/api/atrace/salary/payroll');
    await atraceDeletePenaltyRule(rule.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось удалить';
  }
}

function penaltyTypeLabel(type: string): string {
  return type === 'late_threshold' ? (t('app.penaltyLateThreshold') || 'За опоздания') : (t('app.penaltyAbsence') || 'За прогул');
}

onMounted(load);
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-6 overflow-auto pb-safe-or-4">
    <div
      v-if="error"
      class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-base font-medium">
          {{ t('app.overtimeRates') || 'Ставки переработки' }}
        </h2>
        <UButton
          size="xs"
          color="primary"
          icon="lucide:plus"
          @click="openCreateOvertime"
        >
          {{ t('app.createRate') || 'Создать ставку' }}
        </UButton>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ t('app.overtimeRatesHint') || 'Применяется к часам, отработанным сверх нормы (вне графика)' }}
      </p>
      <div v-if="loading" class="text-gray-500 text-sm">{{ t('app.loading') }}</div>
      <div v-else-if="overtimeRates.length === 0" class="text-gray-500 text-sm py-3">{{ t('app.noRates') || 'Ставок пока нет' }}</div>
      <div v-else class="h-[360px]">
        <AppTable
          :rows="overtimeRates"
          :columns="overtimeColumns"
          :loading="loading"
          :total="overtimeRates.length"
          :pagination="false"
        >
          <template #rate-data="{ row }">
            {{ overtimeRateLabel(row) }}
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end gap-1">
              <UButton size="xs" variant="soft" color="primary" icon="lucide:pencil" @click="openEditOvertime(row)">{{ t('common.edit') }}</UButton>
              <UButton size="xs" variant="soft" color="red" icon="lucide:trash-2" @click="removeOvertime(row)" />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-base font-medium">
          {{ t('app.penaltyRules') || 'Штрафы' }}
        </h2>
        <UButton
          size="xs"
          color="primary"
          icon="lucide:plus"
          @click="openCreatePenalty"
        >
          {{ t('app.createRule') || 'Создать штраф' }}
        </UButton>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ t('app.penaltyRulesHint') || 'За прогул — списание за каждый непосещённый рабочий день; за опоздания — фиксированное списание при достижении N опозданий за период' }}
      </p>
      <div v-if="loading" class="text-gray-500 text-sm">{{ t('app.loading') }}</div>
      <div v-else-if="penaltyRules.length === 0" class="text-gray-500 text-sm py-3">{{ t('app.noRules') || 'Штрафов пока нет' }}</div>
      <div v-else class="h-[360px]">
        <AppTable
          :rows="penaltyRules"
          :columns="penaltyColumns"
          :loading="loading"
          :total="penaltyRules.length"
          :pagination="false"
        >
          <template #type-data="{ row }">
            {{ penaltyTypeLabel(row.type) }}
            <span v-if="row.type === 'late_threshold'" class="text-gray-500 text-xs">({{ row.lateThresholdCount }}+)</span>
          </template>
          <template #penaltyValue-data="{ row }">
            {{ penaltyValueLabel(row) }}
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end gap-1">
              <UButton size="xs" variant="soft" color="primary" icon="lucide:pencil" @click="openEditPenalty(row)">{{ t('common.edit') }}</UButton>
              <UButton size="xs" variant="soft" color="red" icon="lucide:trash-2" @click="removePenalty(row)" />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <UModal v-model="showOvertimeModal" :ui="{ width: 'w-full sm:max-w-lg' }">
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">{{ overtimeEditing ? t('common.edit') : (t('app.createRate') || 'Создать ставку') }}</h3>
        </template>
        <div class="flex flex-col gap-3">
          <UFormGroup :label="t('common.name') || 'Название'">
            <UInput v-model="overtimeForm.name" placeholder="Переработка x1.5" />
          </UFormGroup>
          <UFormGroup :label="t('app.calcType') || 'Способ расчёта'">
            <USelectMenu v-model="overtimeForm.calcType" :options="['multiplier', 'fixed']">
              <template #option="{ option }">{{ option === 'multiplier' ? (t('app.calcTypeMultiplier') || 'Множитель от оклада') : (t('app.calcTypeFixed') || 'Фиксированная сумма') }}</template>
              <template #label>{{ overtimeForm.calcType === 'multiplier' ? (t('app.calcTypeMultiplier') || 'Множитель от оклада') : (t('app.calcTypeFixed') || 'Фиксированная сумма') }}</template>
            </USelectMenu>
          </UFormGroup>
          <UFormGroup v-if="overtimeForm.calcType === 'multiplier'" :label="t('app.multiplier') || 'Множитель (например, 1.5 = x1.5 от часовой ставки)'">
            <UInput v-model.number="overtimeForm.multiplier" type="number" min="0" step="0.1" />
          </UFormGroup>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormGroup :label="t('app.amountPerHour') || 'Сумма за час'">
              <UInput v-model.number="overtimeForm.fixedAmountPerHour" type="number" min="0" step="0.01" />
            </UFormGroup>
            <UFormGroup :label="t('app.currency') || 'Валюта'">
              <USelectMenu v-model="overtimeForm.currency" :options="currencyOptions" value-attribute="value" option-attribute="label" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('common.comment') || 'Комментарий'">
            <UInput v-model="overtimeForm.comment" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="gray" @click="showOvertimeModal = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" @click="saveOvertime">{{ t('app.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showPenaltyModal" :ui="{ width: 'w-full sm:max-w-lg' }">
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">{{ penaltyEditing ? t('common.edit') : (t('app.createRule') || 'Создать штраф') }}</h3>
        </template>
        <div class="flex flex-col gap-3">
          <UFormGroup :label="t('common.name') || 'Название'">
            <UInput v-model="penaltyForm.name" placeholder="Штраф за прогул" />
          </UFormGroup>
          <UFormGroup :label="t('app.penaltyType') || 'Тип'">
            <USelectMenu v-model="penaltyForm.type" :options="['absence', 'late_threshold']">
              <template #option="{ option }">{{ penaltyTypeLabel(option) }}</template>
              <template #label>{{ penaltyTypeLabel(penaltyForm.type) }}</template>
            </USelectMenu>
          </UFormGroup>
          <UFormGroup v-if="penaltyForm.type === 'late_threshold'" :label="t('app.lateThresholdCount') || 'Порог опозданий (шт. в месяц)'">
            <UInput v-model.number="penaltyForm.lateThresholdCount" type="number" min="1" />
          </UFormGroup>
          <UFormGroup :label="t('app.calcType') || 'Способ расчёта'">
            <USelectMenu v-model="penaltyForm.calcType" :options="['percent', 'fixed']">
              <template #option="{ option }">{{ option === 'percent' ? (t('app.calcTypePercent') || 'Процент от зарплаты') : (t('app.calcTypeFixed') || 'Фиксированная сумма') }}</template>
              <template #label>{{ penaltyForm.calcType === 'percent' ? (t('app.calcTypePercent') || 'Процент от зарплаты') : (t('app.calcTypeFixed') || 'Фиксированная сумма') }}</template>
            </USelectMenu>
          </UFormGroup>
          <UFormGroup v-if="penaltyForm.calcType === 'percent'" :label="t('app.percentOfSalary') || 'Процент от зарплаты, %'">
            <UInput v-model.number="penaltyForm.percentOfSalary" type="number" min="0" max="100" step="1" />
          </UFormGroup>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormGroup :label="t('app.penaltyAmount') || 'Сумма штрафа'">
              <UInput v-model.number="penaltyForm.amount" type="number" min="0" step="0.01" />
            </UFormGroup>
            <UFormGroup :label="t('app.currency') || 'Валюта'">
              <USelectMenu v-model="penaltyForm.currency" :options="currencyOptions" value-attribute="value" option-attribute="label" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('common.comment') || 'Комментарий'">
            <UInput v-model="penaltyForm.comment" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="gray" @click="showPenaltyModal = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" @click="savePenalty">{{ t('app.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
