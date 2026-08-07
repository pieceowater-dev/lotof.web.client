<template>
  <Teleport to="body">
    <div
      v-if="cashPaymentModal.open"
      class="fixed inset-0 z-[70] overflow-y-auto p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.confirmCashPayment') }}
          </h3>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div class="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Icon :name="selectedProjectIcon" class="h-5 w-5" />
            </div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{{ t('admin.planForApp') }}</div>
              <div class="text-base font-bold text-slate-900 dark:text-white">{{ selectedProjectTitle }}</div>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.namespaceSlug') }} *</label>
            <input
              v-model.trim="cashPaymentForm.namespace"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="ns_ab12cd"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.plan') }} *</label>
            <select
              v-model="cashPaymentForm.planCode"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>{{ t('admin.selectPlan') }}</option>
              <option v-for="plan in activeProjectPlans" :key="plan.id" :value="plan.code">
                {{ plan.name }} ({{ plan.interval === 'YEAR' ? t('admin.interval.year') : t('admin.interval.month') }}) · {{ plan.amountCents / 100 }} {{ plan.currency }}
              </option>
            </select>
          </div>

          <p v-if="cashPaymentModal.error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {{ cashPaymentModal.error }}
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
            :disabled="cashPaymentModal.saving"
            class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            @click="$emit('submit')"
          >
            <Icon v-if="cashPaymentModal.saving" name="svg-spinners:ring-resize" class="h-3.5 w-3.5" />
            {{ t('admin.confirmCashPayment') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

type PlanRow = {
  id: string;
  code: string;
  name: string;
  interval: string;
  amountCents: number;
  currency: string;
  [key: string]: unknown;
};

// cashPaymentModal/cashPaymentForm are two-way bound via v-model:cash-
// payment-modal / v-model:cash-payment-form -- see PlanModal.vue for why
// defineModel instead of plain props (avoids vue/no-mutating-props while
// still mutating the parent's reactive() objects directly).
const cashPaymentModal = defineModel<{ open: boolean; saving: boolean; error: string }>('cashPaymentModal', { required: true });
const cashPaymentForm = defineModel<{ namespace: string; planCode: string }>('cashPaymentForm', { required: true });

defineProps<{
  activeProjectPlans: PlanRow[];
  selectedProjectIcon: string;
  selectedProjectTitle: string;
}>();

defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const { t } = useI18n();
</script>
