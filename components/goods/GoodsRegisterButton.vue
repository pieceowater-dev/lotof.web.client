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
  <!-- A quiet secondary button: every Goods page already has its own primary
       action (add, create a movement...), and two gradient buttons compete. -->
  <NuxtLink
    data-tour="goods-register-btn"
    :to="`/${nsSlug}/goods/register`"
    class="at-btn flex-shrink-0"
    :aria-label="t('goods.openRegister')"
  >
    <Icon name="lucide:calculator" class="h-4 w-4" />
    <span class="min-[420px]:hidden">{{ t("goods.register") }}</span>
    <span class="hidden min-[420px]:inline">{{ t("goods.openRegister") }}</span>
  </NuxtLink>
</template>
