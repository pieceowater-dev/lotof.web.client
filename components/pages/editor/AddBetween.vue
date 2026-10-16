<script setup lang="ts">
defineProps<{ index?: number }>()
defineEmits<{ open: [void] }>()
</script>

<template>
  <div class="group/add relative flex h-5 cursor-default items-center">
    <div class="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent opacity-0 transition-opacity duration-150 group-hover/add:opacity-100 group-hover/block-spacer:opacity-100" />
    <button
      type="button"
      class="pe-add relative z-10 mx-auto scale-90 opacity-0 transition-all duration-150 group-hover/add:scale-100 group-hover/add:opacity-100 group-hover/block-spacer:scale-100 group-hover/block-spacer:opacity-100 focus-visible:scale-100 focus-visible:opacity-100"
      title="Добавить блок"
      @click="$emit('open')"
    >
      <Icon name="lucide:plus" class="h-3 w-3" />
      Блок
    </button>
  </div>
</template>
