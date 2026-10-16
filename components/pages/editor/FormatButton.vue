<script setup lang="ts">
import { inject } from 'vue'

defineProps<{
  icon: string
  label: string
  cmd: string
  value?: string
}>()

const applyFormat = inject<(cmd: string, val?: string) => void>('applyFormat')
</script>

<template>
  <button
    class="pe-tool"
    :title="label"
    @click="applyFormat?.(cmd, value)"
  >
    <Icon :name="icon" class="h-3.5 w-3.5" />
  </button>
</template>
