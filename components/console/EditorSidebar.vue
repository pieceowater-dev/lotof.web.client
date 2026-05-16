<template>
  <!-- Desktop: always visible on right -->
  <aside class="hidden md:flex flex-shrink-0 w-72 xl:w-[300px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col overflow-hidden">
    <div class="flex gap-1 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      <button
        class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200"
        :class="sidebarTab === 'settings'
          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        @click="sidebarTab = 'settings'"
      >{{ t('admin.editor.settings') }}</button>
      <button
        class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 relative overflow-hidden"
        :class="sidebarTab === 'seo'
          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        @click="sidebarTab = 'seo'"
      >
        <!-- Progress bar background fill -->
        <div
          class="absolute inset-0 rounded-lg transition-all duration-300 opacity-20 dark:opacity-30"
          :class="seoScore >= 70 ? 'bg-green-500' : seoScore >= 40 ? 'bg-amber-400' : 'bg-red-500'"
          :style="{ width: seoScore + '%' }"
        />
        <!-- Text label (on top) -->
        <span class="relative z-10">{{ t('admin.editor.seoTab') }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <ConsoleSettingsSidebar
        v-if="sidebarTab === 'settings'"
        :article="article"
        @update:article="$emit('update:article', $event)"
        @clear="$emit('clear')"
        @add-block="$emit('add-block')"
      />
      <ConsoleSeoSidebar
        v-else
        :article="article"
        :blocks="blocks"
        @update:article="$emit('update:article', $event)"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Block {
  type: string
  attrs: Record<string, any>
}

interface Props {
  article: any
  blocks: Block[]
}

const props = defineProps<Props>()
defineEmits<{
  'update:article': [Partial<any>]
  'clear': []
  'add-block': []
}>()

const { t } = useI18n()
const sidebarTab = ref<'settings' | 'seo'>('settings')

const seoScore = computed(() => {
  let score = 0
  if (props.article.metaTitle) score += 15
  if (props.article.metaTitle?.length >= 30 && props.article.metaTitle?.length <= 60) score += 15
  if (props.article.metaDescription) score += 15
  if (props.article.metaDescription?.length >= 120 && props.article.metaDescription?.length <= 160) score += 15
  if (props.article.slug) score += 10
  if (props.blocks.some(b => b.type === 'image' && b.attrs.alt)) score += 10
  return score
})

</script>
