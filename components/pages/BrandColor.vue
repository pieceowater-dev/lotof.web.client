<script setup lang="ts">
// Brand colour by HEX: typed value, live contrast checks (button text, links on the page background) and a one-click
// readable shade. No native colour picker on purpose; the swatches above stay the quick way.
import { useI18n } from '@/composables/useI18n'
import { contrast, normalizeHex, onAccent, readableShade } from '@/utils/pagesThemes'

const props = defineProps<{ modelValue: string; bg: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
const { t } = useI18n()

const draft = ref(props.modelValue)
watch(() => props.modelValue, v => { if (normalizeHex(draft.value) !== v) draft.value = v })

const parsed = computed(() => normalizeHex(draft.value))
const onBtn = computed(() => (parsed.value ? contrast(parsed.value, onAccent(parsed.value)) : 0))
const onPage = computed(() => (parsed.value ? contrast(parsed.value, props.bg) : 0))
const shade = computed(() => (parsed.value ? readableShade(parsed.value, props.bg) : ''))
const ok = (r: number) => r >= 4.5

function commit() {
  if (parsed.value) { emit('update:modelValue', parsed.value); draft.value = parsed.value }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/10 dark:ring-white/15" :style="{ background: parsed || 'transparent' }" />
      <input
        v-model="draft" maxlength="7" spellcheck="false" placeholder="#2563eb"
        class="w-32 rounded-xl bg-white px-3 py-1.5 font-mono text-sm text-gray-900 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#161616] dark:text-white dark:ring-white/15"
        :class="draft && !parsed && 'ring-red-400'"
        :aria-label="t('pages.design.hexLabel')"
        @change="commit" @keydown.enter.prevent="commit"
      >
    </div>
    <div v-if="parsed" class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="rounded-full px-2 py-0.5 ring-1" :class="ok(onBtn) ? 'text-emerald-700 ring-emerald-500/30 dark:text-emerald-300' : 'text-amber-700 ring-amber-500/40 dark:text-amber-300'">
        {{ t('pages.design.contrastButton', { n: onBtn.toFixed(1) }) }}
      </span>
      <span class="rounded-full px-2 py-0.5 ring-1" :class="ok(onPage) ? 'text-emerald-700 ring-emerald-500/30 dark:text-emerald-300' : 'text-amber-700 ring-amber-500/40 dark:text-amber-300'">
        {{ t('pages.design.contrastLinks', { n: onPage.toFixed(1) }) }}
      </span>
      <button v-if="!ok(onPage) && shade !== parsed" type="button" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-blue-700 ring-1 ring-blue-500/30 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10" @click="draft = shade; commit()">
        <span class="h-3 w-3 rounded-full ring-1 ring-black/10" :style="{ background: shade }" />{{ t('pages.design.useReadable', { hex: shade }) }}
      </button>
    </div>
    <p v-else-if="draft" class="text-xs text-red-500">{{ t('pages.design.hexInvalid') }}</p>
  </div>
</template>
