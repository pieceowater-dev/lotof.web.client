<script lang="ts" setup>
// Calm empty state for A-Trace settings sections: soft tray, muted icon tile, one line, optional action (slot).
defineProps<{ text: string; icon?: string }>();
</script>

<template>
  <div class="at-empty-box">
    <span class="at-empty-ico"><UIcon
      :name="icon || 'lucide:inbox'"
      class="h-5 w-5"
    /></span>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ text }}
    </p>
    <slot />
  </div>
</template>
