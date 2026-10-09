<template>
  <div class="sf-topbar">
    <div class="flex flex-shrink-0 items-center gap-0.5">
      <button
        v-for="loc in available"
        :key="loc"
        type="button"
        class="sf-locale"
        :class="locale === loc ? 'sf-locale--on' : ''"
        @click="setLocale(loc)"
      >
        {{ LABELS[loc] || String(loc).toUpperCase() }}
      </button>
    </div>
    <a :href="siteUrl" target="_blank" rel="noopener" class="sf-powered flex-shrink-0">
      <picture>
        <source srcset="/assets/logo.webp" type="image/webp">
        <img src="/assets/logo.png" alt="" width="12" height="12" class="h-3 w-3">
      </picture>
      {{ poweredLabel }} <span v-if="!/lota/i.test(poweredLabel)" class="font-semibold">lota</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { resolveSiteUrl } from '@/utils/siteUrl';

defineProps<{ poweredLabel: string }>();

const { locale, setLocale, available } = useI18n();
const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
const LABELS: Record<string, string> = { ru: 'РУ', kk: 'ҚАЗ', en: 'EN' };
</script>
