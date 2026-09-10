<script lang="ts" setup>
import AppPlansPage from '@/components/billing/AppPlansPage.vue';
import type { AppPlansPageConfig } from '@/composables/useAppPlansPage';
import { useContactsToken } from '@/composables/useContactsToken';
import { getContactsPlans } from '@/api/contacts/plans/plans';
import { getActiveContactsSubscription } from '@/api/contacts/plans/getActiveSubscription';
import { subscribeToContactsPlan } from '@/api/contacts/plans/subscribe';

const APP_BUNDLE = 'pieceowater.contacts';
const token = useContactsToken();

const config: AppPlansPageConfig = {
  appBundle: APP_BUNDLE,
  appKey: 'contacts',
  title: 'Тарифы — Contacts',
  token,
  loadPlans: (ns) => getContactsPlans(ns, false),
  loadActiveSubscription: async ({ nsSlug, hubToken }) => {
    const s = await getActiveContactsSubscription(nsSlug, APP_BUNDLE, hubToken);
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
  subscribe: async ({ nsSlug, hubToken, planCode }) => {
    const s = await subscribeToContactsPlan(nsSlug, planCode, APP_BUNDLE, hubToken);
    return s
      ? { planId: s.planId, planCode: s.planCode, status: s.status, trialEndsAt: s.trialEndDate ?? null }
      : null;
  },
};
</script>

<template>
  <AppPlansPage :config="config" />
</template>
