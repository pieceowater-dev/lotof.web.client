<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'full' });

import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getCatalogBusinesses, type CatalogBusiness } from '@/api/hub/catalog';
import { FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';
import { logError } from '@/utils/logger';
import CatalogHeader from '@/components/catalog/CatalogHeader.vue';

const { t } = useI18n();

// A single-vertical view of the Catalog: lota Plans businesses only
// (appointment/booking services). Real data now — plans.gtw's catalogsync
// pushes each tenant's locations into lotof.hub.msvc.core with source=PLANS.
//
// B1: useAsyncData (not onMounted) so the server renders the real list
// instead of an empty shell + spinner, and the result rides the Nuxt
// payload instead of a client-side refetch after hydration. Public,
// unauthenticated query -- no token/window dependency to worry about.
const { data: businesses, pending: loading } = await useAsyncData<CatalogBusiness[]>(
  'services-catalog-businesses',
  async () => {
    try {
      const { rows } = await getCatalogBusinesses({ length: FilterPaginationLengthEnum.OneHundred });
      return rows;
    } catch (e) {
      logError('[services] failed to load catalog businesses', e);
      return [];
    }
  },
  { default: () => [] },
);

const plansBusinesses = computed(() => {
  // Dedupe by namespace — one card per salon, not per location.
  const seen = new Set<string>();
  return (businesses.value || [])
    .filter((b) => (b.source || 'MENU') === 'PLANS')
    .filter((b) => {
      const key = b.namespaceSlug || b.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
});

const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: () => `${t('home.servicesTitle') || 'Услуги'} — lota`,
  description: () => t('home.servicesSubtitle') || 'Запись и бронирование на lota Plans',
  ogType: 'website',
  ogUrl: `${siteUrl}/services`,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 pb-16 pt-6 md:pt-10">
    <div class="flex flex-col">
      <CatalogHeader back :title="t('home.servicesTitle') || 'Услуги'" :subtitle="t('home.servicesSubtitle') || 'Запись и бронирование на lota Plans'" />

      <div v-if="loading" class="py-4"><AppSkeleton variant="cards" :rows="6" /></div>

      <div v-else-if="!plansBusinesses.length"
           class="catalog-panel p-8 md:p-10 flex flex-col items-center text-center gap-3">
        <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
          <UIcon name="lucide:calendar-check" class="w-7 h-7 text-violet-500" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ t('home.servicesComingSoonTitle') || 'Здесь пока нет заведений' }}
        </h3>
        <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
          {{ t('home.servicesEmptySubtitle') || 'Салоны и мастера с онлайн-записью на lota Plans появятся здесь.' }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="b in plansBusinesses"
          :key="b.id"
          :to="`/to/${b.namespaceSlug}/plans`"
          class="bezel bezel-hover group block"
        >
          <div class="bezel-core overflow-hidden">
          <div class="h-32 bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/10 flex items-center justify-center">
            <img v-if="b.logoUrl" :src="b.logoUrl" alt="" class="h-16 w-16 rounded-2xl object-contain bg-white shadow-sm" />
            <UIcon v-else name="lucide:calendar-check" class="w-10 h-10 text-violet-400" />
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-bold tracking-tight text-gray-900 dark:text-gray-100 truncate">{{ b.name }}</h3>
              <span v-if="b.reviewCount" class="flex items-center gap-1 text-xs text-amber-500 flex-shrink-0">
                <UIcon name="lucide:star" class="w-3.5 h-3.5 fill-current" /> {{ b.avgRating.toFixed(1) }}
              </span>
            </div>
            <p v-if="b.address" class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{{ b.address }}</p>
            <p v-else-if="b.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{{ b.description }}</p>
            <span class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
              {{ t('home.bookNow') || 'Записаться' }}
              <UIcon name="lucide:arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
