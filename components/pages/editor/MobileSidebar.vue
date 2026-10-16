<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm dark:bg-gray-950/60" @click="$emit('close')" />
    <aside class="at-scope ct-scope fixed bottom-2 right-2 top-2 z-50 flex w-[19rem] max-w-[calc(100vw-1rem)] flex-col">
      <div class="pe-side relative shadow-2xl">
        <button type="button" class="pe-round absolute right-3 top-3 z-10 !h-8 !w-8" :aria-label="t('pages.editor.close')" @click="$emit('close')">
          <Icon name="lucide:x" class="h-4 w-4" />
        </button>
        <div class="min-h-0 flex-1 pt-11">
          <PagesEditorSidebarPanel v-bind="($attrs as any)" />
        </div>
      </div>
    </aside>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

defineOptions({ inheritAttrs: false })
defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>
