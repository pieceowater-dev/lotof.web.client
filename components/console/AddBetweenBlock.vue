<script setup lang="ts">
defineProps<{ index?: number }>()
defineEmits<{ open: [void] }>()
</script>

<template>
  <div class="relative h-4 flex items-center group/add cursor-default">
    <!-- Dashed line -->
    <div class="absolute inset-0 flex items-center pointer-events-none">
      <div class="w-full h-px bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent opacity-0 group-hover/block-spacer:opacity-100 group-hover/add:opacity-100 transition-opacity duration-150" />
    </div>

    <!-- Plus button -->
    <button
      class="relative mx-auto z-10 flex items-center justify-center h-5 w-5 rounded-full transition-all duration-150 opacity-0 group-hover/block-spacer:opacity-100 group-hover/add:opacity-100 scale-75 group-hover/block-spacer:scale-100 group-hover/add:scale-100 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-500 dark:text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm shadow-blue-200/50 dark:shadow-blue-900/50"
      @click="$emit('open')"
      title="Добавить блок"
    >
      <Icon name="lucide:plus" class="h-3 w-3" />
    </button>
  </div>
</template>
