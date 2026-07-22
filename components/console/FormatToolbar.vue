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
      class="fixed z-40 bg-slate-950 rounded-xl shadow-2xl border border-slate-800 p-1 flex items-center gap-1"
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
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-sm font-medium"
        @click="emit('delete-blocks')"
      >
        <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
        Удалить {{ props.formatBar.blockCount }} {{ props.formatBar.blockCount === 1 ? 'блок' : 'блока' }}
      </button>

      <template v-else>
      <!-- Bold -->
      <ConsoleFormatButton
        icon="lucide:bold"
        :label="t('admin.editor.bold')"
        cmd="bold"
      />

      <!-- Italic -->
      <ConsoleFormatButton
        icon="lucide:italic"
        :label="t('admin.editor.italic')"
        cmd="italic"
      />

      <!-- Underline -->
      <ConsoleFormatButton
        icon="lucide:underline"
        :label="t('admin.editor.underline')"
        cmd="underline"
      />

      <!-- Strikethrough -->
      <ConsoleFormatButton
        icon="lucide:strikethrough"
        :label="t('admin.editor.strike')"
        cmd="strikethrough"
      />

      <div class="h-5 w-px bg-slate-700" />

      <!-- H2 -->
      <ConsoleFormatButton
        icon="lucide:heading-2"
        :label="t('admin.editor.heading2')"
        cmd="formatBlock"
        value="<h2>"
      />

      <!-- H3 -->
      <ConsoleFormatButton
        icon="lucide:heading-3"
        :label="t('admin.editor.heading3')"
        cmd="formatBlock"
        value="<h3>"
      />

      <!-- Link -->
      <button
        class="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        :title="t('admin.editor.insertLink')"
        @click="insertLink"
      >
        <Icon name="lucide:link" class="h-3.5 w-3.5" />
      </button>

      <div class="h-5 w-px bg-slate-700" />

      <!-- Clear formatting -->
      <ConsoleFormatButton
        icon="lucide:eraser"
        :label="t('admin.editor.clearFormatting')"
        cmd="removeFormat"
      />
      </template>
    </div>
  </Teleport>
</template>
