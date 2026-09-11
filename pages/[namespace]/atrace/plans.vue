<script lang="ts" setup>
import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { getPlans } from '@/api/atrace/plans/plans';
import { getActiveSubscription } from '@/api/atrace/plans/getActiveSubscription';
import { subscribeToPlan } from '@/api/atrace/plans/subscribe';

const APP_BUNDLE = 'pieceowater.atrace';
const token = useAtraceToken();

const config: AppPlansPageConfig = {
  appBundle: APP_BUNDLE,
  appKey: 'atrace',
  title: 'Тарифы — A-Trace',
  token,
  loadPlans: (ns) => getPlans(ns, false),
  loadActiveSubscription: async ({ nsSlug, hubToken }) => {
    const s = await getActiveSubscription(nsSlug, APP_BUNDLE, hubToken);
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
  subscribe: async ({ nsSlug, hubToken, planCode }) => {
    const s = await subscribeToPlan({ nsSlug, planCode, appBundle: APP_BUNDLE, hubToken });
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
