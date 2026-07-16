<script lang="ts" setup>
import { getContrastTextColor } from '@/utils/color';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuBadge } from '@/api/menu/badge/list';

const props = defineProps<{
  item: MenuItem;
  badges: MenuBadge[];
  currency?: string | null;
  primaryColor: string;
  secondaryColor: string;
  quantity: number;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'add'): void;
  (e: 'increment'): void;
  (e: 'decrement'): void;
}>();

const itemBadges = computed(() => props.item.badgeIds
  .map((id) => props.badges.find((b) => b.id === id))
  .filter((b): b is MenuBadge => !!b));

const onPrimaryText = computed(() => getContrastTextColor(props.primaryColor));
</script>

<template>
  <div class="w-full">
    <button
      type="button"
      class="w-full text-left block group"
      @click="emit('open')"
    >
      <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          v-if="item.imageUrl"
          :src="item.imageUrl"
          :alt="item.imageAlt || item.name"
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        >
        <div v-else class="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
          <Icon name="lucide:utensils" class="w-7 h-7" />
        </div>
        <div v-if="itemBadges.length" class="absolute top-1.5 left-1.5 flex flex-wrap gap-1 max-w-[calc(100%-12px)]">
          <span
            v-for="b in itemBadges"
            :key="b.id"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm"
            :style="{ backgroundColor: b.bgColor, color: b.textColor }"
          >
            <span v-if="b.icon">{{ b.icon }}</span>{{ b.text }}
          </span>
        </div>
      </div>
    </button>

    <!-- Zero-height anchor at the image's bottom edge so the add/stepper
         button can float half-over the photo regardless of its rendered
         height (aspect-square scales with column width). -->
    <div class="relative h-0">
      <div class="absolute -top-4 right-2 z-10">
        <button
          v-if="!quantity"
          type="button"
          class="w-9 h-9 rounded-full shadow-md flex items-center justify-center text-white active:scale-90 transition-transform"
          :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
          @click="emit('add')"
        >
          <Icon name="lucide:plus" class="w-4 h-4" />
        </button>
        <div
          v-else
          class="flex items-center gap-0.5 bg-white dark:bg-gray-900 rounded-full shadow-md ring-1 ring-black/5 dark:ring-white/10 p-1"
        >
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
            @click="emit('decrement')"
          >
            <Icon name="lucide:minus" class="w-3.5 h-3.5" />
          </button>
          <span class="w-5 text-center text-xs font-bold tabular-nums text-gray-900 dark:text-white">{{ quantity }}</span>
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
            @click="emit('increment')"
          >
            <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="w-full text-left block mt-3 pr-1"
      @click="emit('open')"
    >
      <div class="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">{{ item.name }}</div>
      <div class="text-sm font-semibold mt-1" :style="{ color: secondaryColor }">{{ item.price }} {{ currency }}</div>
    </button>
  </div>
</template>
