<template>
  <div class="flex flex-col items-center justify-center gap-2 py-10 text-center" :class="size === 'lg' && 'gap-3 py-16'">
    <span
      class="flex flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
      :class="size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'"
    >
      <UIcon :name="icon" class="text-gray-400" :class="size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'" />
    </span>
    <p
      class="font-medium text-gray-700 dark:text-gray-200"
      :class="size === 'lg' ? 'text-lg font-semibold text-gray-900 dark:text-white' : 'text-sm'"
    >
      {{ title }}
    </p>
    <p v-if="description" class="text-gray-500 dark:text-gray-400" :class="size === 'lg' ? 'max-w-xs text-sm' : 'max-w-[220px] text-xs'">
      {{ description }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
// Shared "nothing here yet" / "not found" placeholder -- consolidates what
// used to be several near-identical copies of icon-circle + title +
// description across pages/people.vue and public tracking pages.
withDefaults(defineProps<{
  icon: string;
  title: string;
  description?: string;
  size?: 'sm' | 'lg';
}>(), { size: 'sm' });
</script>
