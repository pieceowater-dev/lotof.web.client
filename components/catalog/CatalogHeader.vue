<template>
  <header class="mb-8">
    <NuxtLink v-if="back" to="/catalog" class="catalog-back group">
      <UIcon name="lucide:arrow-left" class="h-4 w-4 transition-transform duration-500 group-hover:-translate-x-0.5" />
      {{ t('home.backToCatalog') || 'Каталог' }}
    </NuxtLink>
    <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl" :class="back ? 'mt-5' : ''">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1.5 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300 md:text-base">{{ subtitle }}</p>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

defineProps<{ title: string; subtitle?: string; back?: boolean }>();
const { t } = useI18n();
</script>

<style scoped>
.catalog-back {
  display: inline-flex; align-items: center; gap: 0.45rem;
  border-radius: 9999px; padding: 0.45rem 1rem 0.45rem 0.8rem;
  font-size: 0.875rem; font-weight: 600; color: #334155;
  background: rgba(15, 23, 42, 0.04); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s;
}
.catalog-back:hover { background: rgba(15, 23, 42, 0.08); }
.catalog-back:active { transform: scale(0.96); }
.dark .catalog-back { color: #e5e5e5; background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .catalog-back:hover { background: rgba(255, 255, 255, 0.12); }
</style>
