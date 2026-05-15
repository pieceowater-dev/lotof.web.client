<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
    @click.self="$emit('cancel')"
  >
    <div class="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
      <div class="p-5 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">{{ title }}</h3>
        <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{{ message }}</p>
      </div>

      <div class="p-4 flex items-center justify-end gap-2">
        <UButton
          color="gray"
          variant="ghost"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </UButton>
        <UButton
          :color="variant === 'danger' ? 'red' : 'primary'"
          @click="$emit('confirm')"
          @keydown.enter="$emit('confirm')"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant?: 'danger' | 'primary'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary'
})

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>
