<template>
  <div class="md:hidden fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
    <!-- Add block button -->
    <button
      class="flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-[#262626] text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-blue-50 dark:hover:bg-[#303030]"
      @click="$emit('add-block')"
      title="Add block"
    >
      <Icon name="lucide:plus" class="h-7 w-7" />
    </button>

    <!-- Sidebar settings button -->
    <button
      class="flex items-center justify-center w-14 h-14 rounded-full bg-slate-200 dark:bg-[#303030] text-slate-700 dark:text-neutral-200 shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-slate-300 dark:hover:bg-[#3a3a3a]"
      @click="$emit('toggle-sidebar')"
      title="Settings"
    >
      <Icon name="lucide:panel-right" class="h-6 w-6" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  'add-block': []
  'toggle-sidebar': []
}>()
</script>
