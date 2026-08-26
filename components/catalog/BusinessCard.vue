<script setup lang="ts">
import type { MockBusiness } from '@/utils/mockCatalog';

defineProps<{
  business: MockBusiness;
  isFavorite: boolean;
}>();

defineEmits<{ (e: 'toggle-favorite', key: string): void }>();
</script>

<template>
  <component
    :is="business.to ? 'NuxtLink' : 'div'"
    :to="business.to"
    class="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow block"
  >
    <div class="relative h-28 sm:h-32 bg-gradient-to-br flex items-center justify-center" :class="business.gradient">
      <img
        v-if="business.logoUrl"
        :src="business.logoUrl"
        :alt="business.name"
        class="w-full h-full object-contain p-4"
      >
      <UIcon v-else :name="business.icon" class="w-10 h-10" :class="business.iconColor" />
      <button
        type="button"
        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 dark:bg-gray-900/70 backdrop-blur flex items-center justify-center shadow-sm"
        @click.stop="$emit('toggle-favorite', business.key)"
      >
        <UIcon
          name="lucide:heart"
          class="w-4 h-4"
          :class="isFavorite ? 'text-rose-500 fill-rose-500' : 'text-gray-400'"
        />
      </button>
      <span
        v-if="business.badge"
        class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-900/80 text-[11px] font-medium text-gray-700 dark:text-gray-200 shadow-sm"
      >
        {{ business.badge }}
      </span>
    </div>
    <div class="p-3">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ business.name }}</h4>
      <div v-if="business.rating || business.priceTier" class="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <template v-if="business.rating">
          <UIcon name="lucide:star" class="w-3.5 h-3.5 text-amber-400" />
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ business.rating }}</span>
          <span v-if="business.reviews">({{ business.reviews }})</span>
          <span v-if="business.priceTier" class="mx-0.5">·</span>
        </template>
        <span v-if="business.priceTier">{{ business.priceTier }}</span>
      </div>
      <div v-if="business.distance" class="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <UIcon name="lucide:map-pin" class="w-3 h-3" />
        <span>{{ business.distance }}</span>
      </div>
    </div>
  </component>
</template>
