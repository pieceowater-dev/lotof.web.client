<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsPlanLimits } from '@/composables/useContactsPlanLimits';

const { t } = useI18n();
const route = useRoute();
const { token: hubToken } = useAuth();
const { planLimits, planName, planLimitsLoading, loadPlanLimits } = useContactsPlanLimits();

const nsSlug = computed(() => route.params.namespace as string);

function planLimitLabel(key: 'max_clients' | 'max_custom_fields' | 'max_loyalty_programs'): string {
  if (key === 'max_clients') {
    return t('app.limitActiveUsers') || 'Активные клиенты';
  }
  if (key === 'max_custom_fields') {
    return t('app.limitCustomFields') || 'Пользовательские поля';
  }
  return t('app.limitLoyaltyPrograms') || 'Программы лояльности';
}

onMounted(async () => {
  await loadPlanLimits(nsSlug.value, hubToken.value);
});
</script>

<template>
  <div
    v-if="planLimits !== null && !planLimitsLoading"
    class="rounded-lg border border-emerald-200 dark:border-gray-700 bg-emerald-50/50 dark:bg-gray-900/40 p-4"
  >
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">
          {{ t('app.subscriptionPlans') || 'Plan' }}: {{ planName || '—' }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('app.contactsSubtitle') || 'Manage your clients and partners.' }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-sm">
        <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-emerald-100 dark:border-gray-700">
          {{ planLimitLabel('max_clients') }}:
          <strong>{{ planLimits.max_clients ?? '∞' }}</strong>
        </span>
        <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-emerald-100 dark:border-gray-700">
          {{ planLimitLabel('max_custom_fields') }}:
          <strong>{{ planLimits.max_custom_fields ?? '∞' }}</strong>
        </span>
        <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-emerald-100 dark:border-gray-700">
          {{ planLimitLabel('max_loyalty_programs') }}:
          <strong>{{ planLimits.max_loyalty_programs ?? '∞' }}</strong>
        </span>
      </div>
    </div>
  </div>
</template>
