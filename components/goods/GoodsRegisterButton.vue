<script lang="ts" setup>
// Extracted out of GoodsNavTabs so it can sit in each page's own top header
// row (next to the title) instead of the toolbar row below -- it's the
// one-click "go sell something" escape hatch from anywhere in the
// back-office, so it should read as the most prominent thing on the page.
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
</script>

<template>
  <UButton
    data-tour="goods-register-btn"
    :to="`/${nsSlug}/goods/register`"
    icon="lucide:calculator"
    class="flex-shrink-0 !border-0 !text-white !bg-gradient-to-r !from-blue-600 !to-emerald-500 hover:!from-blue-700 hover:!to-emerald-600 shadow-sm"
  >
    {{ t('goods.openRegister') }}
  </UButton>
</template>
