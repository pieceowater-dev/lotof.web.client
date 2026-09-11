<script lang="ts" setup>
definePageMeta({ layout: 'quiet' });

import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { useMenuToken } from '@/composables/useMenuToken';
import { getMenuPlans } from '@/api/menu/plans/plans';
import { getActiveMenuSubscription } from '@/api/menu/plans/getActiveSubscription';
import { subscribeToMenuPlan } from '@/api/menu/plans/subscribe';

const APP_BUNDLE = 'pieceowater.menu';
const token = useMenuToken();

const config: AppPlansPageConfig = {
  appBundle: APP_BUNDLE,
  appKey: 'menu',
  title: 'Тарифы — Orders',
  token,
  loadPlans: (ns) => getMenuPlans(ns, false),
  loadActiveSubscription: async ({ nsSlug, hubToken }) => {
    const s = await getActiveMenuSubscription(nsSlug, APP_BUNDLE, hubToken);
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
  subscribe: async ({ nsSlug, hubToken, planCode }) => {
    const s = await subscribeToMenuPlan({ nsSlug, planCode, appBundle: APP_BUNDLE, hubToken });
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
