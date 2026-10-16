<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { pagesApi, type SitePage, type SiteCategory } from '@/api/pages/ops';
import { categoryTree } from '@/utils/pagesCategories';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';

// The site menu: automatic, or a tree built by ticking pages and categories (plus links and headings).
// Stored as Settings.navJson; the renderer resolves page/category references at publish time.
interface MenuNode { kind: 'page' | 'category' | 'home' | 'link' | 'group'; ref?: string; href?: string; label: string; mega?: boolean; children: MenuNode[] }

const props = defineProps<{ modelValue: string; siteId: string; nsSlug: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const { t } = useI18n();

const MAX_DEPTH = 3;
const MAX_ITEMS = 200;

const custom = ref(false);
const items = ref<MenuNode[]>([]);
const pages = ref<SitePage[]>([]);
const categories = ref<SiteCategory[]>([]);

function norm(raw: any, depth: number): MenuNode | null {
  if (!raw || typeof raw !== 'object' || depth > MAX_DEPTH) return null;
  const kind = ['page', 'category', 'home', 'link', 'group'].includes(raw.kind) ? raw.kind : 'link';
  const node: MenuNode = { kind, label: String(raw.label || ''), children: [] };
  if (raw.ref) node.ref = String(raw.ref);
  if (raw.href) node.href = String(raw.href);
  if (raw.mega) node.mega = true;
  if (Array.isArray(raw.children)) node.children = raw.children.map((c: any) => norm(c, depth + 1)).filter(Boolean) as MenuNode[];
  return node;
}
function parse(raw: string) {
  let o: any = [];
  try { o = JSON.parse(raw || '[]'); } catch { o = []; }
  items.value = Array.isArray(o) ? (o.map((n: any) => norm(n, 1)).filter(Boolean) as MenuNode[]) : [];
  custom.value = items.value.length > 0;
}
function clean(nodes: MenuNode[]): any[] {
  return nodes.map((n) => {
    const o: any = { kind: n.kind };
    if (n.ref) o.ref = n.ref;
    if (n.kind === 'link') o.href = (n.href || '').trim();
    if (n.label.trim()) o.label = n.label.trim();
    if (n.mega) o.mega = true;
    const kids = clean(n.children);
    if (kids.length) o.children = kids;
    return o;
  }).filter(o => o.kind !== 'link' || (o.href && o.label));
}
const serialized = computed(() => (custom.value && items.value.length ? JSON.stringify(clean(items.value)) : ''));
let last = '';
watch(() => props.modelValue, (v) => { if (v !== last) { parse(v); last = v || ''; } }, { immediate: true });
watch(serialized, (v) => { last = v; emit('update:modelValue', v); }, { flush: 'post' });

async function loadRefs() {
  try {
    [pages.value, categories.value] = await Promise.all([pagesApi.pages(props.nsSlug, props.siteId), pagesApi.categories(props.nsSlug, props.siteId)]);
  } catch { /* the pickers just stay empty */ }
}
onMounted(loadRefs);

const pageById = computed(() => new Map(pages.value.map(p => [p.id, p])));
const catById = computed(() => new Map(categories.value.map(c => [c.id, c])));

// ── flat view of the tree ──
interface Row { node: MenuNode; list: MenuNode[]; idx: number; depth: number }
const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  const walk = (list: MenuNode[], depth: number) => list.forEach((node, idx) => { out.push({ node, list, idx, depth }); walk(node.children, depth + 1); });
  walk(items.value, 0);
  return out;
});
const count = computed(() => rows.value.length);
// A big menu is a long list: fold it away. Starts folded when the menu is already large.
const collapsed = ref(false);
const foldDecided = ref(false);
watch(count, (n) => { if (!foldDecided.value && n > 0) { collapsed.value = n > 8; foldDecided.value = true; } }, { immediate: true });
const subtreeDepth = (n: MenuNode): number => 1 + Math.max(0, ...n.children.map(subtreeDepth));

function defaultLabel(n: MenuNode): string {
  if (n.kind === 'page') return pageById.value.get(n.ref || '')?.title || '';
  if (n.kind === 'category') return catById.value.get(n.ref || '')?.title || '';
  if (n.kind === 'home') return t('pages.design.menu.home');
  return '';
}
const missing = (n: MenuNode) => (n.kind === 'page' && !!pages.value.length && !pageById.value.has(n.ref || '')) || (n.kind === 'category' && !!categories.value.length && !catById.value.has(n.ref || ''));
const unpublished = (n: MenuNode) => n.kind === 'page' && pageById.value.get(n.ref || '')?.status !== 'PAGE_READY' && pageById.value.has(n.ref || '');
const KIND_ICON: Record<string, string> = { page: 'lucide:file-text', category: 'lucide:folder', home: 'lucide:house', link: 'lucide:link-2', group: 'lucide:layout-list' };

function move(r: Row, d: number) {
  const j = r.idx + d;
  if (j < 0 || j >= r.list.length) return;
  [r.list[r.idx], r.list[j]] = [r.list[j], r.list[r.idx]];
}
function indent(r: Row) {
  const prev = r.list[r.idx - 1];
  if (!prev || r.depth + subtreeDepth(r.node) >= MAX_DEPTH) return;
  r.list.splice(r.idx, 1);
  prev.children.push(r.node);
  if (r.depth === 0) r.node.mega = false;
}
function outdent(r: Row) {
  if (r.depth === 0) return;
  const parentRow = rows.value.find(x => x.node.children === r.list || x.node.children.includes(r.node));
  if (!parentRow) return;
  r.list.splice(r.idx, 1);
  parentRow.list.splice(parentRow.idx + 1, 0, r.node);
}
function remove(r: Row) { r.list.splice(r.idx, 1); }
const canIndent = (r: Row) => r.idx > 0 && r.depth + subtreeDepth(r.node) < MAX_DEPTH;
const canMega = (r: Row) => r.depth === 0 && r.node.children.length > 0;

// ── add modal ──
const open = ref(false);
const tab = ref<'pages' | 'categories' | 'link' | 'group'>('pages');
const q = ref('');
const pickPages = ref<string[]>([]);
const pickCats = ref<string[]>([]);
const pickHome = ref(false);
const target = ref('');
const linkForm = reactive({ label: '', href: 'https://' });
const groupLabel = ref('');
const catRows = computed(() => categoryTree(categories.value));
const pageRows = computed(() => {
  const s = q.value.trim().toLowerCase();
  return pages.value.filter(p => p.path !== '/' && (!s || p.title.toLowerCase().includes(s) || p.path.toLowerCase().includes(s)));
});
const homePage = computed(() => pages.value.find(p => p.path === '/'));
const topRows = computed(() => rows.value.filter(r => r.depth === 0 && r.node.kind !== 'home' && (r.node.ref || r.node.label) && subtreeDepth(r.node) < MAX_DEPTH));
const picked = computed(() => pickPages.value.length + pickCats.value.length + (pickHome.value ? 1 : 0));
const used = (kind: string, ref: string) => rows.value.some(r => r.node.kind === kind && r.node.ref === ref);

function openAdd() {
  q.value = ''; pickPages.value = []; pickCats.value = []; pickHome.value = false; target.value = '';
  linkForm.label = ''; linkForm.href = 'https://'; groupLabel.value = ''; tab.value = 'pages'; open.value = true;
  if (!pages.value.length && !categories.value.length) loadRefs();
}
const toggle = (arr: string[], id: string) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); else arr.push(id); };

function addNodes(nodes: MenuNode[]) {
  const room = MAX_ITEMS - count.value;
  const list = target.value ? (rows.value.find(r => r.node.ref === target.value || r.node.label === target.value)?.node.children ?? items.value) : items.value;
  list.push(...nodes.slice(0, Math.max(0, room)));
}
function confirmAdd() {
  const nodes: MenuNode[] = [];
  if (tab.value === 'pages') {
    if (pickHome.value) nodes.push({ kind: 'home', label: '', children: [] });
    for (const id of pickPages.value) nodes.push({ kind: 'page', ref: id, label: '', children: [] });
    for (const id of pickCats.value) nodes.push({ kind: 'category', ref: id, label: '', children: [] });
  } else if (tab.value === 'categories') {
    for (const id of pickCats.value) nodes.push({ kind: 'category', ref: id, label: '', children: [] });
  } else if (tab.value === 'link') {
    if (!linkForm.label.trim() || !/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(linkForm.href.trim())) return;
    nodes.push({ kind: 'link', label: linkForm.label.trim(), href: linkForm.href.trim(), children: [] });
  } else {
    if (!groupLabel.value.trim()) return;
    nodes.push({ kind: 'group', label: groupLabel.value.trim(), children: [] });
  }
  if (!nodes.length) return;
  custom.value = true;
  addNodes(nodes);
  open.value = false;
}

// A ready-made catalogue: one wide "Catalog" panel, root categories as columns, their children as links.
function buildCatalog() {
  const roots = categories.value.filter(c => !c.parentId || !catById.value.has(c.parentId)).sort((a, b) => (a.sort - b.sort) || a.title.localeCompare(b.title));
  const node = (c: SiteCategory, depth: number): MenuNode => ({
    kind: 'category', ref: c.id, label: '',
    children: depth >= 2 ? [] : categories.value.filter(x => x.parentId === c.id).sort((a, b) => (a.sort - b.sort) || a.title.localeCompare(b.title)).map(x => node(x, depth + 1)),
  });
  custom.value = true;
  items.value.push({ kind: 'group', label: t('pages.design.menu.catalogName'), mega: true, children: roots.map(c => node(c, 1)) });
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <button type="button" class="group flex min-w-0 flex-1 items-start gap-2 text-left" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
        <Icon name="lucide:chevron-down" class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:text-gray-700 dark:group-hover:text-gray-200" :class="collapsed && '-rotate-90'" />
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.design.menu.title') }}<span v-if="collapsed" class="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{{ custom ? t('pages.design.menu.items', { n: count }) : t('pages.design.menu.auto') }}</span></span>
          <span v-if="!collapsed" class="block text-xs text-gray-500 dark:text-gray-400">{{ t('pages.design.menu.hint2') }}</span>
        </span>
      </button>
      <div v-show="!collapsed" class="at-seg !min-w-0">
        <button type="button" class="at-seg__btn" :class="!custom && 'at-seg__btn--on'" @click="custom = false">{{ t('pages.design.menu.auto') }}</button>
        <button type="button" class="at-seg__btn" :class="custom && 'at-seg__btn--on'" @click="custom = true">{{ t('pages.design.menu.custom') }}</button>
      </div>
    </div>

    <template v-if="custom && !collapsed">
      <div v-if="rows.length" class="flex flex-col gap-1.5">
        <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-2 rounded-2xl bg-gray-50 p-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10" :style="{ marginLeft: `${r.depth * 1.25}rem` }">
          <span class="icon-tile !h-8 !w-8 flex-shrink-0" :title="t(`pages.design.menu.kind.${r.node.kind}`)"><UIcon :name="KIND_ICON[r.node.kind]" class="h-4 w-4" /></span>
          <div class="grid min-w-0 flex-1 gap-1.5" :class="r.node.kind === 'link' && 'sm:grid-cols-2'">
            <UInput v-model="r.node.label" maxlength="60" size="sm" :placeholder="defaultLabel(r.node) || t('pages.design.menu.label')" />
            <UInput v-if="r.node.kind === 'link'" v-model="r.node.href" size="sm" :placeholder="t('pages.design.menu.href')" />
          </div>
          <span v-if="missing(r.node)" class="hidden flex-shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 sm:inline dark:bg-rose-500/15 dark:text-rose-300">{{ t('pages.design.menu.missing') }}</span>
          <span v-else-if="unpublished(r.node)" class="hidden flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 sm:inline dark:bg-amber-500/15 dark:text-amber-300" :title="t('pages.design.menu.draftHint')">{{ t('pages.status.draft') }}</span>
          <button v-if="canMega(r)" type="button" class="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition" :class="r.node.mega ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-500 ring-black/10 dark:bg-transparent dark:text-gray-400 dark:ring-white/10'" :title="t('pages.design.menu.megaHint')" @click="r.node.mega = !r.node.mega">
            <Icon name="lucide:layout-grid" class="mr-1 inline h-3 w-3" />{{ t('pages.design.menu.mega') }}
          </button>
          <div class="flex flex-shrink-0 items-center">
            <button type="button" class="rounded-full p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200" :disabled="r.idx === 0" :aria-label="t('pages.design.menu.up')" @click="move(r, -1)"><Icon name="lucide:chevron-up" class="h-4 w-4" /></button>
            <button type="button" class="rounded-full p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200" :disabled="r.idx === r.list.length - 1" :aria-label="t('pages.design.menu.down')" @click="move(r, 1)"><Icon name="lucide:chevron-down" class="h-4 w-4" /></button>
            <button type="button" class="rounded-full p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200" :disabled="r.depth === 0" :title="t('pages.design.menu.outdent')" :aria-label="t('pages.design.menu.outdent')" @click="outdent(r)"><Icon name="lucide:arrow-left-to-line" class="h-4 w-4" /></button>
            <button type="button" class="rounded-full p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200" :disabled="!canIndent(r)" :title="t('pages.design.menu.indent')" :aria-label="t('pages.design.menu.indent')" @click="indent(r)"><Icon name="lucide:arrow-right-to-line" class="h-4 w-4" /></button>
            <button type="button" class="rounded-full p-1 text-gray-400 hover:text-rose-600" :aria-label="t('common.delete')" @click="remove(r)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <p v-else class="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.design.menu.empty') }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="at-btn at-btn--blue" :disabled="count >= MAX_ITEMS" @click="openAdd"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.design.menu.add') }}</button>
        <button v-if="categories.length" type="button" class="at-btn" @click="buildCatalog"><Icon name="lucide:layout-grid" class="h-4 w-4" />{{ t('pages.design.menu.catalog') }}</button>
        <span class="text-xs text-gray-400">{{ t('pages.design.menu.count', { n: count, max: MAX_ITEMS }) }}</span>
      </div>
    </template>
    <p v-else-if="!custom && !collapsed" class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.design.menu.autoHint') }}</p>

    <UModal v-model="open" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-xl' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ t('pages.design.menu.add') }}</h3></template>
        <div class="space-y-3.5">
          <div class="at-seg !flex w-full">
            <button v-for="k in (['pages', 'categories', 'link', 'group'] as const)" :key="k" type="button" class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs" :class="tab === k && 'at-seg__btn--on'" @click="tab = k">{{ t(`pages.design.menu.tab.${k}`) }}</button>
          </div>

          <template v-if="tab === 'pages'">
            <UInput v-model="q" icon="i-lucide-search" :placeholder="t('pages.pages.search')" />
            <div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
              <button v-if="homePage" type="button" class="menu-pick" :class="pickHome && 'menu-pick--on'" @click="pickHome = !pickHome">
                <UIcon :name="pickHome ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" /><span class="min-w-0 flex-1 truncate">{{ t('pages.design.menu.home') }}</span><span class="text-[11px] text-gray-400">/</span>
              </button>
              <button v-for="p in pageRows" :key="p.id" type="button" class="menu-pick" :class="pickPages.includes(p.id) && 'menu-pick--on'" :disabled="used('page', p.id)" @click="toggle(pickPages, p.id)">
                <UIcon :name="pickPages.includes(p.id) || used('page', p.id) ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" />
                <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
                <span v-if="p.status !== 'PAGE_READY'" class="flex-shrink-0 rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{{ t('pages.status.draft') }}</span>
                <span class="max-w-[40%] flex-shrink-0 truncate text-[11px] text-gray-400">{{ p.path }}</span>
              </button>
              <p v-if="!pageRows.length" class="py-4 text-center text-xs text-gray-500">{{ t('pages.pages.noMatches') }}</p>
            </div>
          </template>

          <template v-else-if="tab === 'categories'">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">{{ t('pages.design.menu.catsHint') }}</span>
              <button v-if="catRows.length" type="button" class="text-xs font-semibold text-primary-600 dark:text-primary-300" @click="pickCats = catRows.filter(r => !used('category', r.cat.id)).map(r => r.cat.id)">{{ t('pages.design.menu.selectAll') }}</button>
            </div>
            <div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
              <button v-for="r in catRows" :key="r.cat.id" type="button" class="menu-pick" :class="pickCats.includes(r.cat.id) && 'menu-pick--on'" :disabled="used('category', r.cat.id)" :style="{ paddingLeft: `${0.75 + r.depth * 1.1}rem` }" @click="toggle(pickCats, r.cat.id)">
                <UIcon :name="pickCats.includes(r.cat.id) || used('category', r.cat.id) ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" /><span class="min-w-0 flex-1 truncate">{{ r.cat.title }}</span><span class="text-[11px] text-gray-400">{{ t('pages.categories.pageCount', { n: r.cat.pageCount }) }}</span>
              </button>
              <p v-if="!catRows.length" class="py-4 text-center text-xs text-gray-500">{{ t('pages.categories.none') }}</p>
            </div>
          </template>

          <template v-else-if="tab === 'link'">
            <UFormGroup :label="t('pages.design.menu.label')"><UInput v-model="linkForm.label" maxlength="60" /></UFormGroup>
            <UFormGroup :label="t('pages.design.menu.href')"><UInput v-model="linkForm.href" /></UFormGroup>
          </template>

          <template v-else>
            <UFormGroup :label="t('pages.design.menu.label')" :help="t('pages.design.menu.groupHint')"><UInput v-model="groupLabel" maxlength="60" /></UFormGroup>
          </template>

          <div v-if="topRows.length && (tab === 'pages' || tab === 'categories')">
            <div class="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('pages.design.menu.into') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="rounded-full px-3 py-1 text-xs font-semibold ring-1" :class="!target ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300' : 'bg-white text-gray-600 ring-black/10 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'" @click="target = ''">{{ t('pages.design.menu.topLevel') }}</button>
              <button v-for="r in topRows" :key="r.node.ref || r.node.label" type="button" class="max-w-[12rem] truncate rounded-full px-3 py-1 text-xs font-semibold ring-1" :class="target === (r.node.ref || r.node.label) ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300' : 'bg-white text-gray-600 ring-black/10 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'" @click="target = r.node.ref || r.node.label">{{ r.node.label || defaultLabel(r.node) }}</button>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-gray-500">{{ (tab === 'pages' || tab === 'categories') && picked ? t('pages.design.menu.picked', { n: picked }) : '' }}</span>
            <div class="flex gap-2">
              <button type="button" class="at-btn" @click="open = false">{{ t('common.cancel') }}</button>
              <button type="button" class="at-btn at-btn--primary" :disabled="(tab === 'pages' || tab === 'categories') && !picked" @click="confirmAdd">{{ t('pages.design.menu.addSelected') }}</button>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>
  </section>
</template>

<style scoped>
.menu-pick { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; border-radius: 0.9rem; font-size: 0.875rem; text-align: left; color: rgb(55 65 81); background: transparent; transition: background 0.12s; }
.menu-pick:hover:not(:disabled) { background: rgb(243 244 246); }
.menu-pick--on { background: rgb(239 246 255); color: rgb(29 78 216); }
.menu-pick:disabled { opacity: 0.45; cursor: default; }
:global(.dark) .menu-pick { color: rgb(209 213 219); }
:global(.dark) .menu-pick:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
:global(.dark) .menu-pick--on { background: rgba(59, 130, 246, 0.16); color: rgb(147 197 253); }
</style>
