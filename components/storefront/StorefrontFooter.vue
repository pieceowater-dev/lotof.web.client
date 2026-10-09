<template>
  <footer class="sf-footer">
    <div class="mx-auto max-w-3xl space-y-3 px-4 py-7">
      <div class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">{{ name }}</div>
      <div v-if="address" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
        <UIcon name="lucide:map-pin" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{{ address }}</span>
      </div>
      <div class="flex flex-wrap gap-2 pt-1">
        <a v-if="address" :href="twoGisSearchHref(address)" target="_blank" rel="noopener" class="sf-link-pill">
          <UIcon name="lucide:map" class="h-3.5 w-3.5" /> {{ mapLabel }}
        </a>
        <a v-if="phone" :href="telHref(phone)" class="sf-link-pill">
          <UIcon name="lucide:phone" class="h-3.5 w-3.5" /> {{ formatDisplayPhoneUniversal(phone) }}
        </a>
      </div>
      <div v-if="socials.length" class="flex items-center gap-2 pt-1">
        <a
          v-for="link in socials"
          :key="link.link"
          :href="link.link"
          target="_blank"
          rel="noopener"
          class="sf-social"
          :aria-label="link.description || socialLabel(link.name)"
        >
          <UIcon :name="socialIcon(link.name)" class="h-4 w-4" />
        </a>
      </div>
      <div class="flex items-center justify-between pt-2">
        <a :href="siteUrl" target="_blank" rel="noopener" class="sf-powered">
          <picture>
            <source srcset="/assets/logo.webp" type="image/webp">
            <img src="/assets/logo.png" alt="" width="12" height="12" class="h-3 w-3">
          </picture>
          {{ poweredLabel }}
        </a>
        <div class="flex items-center gap-0.5">
          <button v-for="loc in available" :key="loc" type="button" class="sf-locale" :class="locale === loc ? 'sf-locale--on' : ''" @click="setLocale(loc)">
            {{ LABELS[loc] || String(loc).toUpperCase() }}
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { resolveSiteUrl } from '@/utils/siteUrl';
import { telHref } from '@/utils/phoneLinks';
import { twoGisSearchHref } from '@/utils/geo';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import { socialIcon, socialLabel, type SocialLink } from '@/utils/social';

withDefaults(defineProps<{
  name: string;
  address?: string | null;
  phone?: string | null;
  socials?: SocialLink[];
  mapLabel: string;
  poweredLabel: string;
}>(), { address: null, phone: null, socials: () => [] });

const { locale, setLocale, available } = useI18n();
const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
const LABELS: Record<string, string> = { ru: 'РУ', kk: 'ҚАЗ', en: 'EN' };
</script>
