<template>
  <header class="flex-shrink-0 flex items-center justify-between gap-2 h-14 px-3 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30">
    <!-- Left: back button + title -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <NuxtLink
        to="/console/publications"
        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-blue-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-slate-800"
        :aria-label="t('app.back') || 'Back'"
      >
        <Icon name="lucide:arrow-left" class="h-6 w-6" />
      </NuxtLink>
      <span class="text-sm md:text-base font-semibold text-slate-900 dark:text-white truncate">
        {{ mode === 'edit' ? (t('admin.editPublication') || 'Редактирование публикации') : t('admin.newPublicationPageTitle') }}
      </span>
    </div>

    <!-- Right: status + actions -->
    <div class="flex items-center gap-1.5 md:gap-3 flex-shrink-0 ml-auto">
      <span
        class="text-xs px-2 py-1 md:px-2.5 md:py-1 rounded-full font-semibold border"
        :class="isScheduled
          ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800'
          : article.status === 'published'
          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'"
      >
        {{ isScheduled ? 'Запланировано' : article.status === 'published' ? t('admin.editor.statusPublished') : t('admin.editor.statusDraft') }}
      </span>
      <button
        v-if="canDelete"
        type="button"
        class="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
        @click="$emit('delete')"
      >
        <Icon name="lucide:trash-2" class="h-4 w-4" />
        <span class="hidden md:inline">Архивировать</span>
      </button>
      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <button
        :disabled="!isDirty"
        class="flex items-center gap-1 md:gap-1.5 px-2.5 sm:px-3 md:px-3 py-1.5 sm:py-1.5 md:py-1.5 text-xs sm:text-sm md:text-sm rounded-lg border border-slate-200 dark:border-slate-700 font-medium transition-colors"
        :class="isDirty
          ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
          : 'text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'"
        @click="$emit('save')"
      >
        <Icon name="lucide:save" :class="['h-4 w-4 sm:h-3.5 sm:w-3.5', isSaving && 'animate-pulse']" />
        <span class="hidden md:inline">{{ isDirty ? t('app.save') : 'Сохранено' }}</span>
      </button>
      <UButton
        :icon="willBeScheduled ? 'lucide:calendar-clock' : 'lucide:send'"
        color="primary"
        size="sm"
        @click="$emit('publish')"
      >
        <span class="hidden md:inline">{{ willBeScheduled ? 'Запланировать' : t('admin.editor.publish') }}</span>
      </UButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Props {
  article: any
  blocks: any[]
  isDirty: boolean
  isSaving: boolean
  mode?: 'create' | 'edit'
  canDelete?: boolean
}

const props = defineProps<Props>()
defineEmits<{
  save: []
  publish: []
  delete: []
  'toggle-sidebar': []
}>()

const { t } = useI18n()

function isFutureDate(value: string): boolean {
  if (!value) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()
}

// A "published" article whose publish date is still in the future stays
// hidden from the public route (backend gate), so it's effectively scheduled.
const isScheduled = computed(() => props.article.status === 'published' && isFutureDate(props.article.publishedAt))
const willBeScheduled = computed(() => isFutureDate(props.article.publishedAt))
</script>
