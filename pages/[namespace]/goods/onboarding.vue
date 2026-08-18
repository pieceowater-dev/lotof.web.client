<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import OnboardingWizard from '@/components/goods/OnboardingWizard.vue';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('app.goods')} — ${titleBySlug(nsSlug.value)}` : t('app.goods'),
}));

function onCompleted() {
  navigateTo(`/${nsSlug.value}/goods`);
}
</script>

<template>
  <OnboardingWizard @completed="onCompleted" />
</template>
