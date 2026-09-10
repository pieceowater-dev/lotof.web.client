<script lang="ts" setup>
import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { useTasksToken } from '@/composables/useTasksToken';
import { tasksPlansList } from '@/api/tasks/plans/plans';
import { tasksActiveSubscription } from '@/api/tasks/plans/getActiveSubscription';
import { tasksSubscribePlan } from '@/api/tasks/plans/subscribe';

const token = useTasksToken();

const config: AppPlansPageConfig = {
  appBundle: 'pieceowater.issues',
  appKey: 'issues',
  title: 'Тарифы — Issues',
  token,
  loadPlans: (ns) => tasksPlansList(ns, false),
  loadActiveSubscription: async ({ nsSlug, appToken }) => {
    const s = await tasksActiveSubscription(appToken, nsSlug);
    return s
      ? { planId: s.planId, planCode: null, status: s.status, trialEndsAt: s.trialEndsAt ?? null }
      : null;
  },
  subscribe: async ({ nsSlug, appToken, planCode }) => {
    const s = await tasksSubscribePlan(appToken, nsSlug, planCode);
    return s
      ? { planId: s.planId, planCode: null, status: s.status, trialEndsAt: s.trialEndsAt ?? null }
      : null;
  },
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
