<script lang="ts" setup>
// Searchable, infinitely scrolling page chooser (WordPress "Parent page"). The list is fetched from the server a
// page at a time, so it stays fast with hundreds of pages. Opens inline, so it never overflows a modal.
import { pagesApi, type SitePage } from '@/api/pages/ops';
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  modelValue: string;
  nsSlug: string;
  siteId: string;
  /** Page ids that can't be chosen (the page itself and everything below it). */
  exclude?: Set<string>;
  topLabel?: string;
  /** Hide the "top level" row (used when the picker only chooses a page). */
  hideTop?: boolean;
  placeholder?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [id: string]; pick: [page: SitePage | null] }>();
const { t } = useI18n();

const open = ref(false);
const query = ref('');
const rows = ref<SitePage[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(false);
const known = reactive<Record<string, SitePage>>({});
const listEl = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

const visible = computed(() => rows.value.filter(p => p.path !== '/' && !props.exclude?.has(p.id)));
const hasMore = computed(() => rows.value.length < total.value);
const depth = (p: SitePage) => Math.max(0, p.path.split('/').length - 2);

async function load(reset: boolean) {
  if (loading.value || (!reset && !hasMore.value)) return;
  const mine = ++seq;
  loading.value = true;
  try {
    const next = reset ? 1 : page.value + 1;
    const r = await pagesApi.pagesPage(props.nsSlug, props.siteId, { search: query.value.trim(), page: next });
    if (mine !== seq) return;
    page.value = next;
    total.value = r.info.count;
    rows.value = reset ? r.rows : [...rows.value, ...r.rows];
    for (const p of r.rows) known[p.id] = p;
  } catch { /* the caller's own error handling covers connectivity; an empty list is fine here */ } finally {
    if (mine === seq) loading.value = false;
  }
}

function toggle() {
  open.value = !open.value;
  if (open.value && !rows.value.length) load(true);
}
watch(query, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 0; load(true); }, 250); });
function onScroll() {
  const el = listEl.value;
  if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) load(false);
}
function choose(id: string) {
  emit('update:modelValue', id);
  emit('pick', id ? known[id] || null : null);
  open.value = false;
}

// Label of the current value, fetched when it isn't in the loaded rows.
watch(() => props.modelValue, async (id) => {
  if (id && !known[id]) {
    try { const p = await pagesApi.page(props.nsSlug, id); if (p) known[id] = p; } catch { /* label falls back to the path-less title */ }
  }
}, { immediate: true });
const current = computed(() => (props.modelValue ? known[props.modelValue] : undefined));
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="flex flex-col gap-2">
    <button
      type="button" class="pe-field !flex items-center justify-between gap-2 text-left" :aria-expanded="open" @click="toggle"
    >
      <span class="min-w-0 truncate">
        <template v-if="current">{{ current.title }} <span class="text-xs text-gray-400">{{ current.path }}</span></template>
        <template v-else>{{ placeholder || topLabel || t('pages.pages.topLevel') }}</template>
      </span>
      <Icon name="lucide:chevron-down" class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform" :class="open && 'rotate-180'" />
    </button>

    <div v-if="open" class="overflow-hidden rounded-3xl bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
      <div class="p-2">
        <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('pages.pages.search')" autofocus />
      </div>
      <div ref="listEl" class="max-h-56 overflow-y-auto overscroll-contain px-1 pb-2" @scroll.passive="onScroll">
        <button
          v-if="!hideTop" type="button" class="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
          :class="!modelValue && 'font-semibold text-primary-600 dark:text-primary-400'" @click="choose('')"
        >
          <Icon name="lucide:corner-left-up" class="h-4 w-4 flex-shrink-0" />{{ topLabel || t('pages.pages.topLevel') }}
          <Icon v-if="!modelValue" name="lucide:check" class="ml-auto h-4 w-4" />
        </button>
        <button
          v-for="p in visible" :key="p.id" type="button"
          class="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
          :class="modelValue === p.id && 'font-semibold text-primary-600 dark:text-primary-400'"
          :style="{ paddingLeft: `${0.75 + (query ? 0 : depth(p)) * 0.9}rem` }" @click="choose(p.id)"
        >
          <Icon name="lucide:file-text" class="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
          <span class="hidden flex-shrink-0 truncate text-xs text-gray-400 sm:inline sm:max-w-[40%]">{{ p.path }}</span>
          <Icon v-if="modelValue === p.id" name="lucide:check" class="h-4 w-4 flex-shrink-0" />
        </button>
        <div v-if="loading" class="flex justify-center py-2"><Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-gray-400" /></div>
        <p v-else-if="!visible.length" class="px-3 py-3 text-center text-xs text-gray-400">{{ t('pages.pages.noMatches') }}</p>
      </div>
    </div>
  </div>
</template>
