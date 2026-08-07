<template>
  <Teleport to="body">
    <div
      v-if="planModal.open"
      class="fixed inset-0 z-[70] overflow-y-auto p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ planModal.mode === 'create' ? t('admin.newPlan') : t('admin.editPlanTitle') }}
          </h3>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div class="flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Icon :name="selectedProjectIcon" class="h-5 w-5" />
            </div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{{ t('admin.planForApp') }}</div>
              <div class="text-base font-bold text-slate-900 dark:text-white">{{ selectedProjectTitle }}</div>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planName') }} *</label>
            <input
              v-model="planForm.name"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="A-Trace Pro"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planDescription') }}</label>
            <textarea
              v-model="planForm.description"
              rows="2"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.currency') }} *</label>
              <select
                v-model="planForm.currency"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.symbol }} {{ c.code }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.trialDays') }}</label>
              <input
                v-model.number="planForm.trialDays"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <template v-if="planModal.mode === 'create'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.monthlyPrice') }} *</label>
                <input
                  v-model.number="planForm.monthlyPrice"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.yearlyPrice') }} *</label>
                <input
                  v-model.number="planForm.yearlyPrice"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <p class="text-[11px] text-slate-400">{{ t('admin.planCreatesBothIntervals') }}</p>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planCode') }}</label>
              <input
                :value="generatedCodePrefix"
                type="text"
                disabled
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>
          </template>

          <template v-else>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {{ t('admin.price') }} ({{ planModal.plan?.interval === 'YEAR' ? t('admin.interval.year') : t('admin.interval.month') }}) *
              </label>
              <input
                v-model.number="planForm.amount"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </template>

          <div v-if="currentLimitKeys.length" class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planLimits') }}</div>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="limit in currentLimitKeys" :key="limit.key">
                <label class="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">{{ limit.label }}</label>
                <input
                  v-model="planForm.limits[limit.key]"
                  type="number"
                  min="0"
                  :placeholder="t('admin.planLimitUnlimited')"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          <p v-if="planModal.error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {{ planModal.error }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="$emit('close')"
          >
            {{ t('app.cancel') || 'Отмена' }}
          </button>
          <button
            :disabled="planModal.saving"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            @click="$emit('submit')"
          >
            <Icon v-if="planModal.saving" name="svg-spinners:ring-resize" class="h-3.5 w-3.5" />
            {{ t('app.save') || 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { CURRENCIES } from '@/utils/currency';

type PlanRow = {
  id: string;
  code: string;
  name: string;
  interval: string;
  [key: string]: unknown;
};

// planModal/planForm are two-way bound via v-model:plan-modal / v-model:
// plan-form from the parent's own reactive() objects -- mutating fields on
// the model here (v-model, etc.) updates the parent directly, same as if
// this markup were still inline, without tripping vue/no-mutating-props
// (which a plain prop would). Only the two actions (close, submit) go back
// up as events, since that logic stays owned by the parent (API calls,
// refreshData, toasts).
const planModal = defineModel<{ open: boolean; mode: 'create' | 'edit'; plan: PlanRow | null; saving: boolean; error: string }>('planModal', { required: true });
const planForm = defineModel<{
  name: string;
  description: string;
  currency: string;
  trialDays: number;
  monthlyPrice: number;
  yearlyPrice: number;
  amount: number;
  limits: Record<string, string>;
}>('planForm', { required: true });

defineProps<{
  currentLimitKeys: Array<{ key: string; label: string }>;
  generatedCodePrefix: string;
  selectedProjectIcon: string;
  selectedProjectTitle: string;
}>();

defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const { t } = useI18n();
</script>
