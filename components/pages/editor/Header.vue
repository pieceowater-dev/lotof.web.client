<template>
  <header class="flex-shrink-0 flex items-center justify-between gap-2 h-14 px-3 md:px-6 bg-white dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-white/10 z-30">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <NuxtLink
        :to="backTo"
        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-blue-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-[#262626]"
        :aria-label="t('pages.editor.back')"
      >
        <Icon name="lucide:arrow-left" class="h-6 w-6" />
      </NuxtLink>
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold text-slate-900 md:text-base dark:text-white">{{ page.title || t('pages.editor.untitled') }}</div>
        <div class="hidden truncate text-xs text-slate-400 sm:block dark:text-neutral-500">{{ subtitle }}</div>
      </div>
    </div>

    <div class="ml-auto flex flex-shrink-0 items-center gap-1.5 md:gap-3">
      <span
        class="rounded-full border px-2 py-1 text-xs font-semibold md:px-2.5"
        :class="page.status === 'ready'
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400'"
      >
        {{ page.status === 'ready' ? t('pages.status.ready') : t('pages.status.draft') }}
      </span>
      <a
        v-if="liveUrl"
        :href="liveUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:flex dark:border-white/15 dark:text-neutral-300 dark:hover:bg-[#262626]"
      >
        <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
        <span class="hidden md:inline">{{ t('pages.editor.openLive') }}</span>
      </a>
      <button
        v-if="canDelete"
        type="button"
        class="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:text-sm dark:border-white/15 dark:text-neutral-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300"
        @click="$emit('delete')"
      >
        <Icon name="lucide:trash-2" class="h-4 w-4" />
        <span class="hidden md:inline">{{ t('pages.editor.delete') }}</span>
      </button>
      <div class="hidden h-5 w-px bg-slate-200 sm:block dark:bg-[#303030]" />
      <UButton
        icon="lucide:save"
        color="primary"
        size="sm"
        :loading="isSaving"
        :disabled="!isDirty && !isSaving"
        @click="$emit('save')"
      >
        <span class="hidden md:inline">{{ isDirty ? t('pages.editor.save') : t('pages.editor.saved') }}</span>
      </UButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

const props = defineProps<{
  page: { title: string; status: string }
  isDirty: boolean
  isSaving: boolean
  canDelete?: boolean
  backTo: string
  liveUrl?: string
  path: string
}>()

defineEmits<{ save: []; delete: []; 'toggle-sidebar': [] }>()

const { t } = useI18n()
const subtitle = computed(() => props.path)
</script>
