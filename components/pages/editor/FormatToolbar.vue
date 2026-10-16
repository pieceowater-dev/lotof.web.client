<script setup lang="ts">
import { provide } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface FormatBar {
  visible: boolean
  x: number
  y: number
  mode?: 'format' | 'deleteBlocks'
  blockCount?: number
}

const props = defineProps<{
  formatBar: FormatBar
}>()

const emit = defineEmits<{
  'hide': [void]
  'apply-format': [string, string | undefined]
  'delete-blocks': [void]
}>()

const { t } = useI18n()

provide('applyFormat', (cmd: string, value?: string) => {
  emit('apply-format', cmd, value)
  emit('hide')
})

function insertLink() {
  const url = prompt(t('admin.editor.promptLinkUrl'))
  if (url) emit('apply-format', 'createLink', url)
  emit('hide')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.formatBar.visible"
      class="pe-format fixed z-40"
      :style="{
        left: props.formatBar.x + 'px',
        top: props.formatBar.y + 'px',
        transform: 'translate(-50%, -100%)',
      }"
      @mousedown.prevent
    >
      <!-- Multi-block selection: delete action instead of text formatting -->
      <button
        v-if="props.formatBar.mode === 'deleteBlocks'"
        class="pe-pill pe-pill--danger !text-red-600 dark:!text-red-300"
        @click="emit('delete-blocks')"
      >
        <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
        {{ t('pages.editor.ui.deleteBlocksN', { n: props.formatBar.blockCount ?? 0 }) }}
      </button>

      <template v-else>
      <!-- Bold -->
      <PagesEditorFormatButton
        icon="lucide:bold"
        :label="t('admin.editor.bold')"
        cmd="bold"
      />

      <!-- Italic -->
      <PagesEditorFormatButton
        icon="lucide:italic"
        :label="t('admin.editor.italic')"
        cmd="italic"
      />

      <!-- Underline -->
      <PagesEditorFormatButton
        icon="lucide:underline"
        :label="t('admin.editor.underline')"
        cmd="underline"
      />

      <!-- Strikethrough -->
      <PagesEditorFormatButton
        icon="lucide:strikethrough"
        :label="t('admin.editor.strike')"
        cmd="strikethrough"
      />

      <div class="mx-0.5 h-5 w-px bg-slate-900/10 dark:bg-white/15" />

      <!-- H2 -->
      <PagesEditorFormatButton
        icon="lucide:heading-2"
        :label="t('admin.editor.heading2')"
        cmd="formatBlock"
        value="<h2>"
      />

      <!-- H3 -->
      <PagesEditorFormatButton
        icon="lucide:heading-3"
        :label="t('admin.editor.heading3')"
        cmd="formatBlock"
        value="<h3>"
      />

      <!-- Link -->
      <button
        class="pe-tool"
        :title="t('admin.editor.insertLink')"
        @click="insertLink"
      >
        <Icon name="lucide:link" class="h-3.5 w-3.5" />
      </button>

      <div class="mx-0.5 h-5 w-px bg-slate-900/10 dark:bg-white/15" />

      <!-- Clear formatting -->
      <PagesEditorFormatButton
        icon="lucide:eraser"
        :label="t('admin.editor.clearFormatting')"
        cmd="removeFormat"
      />
      </template>
    </div>
  </Teleport>
</template>
