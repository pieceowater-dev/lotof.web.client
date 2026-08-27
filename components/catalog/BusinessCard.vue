<script setup lang="ts">
import type { MockBusiness } from '@/utils/mockCatalog';

defineProps<{
  business: MockBusiness;
  isFavorite: boolean;
}>();

defineEmits<{ (e: 'toggle-favorite', key: string): void }>();
</script>

<template>
  <!-- Two branches instead of a dynamic <component :is>: a runtime string
       -is didn't reliably resolve to the real NuxtLink component and
       silently produced a dead div instead (found live -- clicking cards
       did nothing). Verbose, but guaranteed to actually navigate. -->
  <NuxtLink
    v-if="business.to"
    :to="business.to"
    class="relative block rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
    style="aspect-ratio: 1 / 1"
  >
    <div class="absolute inset-0 bg-gradient-to-br flex items-center justify-center" :class="business.gradient">
      <img
        v-if="business.logoUrl"
        :src="business.logoUrl"
        :alt="business.name"
        class="w-full h-full object-cover"
      >
      <UIcon v-else :name="business.icon" class="w-10 h-10" :class="business.iconColor" />
    </div>

    <span
      v-if="business.badge"
      class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-900/80 text-[11px] font-medium text-gray-700 dark:text-gray-200 shadow-sm"
    >
      {{ business.badge }}
    </span>
    <button
      type="button"
      class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 dark:bg-gray-900/70 backdrop-blur flex items-center justify-center shadow-sm"
      @click.stop.prevent="$emit('toggle-favorite', business.key)"
    >
      <UIcon
        name="lucide:heart"
        class="w-4 h-4"
        :class="isFavorite ? 'text-rose-500 fill-rose-500' : 'text-gray-400'"
      />
    </button>

    <!-- Name (+ rating/distance, when present) overlaid on the photo via a
         gradient scrim, rather than a text block below it -- that's what
         keeps the whole card at a true 1:1, not just the photo area. -->
    <div class="absolute inset-x-0 bottom-0 pt-8 pb-2.5 px-2.5 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
      <h4 class="text-sm font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">{{ business.name }}</h4>
      <div v-if="business.rating || business.priceTier" class="mt-0.5 flex items-center gap-1 text-xs text-white/90">
        <template v-if="business.rating">
          <UIcon name="lucide:star" class="w-3.5 h-3.5 text-amber-400" />
          <span class="font-medium">{{ business.rating }}</span>
          <span v-if="business.reviews">({{ business.reviews }})</span>
          <span v-if="business.priceTier" class="mx-0.5">·</span>
        </template>
        <span v-if="business.priceTier">{{ business.priceTier }}</span>
      </div>
      <div v-if="business.distance" class="mt-0.5 flex items-center gap-1 text-xs text-white/80">
        <UIcon name="lucide:map-pin" class="w-3 h-3" />
        <span>{{ business.distance }}</span>
      </div>
    </div>
  </NuxtLink>

  <div
    v-else
    class="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
    style="aspect-ratio: 1 / 1"
  >
    <div class="absolute inset-0 bg-gradient-to-br flex items-center justify-center" :class="business.gradient">
      <img
        v-if="business.logoUrl"
        :src="business.logoUrl"
        :alt="business.name"
        class="w-full h-full object-cover"
      >
      <UIcon v-else :name="business.icon" class="w-10 h-10" :class="business.iconColor" />
    </div>

    <span
      v-if="business.badge"
      class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-900/80 text-[11px] font-medium text-gray-700 dark:text-gray-200 shadow-sm"
    >
      {{ business.badge }}
    </span>
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

    <div class="absolute inset-x-0 bottom-0 pt-8 pb-2.5 px-2.5 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
      <h4 class="text-sm font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">{{ business.name }}</h4>
      <div v-if="business.rating || business.priceTier" class="mt-0.5 flex items-center gap-1 text-xs text-white/90">
        <template v-if="business.rating">
          <UIcon name="lucide:star" class="w-3.5 h-3.5 text-amber-400" />
          <span class="font-medium">{{ business.rating }}</span>
          <span v-if="business.reviews">({{ business.reviews }})</span>
          <span v-if="business.priceTier" class="mx-0.5">·</span>
        </template>
        <span v-if="business.priceTier">{{ business.priceTier }}</span>
      </div>
      <div v-if="business.distance" class="mt-0.5 flex items-center gap-1 text-xs text-white/80">
        <UIcon name="lucide:map-pin" class="w-3 h-3" />
        <span>{{ business.distance }}</span>
      </div>
    </div>
  </div>
</template>
