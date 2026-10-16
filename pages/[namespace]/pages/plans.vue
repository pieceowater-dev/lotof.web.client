<script lang="ts" setup>
definePageMeta({ layout: 'quiet' });

import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { usePagesToken } from '@/composables/usePagesToken';
import { pagesApi, type PagesSubscription } from '@/api/pages/ops';
import { usePageTitle } from '@/composables/usePageTitle';
usePageTitle('pages', { section: 'plans' });

const APP_BUNDLE = 'pieceowater.pages';
const token = usePagesToken();

const toSub = (s: PagesSubscription | null) =>
  s ? { id: s.id, planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null } : null;

const config: AppPlansPageConfig = {
  appBundle: APP_BUNDLE,
  appKey: 'pages',
  title: 'Pages',
  token,
  loadPlans: async (ns) => ({ plans: await pagesApi.tariffs(ns) }),
  loadActiveSubscription: async ({ nsSlug }) => toSub(await pagesApi.subscription(nsSlug)),
  subscribe: async ({ nsSlug, planCode }) => toSub(await pagesApi.subscribe(nsSlug, planCode)),
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
