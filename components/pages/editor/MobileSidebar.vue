<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 bg-black/40 transition-opacity dark:bg-black/60" @click="$emit('close')" />
    <aside class="fixed bottom-0 right-0 top-0 z-50 flex w-72 flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        :aria-label="t('pages.editor.close')"
        @click="$emit('close')"
      >
        <Icon name="lucide:x" class="h-4 w-4" />
      </button>
      <PagesEditorSidebarPanel v-bind="($attrs as any)" />
    </aside>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

defineOptions({ inheritAttrs: false })
defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>
