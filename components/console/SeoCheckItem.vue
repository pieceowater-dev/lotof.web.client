<script setup lang="ts">
defineProps<{
  ok: boolean
  label: string
}>()
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <Icon
      :name="ok ? 'lucide:check-circle-2' : 'lucide:circle'"
      :class="ok
        ? 'h-4 w-4 text-green-500 flex-shrink-0'
        : 'h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0'"
    />
    <span :class="ok ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'">
      {{ label }}
    </span>
  </div>
</template>
