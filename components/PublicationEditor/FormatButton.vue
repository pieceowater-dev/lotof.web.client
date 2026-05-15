<script setup lang="ts">
import { inject } from 'vue'
import { Icon } from '#components'

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
    class="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
    :title="label"
    @click="applyFormat?.(cmd, value)"
  >
    <Icon :name="icon" class="h-3.5 w-3.5" />
  </button>
</template>
