<template>
  <div class="fixed bottom-6 right-5 z-40 flex flex-col items-center gap-3 md:hidden">
    <button class="pe-fab pe-fab--soft !h-12 !w-12" title="Settings" @click="$emit('toggle-sidebar')">
      <Icon name="lucide:panel-right" class="h-5 w-5" />
    </button>
    <button class="pe-fab" title="Add block" @click="$emit('add-block')">
      <Icon name="lucide:plus" class="h-7 w-7" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  'add-block': []
  'toggle-sidebar': []
}>()
</script>
