<template>
  <header class="pe-bar">
    <div class="flex min-w-0 flex-1 items-center gap-2.5">
      <NuxtLink :to="backTo" class="pe-round" :aria-label="t('pages.editor.back')">
        <Icon name="lucide:arrow-left" class="h-[18px] w-[18px]" />
      </NuxtLink>
      <div class="min-w-0">
        <div class="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">{{ page.title || t('pages.editor.untitled') }}</div>
        <div class="hidden truncate text-xs text-slate-400 sm:block dark:text-neutral-500">{{ subtitle }}</div>
      </div>
    </div>

    <div class="ml-auto flex flex-shrink-0 items-center gap-1.5">
      <span class="pe-chip" :class="page.status === 'ready' ? 'pe-chip--ready' : 'pe-chip--draft'">
        {{ page.status === 'ready' ? t('pages.status.ready') : t('pages.status.draft') }}
      </span>
      <a v-if="liveUrl" :href="liveUrl" target="_blank" rel="noopener noreferrer" class="at-btn hidden no-underline sm:inline-flex">
        <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
        <span class="hidden md:inline">{{ t('pages.editor.openLive') }}</span>
      </a>
      <button v-if="canDelete" type="button" class="pe-round pe-round--danger" :aria-label="t('pages.editor.delete')" :title="t('pages.editor.delete')" @click="$emit('delete')">
        <Icon name="lucide:trash-2" class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="at-btn at-btn--primary"
        :disabled="(!isDirty && !isSaving)"
        :class="(!isDirty && !isSaving) ? 'opacity-60 !shadow-none' : ''"
        @click="$emit('save')"
      >
        <Icon :name="isSaving ? 'lucide:loader-2' : isDirty ? 'lucide:save' : 'lucide:check'" class="h-4 w-4" :class="isSaving ? 'animate-spin' : ''" />
        <span class="hidden md:inline">{{ isDirty ? t('pages.editor.save') : t('pages.editor.saved') }}</span>
      </button>
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
