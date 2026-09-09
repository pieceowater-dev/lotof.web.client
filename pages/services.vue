<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getCatalogBusinesses, type CatalogBusiness } from '@/api/hub/catalog';
import { FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';
import { logError } from '@/utils/logger';

const { t } = useI18n();

// A single-vertical view of the Catalog: lota Plans businesses only
// (appointment/booking services). Real data now — plans.gtw's catalogsync
// pushes each tenant's locations into lotof.hub.msvc.core with source=PLANS.
const businesses = ref<CatalogBusiness[]>([]);
const loading = ref(true);

const plansBusinesses = computed(() => {
  // Dedupe by namespace — one card per salon, not per location.
  const seen = new Set<string>();
  return businesses.value
    .filter((b) => (b.source || 'MENU') === 'PLANS')
    .filter((b) => {
      const key = b.namespaceSlug || b.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
});

onMounted(async () => {
  try {
    const { rows } = await getCatalogBusinesses({ length: FilterPaginationLengthEnum.OneHundred });
    businesses.value = rows;
  } catch (e) {
    logError('[services] failed to load catalog businesses', e);
  } finally {
    loading.value = false;
  }
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
  <div class="max-w-7xl mx-auto px-4 py-10 md:py-16">
    <div class="flex flex-col gap-6">
      <NuxtLink
        to="/catalog"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-fit"
      >
        <UIcon name="lucide:arrow-left" class="w-4 h-4" />
        {{ t('home.backToCatalog') || 'Каталог' }}
      </NuxtLink>

      <div>
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{{ t('home.servicesTitle') || 'Услуги' }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ t('home.servicesSubtitle') || 'Запись и бронирование на lota Plans' }}</p>
      </div>

      <div v-if="loading" class="py-16 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-gray-400" />
      </div>

      <div v-else-if="!plansBusinesses.length"
           class="rounded-3xl p-8 md:p-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3">
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
          class="group rounded-3xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div class="h-32 bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/20 flex items-center justify-center">
            <img v-if="b.logoUrl" :src="b.logoUrl" alt="" class="h-16 w-16 rounded-2xl object-contain bg-white shadow-sm" />
            <UIcon v-else name="lucide:calendar-check" class="w-10 h-10 text-violet-400" />
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ b.name }}</h3>
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
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
