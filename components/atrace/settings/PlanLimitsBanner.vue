<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAtracePlanLimits } from '@/composables/useAtracePlanLimits';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const { planLimits, planName, planLimitsLoading, loadPlanLimits } = useAtracePlanLimits(nsSlug);

onMounted(() => {
  loadPlanLimits();
});
</script>

<template>
  <div
    v-if="planLimits !== null && !planLimitsLoading"
    class="mb-4"
  >
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-emerald-100 dark:border-gray-700 bg-emerald-50/60 dark:bg-gray-900/40 px-4 py-3">
      <div class="text-sm text-gray-700 dark:text-gray-200">
        <span class="font-semibold">{{ t('app.subscriptionPlans') || 'Plan' }}:</span>
        <span class="ml-1">{{ planName || '—' }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="px-2 py-1 rounded-full bg-white/70 dark:bg-gray-800 border border-emerald-100 dark:border-gray-700">
          {{ t('app.locations') || 'Locations' }}:
          <strong>{{ planLimits.max_posts ?? '∞' }}</strong>
        </span>
        <span class="px-2 py-1 rounded-full bg-white/70 dark:bg-gray-800 border border-emerald-100 dark:border-gray-700">
          {{ t('atrace.members.activeCount') || 'Active members' }}:
          <strong>{{ planLimits.max_employees ?? '∞' }}</strong>
        </span>
      </div>
    </div>
  </div>
</template>
