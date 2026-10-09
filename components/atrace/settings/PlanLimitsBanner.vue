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
    <div class="at-banner">
      <div class="text-sm text-gray-700 dark:text-gray-200">
        <span class="font-semibold">{{ t('app.subscriptionPlans') || 'Plan' }}:</span>
        <span class="ml-1">{{ planName || '—' }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="at-chip !text-sm !py-1 !px-3">
          {{ t('app.locations') || 'Locations' }}:
          <strong>{{ planLimits.max_posts ?? '∞' }}</strong>
        </span>
        <span class="at-chip !text-sm !py-1 !px-3">
          {{ t('atrace.members.activeCount') || 'Active members' }}:
          <strong>{{ planLimits.max_employees ?? '∞' }}</strong>
        </span>
      </div>
    </div>
  </div>
</template>
