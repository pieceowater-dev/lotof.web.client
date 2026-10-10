<script setup lang="ts">
import type { MockBusiness } from '@/utils/mockCatalog';

defineProps<{
  business: MockBusiness;
  isFavorite: boolean;
}>();

defineEmits<{ (e: 'toggle-favorite', key: string): void }>();
</script>

<template>
  <div class="bc-shell group">
  <!-- Two branches instead of a dynamic <component :is>: a runtime string
       -is didn't reliably resolve to the real NuxtLink component and
       silently produced a dead div instead (found live -- clicking cards
       did nothing). Verbose, but guaranteed to actually navigate. -->
  <NuxtLink
    v-if="business.to"
    :to="business.to"
    class="relative block rounded-[1.4rem] overflow-hidden bg-gray-100 dark:bg-[#262626]"
    style="aspect-ratio: 1 / 1"
  >
    <div class="absolute inset-0 bg-gradient-to-br flex items-center justify-center" :class="business.gradient">
      <img
        v-if="business.logoUrl"
        :src="business.logoUrl"
        :alt="business.name"
        class="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
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
      class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 dark:bg-black/50 flex items-center justify-center shadow-sm"
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
    class="relative rounded-[1.4rem] overflow-hidden bg-gray-100 dark:bg-[#262626]"
    style="aspect-ratio: 1 / 1"
  >
    <div class="absolute inset-0 bg-gradient-to-br flex items-center justify-center" :class="business.gradient">
      <img
        v-if="business.logoUrl"
        :src="business.logoUrl"
        :alt="business.name"
        class="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
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
      class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 dark:bg-black/50 flex items-center justify-center shadow-sm"
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
  </div>
</template>

<style scoped>
.bc-shell {
  border-radius: 1.75rem;
  padding: 0.3rem;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.bc-shell:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08), 0 18px 32px -18px rgba(15, 23, 42, 0.3); }
.dark .bc-shell { background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
.dark .bc-shell:hover { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); }
</style>
