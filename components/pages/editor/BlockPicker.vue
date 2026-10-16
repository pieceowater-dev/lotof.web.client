<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { atModalUi, atCardUi } from '@/utils/atraceUi'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'add': [string]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

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
      { type: 'button', label: 'button', icon: 'lucide:rectangle-ellipsis', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
      { type: 'faq', label: 'faq', icon: 'lucide:messages-square', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconColor: 'text-cyan-600 dark:text-cyan-400' },
      { type: 'callout', label: 'callout', icon: 'lucide:info', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
      { type: 'divider', label: 'divider', icon: 'lucide:minus', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' },
      { type: 'html', label: 'html', icon: 'lucide:code-2', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' }
    ]
  }
]
</script>

<template>
  <UModal v-model="isOpen" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
    <UCard :ui="{ ...atCardUi, body: { padding: 'px-5 py-4 sm:px-7 sm:py-5', base: 'max-h-[calc(100dvh-10rem)] overflow-y-auto' }, header: { padding: 'px-5 pt-5 pb-3 sm:px-7' } }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{{ t('admin.editor.addBlock') }}</h3>
          <button type="button" class="pe-round" aria-label="Close" @click="isOpen = false">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>
      </template>

      <div class="grid gap-5">
        <div v-for="group in blockGroups" :key="group.label" class="space-y-2">
          <h4 class="pe-label">{{ t(`admin.editor.blockGroups.${group.label}`) }}</h4>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="item in group.types"
              :key="item.type"
              type="button"
              class="pe-tile"
              @click="$emit('add', item.type); isOpen = false"
            >
              <span :class="`flex h-10 w-10 items-center justify-center rounded-2xl ${item.iconBg}`">
                <Icon :name="item.icon" :class="`h-5 w-5 ${item.iconColor}`" />
              </span>
              <span class="text-center text-xs font-semibold leading-tight text-slate-600 dark:text-neutral-200">{{ resolveBlockTypeLabel(item.label) }}</span>
            </button>
          </div>
        </div>
      </div>
    </UCard>
  </UModal>
</template>
