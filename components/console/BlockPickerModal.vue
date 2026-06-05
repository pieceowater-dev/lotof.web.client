<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

defineProps<{
  open: boolean
}>()

defineEmits<{
  'update:open': [boolean]
  'add': [string]
}>()

const { t } = useI18n()

function resolveBlockTypeLabel(label: string): string {
  const blockTypeKey = `admin.editor.blockTypes.${label}`
  const fromBlockTypes = t(blockTypeKey)
  if (String(fromBlockTypes || '').trim()) return fromBlockTypes

  const editorKey = `admin.editor.${label}`
  const fromEditor = t(editorKey)
  if (String(fromEditor || '').trim()) return fromEditor

  return label
}

const blockGroups = [
  {
    label: 'text',
    types: [
      { type: 'paragraph', label: 'paragraph', icon: 'lucide:pilcrow', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      { type: 'h2', label: 'heading2', icon: 'lucide:heading-2', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      { type: 'h3', label: 'heading3', icon: 'lucide:heading-3', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      { type: 'quote', label: 'quote', icon: 'lucide:quote', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' }
    ]
  },
  {
    label: 'lists',
    types: [
      { type: 'ul', label: 'unorderedList', icon: 'lucide:list', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
      { type: 'ol', label: 'orderedList', icon: 'lucide:list-ordered', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' }
    ]
  },
  {
    label: 'media',
    types: [
      { type: 'image', label: 'image', icon: 'lucide:image', iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600 dark:text-orange-400' }
    ]
  },
  {
    label: 'elements',
    types: [
      { type: 'callout', label: 'callout', icon: 'lucide:info', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
      { type: 'spoiler', label: 'spoiler', icon: 'lucide:eye-off', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-700 dark:text-slate-300' },
      { type: 'spoiler_open', label: 'spoilerOpen', icon: 'lucide:between-vertical-start', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-700 dark:text-slate-300' },
      { type: 'spoiler_close', label: 'spoilerClose', icon: 'lucide:between-vertical-end', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-700 dark:text-slate-300' },
      { type: 'divider', label: 'divider', icon: 'lucide:minus', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' },
      { type: 'html', label: 'html', icon: 'lucide:code-2', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' }
    ]
  }
]
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 dark:bg-black/50 backdrop-blur-md"
      @click.self="$emit('update:open', false)"
    >
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[520px] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 class="font-semibold text-slate-900 dark:text-white">{{ t('admin.editor.addBlock') }}</h3>
          <button
            @click="$emit('update:open', false)"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 grid gap-4">
          <div v-for="group in blockGroups" :key="group.label" class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 px-1">{{ t(`admin.editor.blockGroups.${group.label}`) }}</h4>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="item in group.types"
                :key="item.type"
                @click="$emit('add', item.type); $emit('update:open', false)"
                class="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all hover:shadow-sm"
              >
                <div :class="`h-10 w-10 rounded-lg flex items-center justify-center ${item.iconBg}`">
                  <Icon :name="item.icon" :class="`h-5 w-5 ${item.iconColor}`" />
                </div>
                <span class="text-xs text-center leading-tight font-medium text-slate-600 dark:text-slate-200">{{ resolveBlockTypeLabel(item.label) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
