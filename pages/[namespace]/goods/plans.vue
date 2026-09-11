<script lang="ts" setup>
definePageMeta({ layout: 'quiet' });

import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { getGoodsPlans } from '@/api/goods/plans/plans';
import { getActiveGoodsSubscription } from '@/api/goods/plans/getActiveSubscription';
import { subscribeToGoodsPlan } from '@/api/goods/plans/subscribe';

const APP_BUNDLE = 'pieceowater.goods';
const token = useGoodsToken();

const config: AppPlansPageConfig = {
  appBundle: APP_BUNDLE,
  appKey: 'goods',
  title: 'Тарифы — Goods',
  token,
  loadPlans: (ns) => getGoodsPlans(ns, false),
  loadActiveSubscription: async ({ nsSlug, appToken }) => {
    const s = await getActiveGoodsSubscription(nsSlug, appToken, APP_BUNDLE);
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
  subscribe: async ({ nsSlug, appToken, planCode }) => {
    const s = await subscribeToGoodsPlan({ nsSlug, planCode, goodsToken: appToken, appBundle: APP_BUNDLE });
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
