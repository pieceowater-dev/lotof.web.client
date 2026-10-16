<script setup lang="ts">
// Look of one block, picked from a fixed palette: background tone, vertical padding, alignment, width.
import { useI18n } from '@/composables/useI18n'

const props = defineProps<{ attrs: Record<string, any> }>()
const emit = defineEmits<{ change: [style: Record<string, string> | null] }>()
const { t } = useI18n()

const GROUPS: { key: string; values: string[] }[] = [
  { key: 'bg', values: ['', 'soft', 'muted', 'accent', 'dark'] },
  { key: 'pad', values: ['', 'sm', 'lg', 'xl'] },
  { key: 'align', values: ['', 'center', 'right'] },
  { key: 'width', values: ['', 'narrow', 'wide'] },
]
const DOT: Record<string, string> = { soft: '#dbeafe', muted: '#e5e7eb', accent: '#2563eb', dark: '#111827' }

const open = ref(false)
const current = (k: string) => String(props.attrs.style?.[k] || '')
const active = computed(() => GROUPS.some(g => current(g.key)))

function set(k: string, v: string) {
  const st: Record<string, string> = { ...(props.attrs.style || {}) }
  if (v) st[k] = v; else delete st[k]
  emit('change', Object.keys(st).length ? st : null)
}
</script>

<template>
  <div class="mt-1 flex flex-col gap-2">
    <button type="button" class="pe-pill self-start" :class="active && 'pe-pill--on'" @click="open = !open">
      <Icon name="lucide:palette" class="h-3.5 w-3.5" />{{ t('pages.editor.sec.style') }}
    </button>
    <div v-if="open" class="pe-tray !py-3">
      <div v-for="g in GROUPS" :key="g.key" class="mb-2 flex flex-wrap items-center gap-1.5 last:mb-0">
        <span class="w-24 text-xs text-slate-500 dark:text-neutral-400">{{ t(`pages.editor.sec.st_${g.key}`) }}</span>
        <button v-for="v in g.values" :key="v" type="button" class="pe-pill" :class="current(g.key) === v && 'pe-pill--on'" @click="set(g.key, v)">
          <i v-if="g.key === 'bg' && v" class="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10" :style="{ background: DOT[v] }" />
          {{ v ? t(`pages.editor.sec.v_${v}`) : t('pages.editor.sec.v_none') }}
        </button>
      </div>
    </div>
  </div>
</template>
