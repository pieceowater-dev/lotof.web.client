<template>
  <section class="at-panel !p-0 overflow-hidden">
    <header class="flex flex-wrap items-start gap-x-3 gap-y-3 px-5 pt-5">
      <span class="icon-tile !h-9 !w-9 !rounded-xl flex-shrink-0">
        <UIcon :name="icon" class="h-[18px] w-[18px]" />
      </span>
      <div class="min-w-[9rem] flex-1">
        <h2 class="text-base font-bold leading-6 tracking-tight text-gray-900 dark:text-white">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ml-auto flex-shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <div class="px-5 pb-5 pt-4">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
// One settings block: gradient icon tile + title (+ optional one-line description and right-hand
// action) on top of a rounded tray, content below. Every settings screen uses this instead of
// hand-made card + micro-caps heading combinations (DESIGN.md §5 "Section headers").
defineProps<{
  icon: string;
  title: string;
  description?: string;
}>();
</script>
