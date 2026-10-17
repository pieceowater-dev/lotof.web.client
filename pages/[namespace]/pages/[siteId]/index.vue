<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import { useOnboarding } from '@/composables/useOnboarding';
import { pagesSiteTour } from '@/config/tours';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LinkReportPanel from '@/components/pages/LinkReportPanel.vue';
import BlogSettingsPanel from '@/components/pages/BlogSettingsPanel.vue';
import ThemeDesigner, { type DesignPayload } from '@/components/pages/ThemeDesigner.vue';
import DomainsPanel from '@/components/pages/DomainsPanel.vue';
import CategoriesPanel from '@/components/pages/CategoriesPanel.vue';
import GlobalBlocksPanel from '@/components/pages/GlobalBlocksPanel.vue';
import CategoryChips from '@/components/pages/CategoryChips.vue';
import PagePicker from '@/components/pages/PagePicker.vue';
import PageNav from '@/components/ui/PageNav.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePageTitle } from '@/composables/usePageTitle';
import { useConfirm } from '@/composables/useConfirm';
import { usePagesAccess } from '@/composables/usePagesAccess';
import {
  pagesApi, type PagesSite, type PageTemplate, type SitePage, type SiteVersion, type SiteRedirect, type PreflightResult, type SiteCategory,
} from '@/api/pages/ops';
import { siteOrigin, slugifyText } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const { t, locale } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const siteId = computed(() => route.params.siteId as string);
const toast = useToast();
const { getToken } = usePagesAuth();
const { confirm } = useConfirm();

const booting = ref(true);
const site = ref<PagesSite | null>(null);
const pages = ref<SitePage[]>([]);
const categories = ref<SiteCategory[]>([]);
const versions = ref<SiteVersion[]>([]);
const redirects = ref<SiteRedirect[]>([]);
const preflight = ref<PreflightResult | null>(null);

usePageTitle('pages', { subject: () => site.value?.name });

type TabKey = 'pages' | 'categories' | 'blocks' | 'design' | 'domains' | 'publish' | 'settings';
const { load: loadAccess, canManage } = usePagesAccess(() => nsSlug.value);
const ALL_TABS = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
  { key: 'pages', label: t('pages.tabs.pages'), icon: 'lucide:files' },
  { key: 'categories', label: t('pages.tabs.categories'), icon: 'lucide:folder' },
  { key: 'publish', label: t('pages.tabs.publish'), icon: 'lucide:rocket' },
  { key: 'blocks', label: t('pages.tabs.blocks'), icon: 'lucide:blocks' },
  { key: 'design', label: t('pages.tabs.design'), icon: 'lucide:palette' },
  { key: 'domains', label: t('pages.tabs.domains'), icon: 'lucide:link-2' },
  { key: 'settings', label: t('pages.tabs.settings'), icon: 'lucide:settings' },
]);
// Editors work with articles only: no publishing, design, domains, redirects, keys or settings.
const TABS = computed(() => (canManage.value ? ALL_TABS.value : ALL_TABS.value.filter(x => x.key === 'pages' || x.key === 'categories' || x.key === 'blocks')));
// old links with ?tab=redirects land on Settings, where redirects now live
const requestedTab = route.query.tab === 'redirects' ? 'settings' : route.query.tab;
const activeTab = ref<TabKey>((ALL_TABS.value.some(x => x.key === requestedTab) ? requestedTab : 'pages') as TabKey);
watch(canManage, (v) => { if (!v && !['pages', 'categories', 'blocks'].includes(activeTab.value)) activeTab.value = 'pages'; });
watch(activeTab, (tab) => navigateTo({ query: { ...route.query, tab } }, { replace: true }));

function fail(e: unknown, key = 'common.error') {
  logError('[pages/site]', e);
  const raw = (e as any)?.response?.errors?.[0]?.message;
  toast.add({ title: t(key), description: getErrorMessage(e, t) || raw || t('common.errorRetry'), color: 'red' });
}

async function loadAll() {
  try {
    await getToken(nsSlug.value);
    const [s, p, v, r, cats] = await Promise.all([
      pagesApi.site(nsSlug.value, siteId.value),
      pagesApi.pages(nsSlug.value, siteId.value),
      pagesApi.versions(nsSlug.value, siteId.value),
      pagesApi.redirects(nsSlug.value, siteId.value),
      pagesApi.categories(nsSlug.value, siteId.value),
    ]);
    if (!s) { await navigateTo(`/${nsSlug.value}/pages`); return; }
    site.value = s; pages.value = p; versions.value = v; redirects.value = r; categories.value = cats;
    fillSettings(s);
  } catch (e) {
    fail(e);
  } finally {
    booting.value = false;
  }
}
onMounted(async () => {
  await Promise.all([loadAccess(), loadAll()]);
  maybeStartTour();
});

// The site screen is explained once, to someone who can edit it.
function maybeStartTour() {
  if (!canManage.value || !pages.value.length) return;
  const { isCompleted, startTour } = useOnboarding();
  if (isCompleted(pagesSiteTour.id)) return;
  setTimeout(() => startTour(pagesSiteTour), 1500);
}

async function reloadCategories() {
  try {
    [categories.value, pages.value] = await Promise.all([pagesApi.categories(nsSlug.value, siteId.value), pagesApi.pages(nsSlug.value, siteId.value)]);
  } catch (e) { fail(e); }
}
const catTitle = (id: string) => categories.value.find(c => c.id === id)?.title || '';
function showCategoryPages(id: string) { categoryFilter.value = id; pageFilter.value = 'all'; activeTab.value = 'pages'; }

const origin = computed(() => (site.value ? siteOrigin(site.value.host) : ''));
const isLive = computed(() => !!site.value?.publishedVersion && site.value.status !== 'SITE_SUSPENDED');
const readyCount = computed(() => pages.value.filter(p => p.status === 'PAGE_READY').length);

// ───────── pages tab ─────────
// Siblings sit under their parent ordered by `sort`, then title — the same way WordPress lists a page tree.
const sortedPages = computed(() => {
  const byParent = new Map<string, SitePage[]>();
  for (const p of pages.value) {
    const key = p.path === '/' ? '' : (p.parentId || '');
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(p);
  }
  const home = pages.value.find(p => p.path === '/');
  const out: SitePage[] = [];
  const walk = (parent: string) => {
    for (const p of (byParent.get(parent) || []).filter(x => x !== home).sort((x, y) => (x.sort - y.sort) || x.title.localeCompare(y.title))) {
      out.push(p); walk(p.id);
    }
  };
  if (home) out.push(home);
  walk('');
  return out;
});
const hasHome = computed(() => pages.value.some(p => p.path === '/'));
const depth = (p: SitePage) => (p.path === '/' ? 0 : p.path.split('/').length - 2);
const childCount = (p: SitePage) => pages.value.filter(x => x.parentId === p.id).length;

type PageFilter = 'all' | 'ready' | 'draft';
const pageFilter = ref<PageFilter>('all');
const pageQuery = ref('');
const categoryFilter = ref('');
const draftCount = computed(() => pages.value.length - readyCount.value);
const FILTERS = computed<{ key: PageFilter; label: string; n: number }[]>(() => [
  { key: 'all', label: t('pages.pages.filterAll'), n: pages.value.length },
  { key: 'ready', label: t('pages.pages.filterReady'), n: readyCount.value },
  { key: 'draft', label: t('pages.pages.filterDraft'), n: draftCount.value },
]);
const searching = computed(() => !!pageQuery.value.trim() || pageFilter.value !== 'all' || !!categoryFilter.value);
const visiblePages = computed(() => {
  const q = pageQuery.value.trim().toLowerCase();
  return sortedPages.value.filter((p) => {
    if (pageFilter.value === 'ready' && p.status !== 'PAGE_READY') return false;
    if (pageFilter.value === 'draft' && p.status === 'PAGE_READY') return false;
    if (categoryFilter.value && !(p.categoryIds || []).includes(categoryFilter.value)) return false;
    return !q || p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
  });
});
const pageSize = ref(10);
const pageNo = ref(1);
const pagedPages = computed(() => visiblePages.value.slice((pageNo.value - 1) * pageSize.value, pageNo.value * pageSize.value));
watch([pageQuery, pageFilter, pageSize, categoryFilter], () => { pageNo.value = 1; });
watch(() => visiblePages.value.length, (n) => { const max = Math.max(1, Math.ceil(n / pageSize.value)); if (pageNo.value > max) pageNo.value = max; });
// While filtering the tree is flat, so indentation would be misleading.
const rowDepth = (p: SitePage) => (searching.value ? 0 : depth(p));
const pageUrl = (p: SitePage) => `${origin.value}${p.path === '/' ? '' : p.path}`;

const pageModal = ref(false);
const pageSaving = ref(false);
const pageForm = reactive({ title: '', slug: '', parentId: '' as string, home: false });
const pageSlugTouched = ref(false);
// ready-made layouts offered when a page is created; '' = an empty page
const templates = ref<PageTemplate[]>([]);
const templateId = ref('');
async function loadTemplates() {
  if (templates.value.length) return;
  try { templates.value = await pagesApi.pageTemplates(nsSlug.value, locale.value); } catch { /* the modal simply offers an empty page */ }
}
const pageError = ref('');
const parentPath = computed(() => pages.value.find(p => p.id === pageForm.parentId)?.path || '');
watch(() => pageForm.title, (v) => { if (!pageSlugTouched.value) pageForm.slug = slugifyText(v, 60); });

function openCreatePage(opts: { parentId?: string; home?: boolean } = {}) {
  pageForm.title = opts.home ? t('pages.pages.homeTitle') : '';
  pageForm.slug = '';
  pageForm.parentId = opts.parentId || '';
  pageForm.home = !!opts.home;
  pageSlugTouched.value = false;
  pageError.value = '';
  templateId.value = '';
  pageModal.value = true;
  loadTemplates();
}

async function createPage() {
  pageError.value = '';
  if (!pageForm.title.trim()) { pageError.value = t('pages.pages.needTitle'); return; }
  if (!pageForm.home && !pageForm.slug) { pageError.value = t('pages.pages.needSlug'); return; }
  pageSaving.value = true;
  try {
    const created = await pagesApi.createPage(nsSlug.value, {
      siteId: siteId.value, parentId: pageForm.home ? null : (pageForm.parentId || null),
      slug: pageForm.home ? '' : pageForm.slug, title: pageForm.title.trim(),
    });
    const tpl = templates.value.find(x => x.id === templateId.value);
    if (tpl) {
      await pagesApi.updatePage(nsSlug.value, {
        id: created.id, slug: created.slug, title: created.title, status: 'PAGE_DRAFT',
        blocks: tpl.blocks.map(b => ({ id: b.id, type: b.type, content: b.content, attrsJson: b.attrsJson })),
      });
    }
    pageModal.value = false;
    await navigateTo(`/${nsSlug.value}/pages/${siteId.value}/edit/${created.id}`);
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('already exists')) pageError.value = t('pages.pages.pathTaken');
    else if (msg.includes('lowercase')) pageError.value = t('pages.pages.slugInvalid');
    else fail(e);
  } finally {
    pageSaving.value = false;
  }
}

// ── selection, bulk actions and the trash ──
const selected = ref<Set<string>>(new Set());
const bulkBusy = ref(false);
const showTrash = ref(false);
const trash = ref<SitePage[]>([]);
const trashCount = computed(() => trash.value.length);
const toggleSel = (id: string) => { const n = new Set(selected.value); n.has(id) ? n.delete(id) : n.add(id); selected.value = n; };
const allOnPageSelected = computed(() => pagedPages.value.length > 0 && pagedPages.value.every(p => selected.value.has(p.id)));
function toggleAllOnPage() {
  const n = new Set(selected.value);
  if (allOnPageSelected.value) pagedPages.value.forEach(p => n.delete(p.id));
  else pagedPages.value.forEach(p => n.add(p.id));
  selected.value = n;
}
async function loadTrash() {
  try { trash.value = await pagesApi.trash(nsSlug.value, siteId.value); } catch { trash.value = []; }
}
async function reloadPages() {
  try { pages.value = await pagesApi.pages(nsSlug.value, siteId.value); } catch (e) { fail(e); }
}
function reportBulk(res: { affected: number; failed: string[] }) {
  if (res.failed.length) toast.add({ title: t('pages.bulk.partial', { n: res.affected, f: res.failed.length }), description: res.failed[0].split(': ').slice(1).join(': '), color: 'amber' });
  else toast.add({ title: t('pages.bulk.done', { n: res.affected }), color: 'green' });
}
async function bulk(action: 'trash' | 'draft' | 'publish') {
  const ids = [...selected.value];
  if (!ids.length || bulkBusy.value) return;
  if (action === 'trash') {
    const ok = await confirm({ title: t('pages.bulk.trashTitle', { n: ids.length }), message: t('pages.bulk.trashText'), confirmLabel: t('pages.bulk.toTrash'), cancelLabel: t('common.cancel') });
    if (!ok) return;
  }
  bulkBusy.value = true;
  try {
    reportBulk(await pagesApi.bulkPages(nsSlug.value, siteId.value, ids, action));
    selected.value = new Set();
    await Promise.all([reloadPages(), loadTrash()]);
  } catch (e) { fail(e); } finally { bulkBusy.value = false; }
}
async function restorePage(p: SitePage) {
  try {
    const back = await pagesApi.restorePage(nsSlug.value, p.id);
    toast.add({ title: t('pages.trash.restored', { path: back.path }), color: 'green' });
    await Promise.all([reloadPages(), loadTrash()]);
  } catch (e) { fail(e); }
}
async function purgePage(p: SitePage) {
  const ok = await confirm({ title: t('pages.trash.purgeTitle'), message: t('pages.trash.purgeText', { name: p.title }), confirmLabel: t('pages.trash.purge'), cancelLabel: t('common.cancel') });
  if (!ok) return;
  try { await pagesApi.purgePage(nsSlug.value, p.id); await loadTrash(); } catch (e) { fail(e); }
}
async function emptyTrash() {
  if (!trash.value.length) return;
  const ok = await confirm({ title: t('pages.trash.emptyTitle'), message: t('pages.trash.emptyText', { n: trash.value.length }), confirmLabel: t('pages.trash.empty'), cancelLabel: t('common.cancel') });
  if (!ok) return;
  try { reportBulk(await pagesApi.bulkPages(nsSlug.value, siteId.value, trash.value.map(x => x.id), 'purge')); await loadTrash(); } catch (e) { fail(e); }
}
const daysLeft = (p: SitePage) => Math.max(0, 30 - Math.floor((Date.now() / 1000 - p.trashedAtUnix) / 86400));
onMounted(loadTrash);

async function deletePage(p: SitePage) {
  const ok = await confirm({
    title: t('pages.pages.deleteTitle'), message: t('pages.pages.deleteText', { name: p.title }),
    confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.deletePage(nsSlug.value, p.id);
    pages.value = pages.value.filter(x => x.id !== p.id);
    loadTrash();
    toast.add({ title: t('pages.pages.deleted'), color: 'green' });
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('child pages')) toast.add({ title: t('pages.pages.hasChildren'), color: 'amber' });
    else fail(e);
  }
}

async function toggleReady(p: SitePage) {
  try {
    const full = await pagesApi.page(nsSlug.value, p.id);
    if (!full) return;
    const next = p.status === 'PAGE_READY' ? 'PAGE_DRAFT' : 'PAGE_READY';
    await pagesApi.updatePage(nsSlug.value, {
      id: full.id, slug: full.slug, title: full.title, status: next, lang: full.lang,
      seo: full.seo, blocks: full.blocks.map(b => ({ id: b.id, type: b.type, content: b.content, attrsJson: b.attrsJson })),
    });
    p.status = next;
  } catch (e) { fail(e); }
}

// ───────── quick edit (WordPress "Quick Edit") ─────────
const qeOpen = ref(false);
const qeSaving = ref(false);
const qeError = ref('');
const qe = reactive({ id: '', title: '', slug: '', parentId: '', sort: 0, ready: false, isHome: false, cats: [] as string[] });
const qeOrig = reactive({ parentId: '', sort: 0 });
const descendantIds = (id: string): Set<string> => {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of pages.value) if (p.parentId && out.has(p.parentId) && !out.has(p.id)) { out.add(p.id); grew = true; }
  }
  return out;
};
function openQuickEdit(p: SitePage) {
  Object.assign(qe, { id: p.id, title: p.title, slug: p.slug, parentId: p.parentId || '', sort: p.sort || 0, ready: p.status === 'PAGE_READY', isHome: p.path === '/', cats: [...(p.categoryIds || [])] });
  qeOrig.parentId = p.parentId || ''; qeOrig.sort = p.sort || 0;
  qeError.value = '';
  qeOpen.value = true;
}

async function saveQuickEdit() {
  qeError.value = '';
  if (!qe.title.trim()) { qeError.value = t('pages.pages.needTitle'); return; }
  if (!qe.isHome && !qe.slug) { qeError.value = t('pages.pages.needSlug'); return; }
  qeSaving.value = true;
  try {
    const full = await pagesApi.page(nsSlug.value, qe.id);
    if (!full) return;
    await pagesApi.updatePage(nsSlug.value, {
      id: full.id, slug: qe.isHome ? '' : qe.slug, title: qe.title.trim(), status: qe.ready ? 'PAGE_READY' : 'PAGE_DRAFT', lang: full.lang,
      seo: full.seo, blocks: full.blocks.map(b => ({ id: b.id, type: b.type, content: b.content, attrsJson: b.attrsJson })),
      categoryIds: qe.cats,
    });
    if (!qe.isHome && (qe.parentId !== qeOrig.parentId || Number(qe.sort) !== qeOrig.sort)) {
      await pagesApi.movePage(nsSlug.value, qe.id, qe.parentId || null, Number(qe.sort) || 0);
    }
    qeOpen.value = false;
    await reloadCategories();
    toast.add({ title: t('pages.pages.saved'), color: 'green' });
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('already exists')) qeError.value = t('pages.pages.pathTaken');
    else if (msg.includes('lowercase')) qeError.value = t('pages.pages.slugInvalid');
    else fail(e);
  } finally {
    qeSaving.value = false;
  }
}

async function duplicatePage(p: SitePage) {
  try {
    const full = await pagesApi.page(nsSlug.value, p.id);
    if (!full) return;
    const taken = new Set(pages.value.filter(x => (x.parentId || '') === (p.parentId || '')).map(x => x.slug));
    let slug = `${p.slug}-copy`;
    for (let i = 2; taken.has(slug); i++) slug = `${p.slug}-copy-${i}`;
    const created = await pagesApi.createPage(nsSlug.value, { siteId: siteId.value, parentId: p.parentId || null, slug, title: `${p.title} ${t('pages.pages.copySuffix')}`, lang: full.lang });
    await pagesApi.updatePage(nsSlug.value, {
      id: created.id, slug, title: `${p.title} ${t('pages.pages.copySuffix')}`, status: 'PAGE_DRAFT', lang: full.lang,
      seo: full.seo, blocks: full.blocks.map(b => ({ id: b.id, type: b.type, content: b.content, attrsJson: b.attrsJson })),
      categoryIds: full.categoryIds || [],
    });
    await reloadCategories();
    toast.add({ title: t('pages.pages.duplicated'), color: 'green' });
  } catch (e) { fail(e); }
}

// ───────── publish tab ─────────
const checking = ref(false);
const publishing = ref(false);
const publishNote = ref('');
// Pre-publish findings arrive in Russian with a code; show the text of the visitor's language and keep the
// variable part (a path, a block name, counts) from the original message.
function issueText(i: { code: string; message: string }): string {
  const key = `pages.preflight.${i.code}`;
  const base = t(key);
  if (!base || base === key) return i.message;
  const detail = i.message.includes(': ') ? i.message.slice(i.message.lastIndexOf(': ') + 2) : '';
  const nums = i.message.match(/\d+/g) || [];
  return base.replace('{detail}', detail).replace('{hidden}', nums[0] ?? '').replace('{total}', nums[1] ?? '');
}

const errorIssues = computed(() => (preflight.value?.issues || []).filter(i => i.severity === 'error'));
const warnIssues = computed(() => (preflight.value?.issues || []).filter(i => i.severity !== 'error'));

async function runPreflight() {
  checking.value = true;
  try { preflight.value = await pagesApi.preflight(nsSlug.value, siteId.value); } catch (e) { fail(e); } finally { checking.value = false; }
}

async function publish() {
  publishing.value = true;
  try {
    await runPreflight();
    if (preflight.value && !preflight.value.ok) { activeTab.value = 'publish'; return; }
    const v = await pagesApi.publish(nsSlug.value, siteId.value, publishNote.value.trim());
    publishNote.value = '';
    toast.add({ title: t('pages.publish.done', { v: v.version }), color: 'green' });
    const [s, vs] = await Promise.all([pagesApi.site(nsSlug.value, siteId.value), pagesApi.versions(nsSlug.value, siteId.value)]);
    if (s) site.value = s;
    versions.value = vs;
  } catch (e) { fail(e); } finally { publishing.value = false; }
}

async function rollback(v: SiteVersion) {
  const ok = await confirm({
    title: t('pages.publish.rollbackTitle', { v: v.version }), message: t('pages.publish.rollbackText'),
    confirmLabel: t('pages.publish.rollback'), cancelLabel: t('common.cancel'), color: 'amber', icon: 'lucide:undo-2',
  });
  if (!ok) return;
  try {
    await pagesApi.rollback(nsSlug.value, siteId.value, v.version);
    const [s, vs] = await Promise.all([pagesApi.site(nsSlug.value, siteId.value), pagesApi.versions(nsSlug.value, siteId.value)]);
    if (s) site.value = s;
    versions.value = vs;
    toast.add({ title: t('pages.publish.rolledBack', { v: v.version }), color: 'green' });
  } catch (e) { fail(e); }
}

const fmt = (unix: number) => new Date(unix * 1000).toLocaleString(locale.value === 'kk' ? 'kk-KZ' : locale.value, { dateStyle: 'medium', timeStyle: 'short' });
const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// ───────── redirects tab ─────────
const redirectForm = reactive({ from: '', to: '' });
const redirectSaving = ref(false);
const csvOpen = ref(false);
const csvText = ref('');
const csvBusy = ref(false);

async function addRedirect() {
  if (!redirectForm.from.trim() || !redirectForm.to.trim()) return;
  redirectSaving.value = true;
  try {
    await pagesApi.upsertRedirect(nsSlug.value, { siteId: siteId.value, fromPath: redirectForm.from.trim(), toPath: redirectForm.to.trim() });
    redirectForm.from = ''; redirectForm.to = '';
    redirects.value = await pagesApi.redirects(nsSlug.value, siteId.value);
    toast.add({ title: t('pages.redirects.added'), description: t('pages.redirects.needsPublish'), color: 'green' });
  } catch (e) { fail(e); } finally { redirectSaving.value = false; }
}

async function removeRedirect(r: SiteRedirect) {
  try {
    await pagesApi.deleteRedirect(nsSlug.value, r.id);
    redirects.value = redirects.value.filter(x => x.id !== r.id);
  } catch (e) { fail(e); }
}

async function importCsv() {
  if (!csvText.value.trim()) return;
  csvBusy.value = true;
  try {
    const res = await pagesApi.importRedirects(nsSlug.value, siteId.value, csvText.value);
    redirects.value = await pagesApi.redirects(nsSlug.value, siteId.value);
    toast.add({
      title: t('pages.redirects.imported', { n: res.imported }),
      description: res.errors.length ? res.errors.slice(0, 3).join('; ') : undefined,
      color: res.errors.length ? 'amber' : 'green',
    });
    if (!res.errors.length) { csvOpen.value = false; csvText.value = ''; }
  } catch (e) { fail(e); } finally { csvBusy.value = false; }
}

// ───────── settings tab ─────────
const settingsForm = reactive({ name: '', defaultLang: 'ru', googleSiteVerification: '', robotsTxt: '' });
const settingsSaving = ref(false);

function fillSettings(s: PagesSite) {
  settingsForm.name = s.name;
  settingsForm.defaultLang = s.settings.defaultLang || 'ru';
  settingsForm.googleSiteVerification = s.settings.googleSiteVerification || '';
  settingsForm.robotsTxt = s.settings.robotsTxt || '';
}

async function saveSettings() {
  if (!site.value || !settingsForm.name.trim()) return;
  settingsSaving.value = true;
  try {
    const s = site.value.settings;
    site.value = await pagesApi.updateSite(nsSlug.value, {
      id: site.value.id, name: settingsForm.name.trim(),
      settings: {
        defaultLang: settingsForm.defaultLang, langs: s.langs, faviconUrl: s.faviconUrl, ogImageUrl: s.ogImageUrl,
        googleSiteVerification: settingsForm.googleSiteVerification.trim(), robotsTxt: settingsForm.robotsTxt,
        headHtml: s.headHtml, themeId: s.themeId, themeVarsJson: s.themeVarsJson, navJson: s.navJson,
        logoUrl: s.logoUrl, footerText: s.footerText, footHtml: s.footHtml, customCss: s.customCss, floatJson: s.floatJson,
        menusJson: s.menusJson, featuresJson: s.featuresJson,
      },
    });
    toast.add({ title: t('pages.settings.saved'), description: t('pages.settings.needsPublish'), color: 'green' });
  } catch (e) { fail(e); } finally { settingsSaving.value = false; }
}

// The primary host changes with domains: refresh the site (header address) and the version list (auto-republish).
async function reloadSite() {
  try {
    const [s, vs] = await Promise.all([pagesApi.site(nsSlug.value, siteId.value), pagesApi.versions(nsSlug.value, siteId.value)]);
    if (s) site.value = s;
    versions.value = vs;
  } catch (e) { fail(e); }
}

const designSaving = ref(false);
async function saveDesign(p: DesignPayload) {
  if (!site.value) return;
  designSaving.value = true;
  try {
    const s = site.value.settings;
    site.value = await pagesApi.updateSite(nsSlug.value, {
      id: site.value.id, name: site.value.name,
      settings: {
        defaultLang: s.defaultLang, langs: s.langs, googleSiteVerification: s.googleSiteVerification, robotsTxt: s.robotsTxt, navJson: p.navJson,
        themeId: p.themeId, themeVarsJson: p.themeVarsJson, logoUrl: p.logoUrl, footerText: p.footerText,
        faviconUrl: p.faviconUrl, ogImageUrl: p.ogImageUrl, headHtml: p.headHtml, footHtml: p.footHtml, customCss: p.customCss, floatJson: p.floatJson,
        menusJson: p.menusJson, featuresJson: s.featuresJson,
      },
    });
    toast.add({ title: t('pages.design.saved'), description: t('pages.settings.needsPublish'), color: 'green' });
  } catch (e) { fail(e); } finally { designSaving.value = false; }
}

const blogSaving = ref(false);
async function saveBlog(featuresJson: string) {
  if (!site.value) return;
  blogSaving.value = true;
  try {
    const s = site.value.settings;
    site.value = await pagesApi.updateSite(nsSlug.value, { id: site.value.id, name: site.value.name, settings: { ...s, featuresJson } });
    toast.add({ title: t('pages.blog.saved'), description: t('pages.settings.needsPublish'), color: 'green' });
  } catch (e) { fail(e); } finally { blogSaving.value = false; }
}

async function toggleSuspend() {
  if (!site.value) return;
  const suspend = site.value.status !== 'SITE_SUSPENDED';
  if (suspend) {
    const ok = await confirm({
      title: t('pages.settings.suspendTitle'), message: t('pages.settings.suspendText'),
      confirmLabel: t('pages.settings.suspend'), cancelLabel: t('common.cancel'), color: 'amber', icon: 'lucide:pause',
    });
    if (!ok) return;
  }
  try { site.value = await pagesApi.setSuspended(nsSlug.value, site.value.id, suspend); } catch (e) { fail(e); }
}

async function removeSite() {
  if (!site.value) return;
  const ok = await confirm({
    title: t('pages.settings.deleteTitle'), message: t('pages.settings.deleteText', { host: site.value.host }),
    confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.deleteSite(nsSlug.value, site.value.id);
    await navigateTo(`/${nsSlug.value}/pages`);
  } catch (e) { fail(e); }
}

const LANGS = [{ v: 'ru', l: 'Русский' }, { v: 'kk', l: 'Қазақша' }, { v: 'en', l: 'English' }];
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <div v-if="booting" class="flex flex-col gap-4" role="status" aria-busy="true">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-2"><span class="sk sk-line sk-line--lg" style="width: 12rem" /><span class="sk sk-line sk-line--sm" style="width: 9rem" /></div>
        <span class="sk sk-pill" style="width: 8.5rem" />
      </div>
      <span class="sk sk-pill" style="width: 100%; max-width: 34rem; height: 2.75rem" />
      <AppSkeleton variant="list" :rows="6" />
    </div>

    <template v-else-if="site">
      <PageHeader :title="site.name" :subtitle="site.host" :back-to="`/${nsSlug}/pages?all=1`" :back-label="t('pages.title')">
        <template #primary>
          <button v-if="canManage" type="button" data-tour="site-publish" class="at-btn at-btn--primary" :disabled="publishing || !pages.length" @click="publish">
            <UIcon :name="publishing ? 'lucide:loader-2' : 'lucide:rocket'" class="h-4 w-4" :class="publishing && 'animate-spin'" />
            <span class="hidden min-[440px]:inline">{{ t('pages.publish.action') }}</span>
            <span class="sr-only min-[440px]:hidden">{{ t('pages.publish.action') }}</span>
          </button>
        </template>
        <template #actions>
          <a v-if="isLive" :href="origin" target="_blank" rel="noopener noreferrer" class="at-btn !px-2.5 xl:!px-3.5" :title="t('pages.openSite')" :aria-label="t('pages.openSite')">
            <Icon name="lucide:external-link" class="h-4 w-4" /><span class="hidden xl:inline">{{ t('pages.openSite') }}</span>
          </a>
        </template>
      </PageHeader>

      <div v-if="site.status === 'SITE_SUSPENDED'" class="at-banner">
        <div class="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
          <Icon name="lucide:pause-circle" class="h-4 w-4" />{{ t('pages.suspendedBanner') }}
        </div>
        <button type="button" class="at-btn at-btn--blue" @click="toggleSuspend">{{ t('pages.settings.resume') }}</button>
      </div>

      <div data-tour="site-tabs" class="overflow-x-auto no-scrollbar">
        <div class="at-seg">
          <button v-for="tab in TABS" :key="tab.key" type="button" class="at-seg__btn" :class="activeTab === tab.key && 'at-seg__btn--on'" @click="activeTab = tab.key">
            <Icon :name="tab.icon" class="h-4 w-4" />{{ tab.label }}
          </button>
        </div>
      </div>

      <!-- ═════════ PAGES ═════════ -->
      <template v-if="activeTab === 'pages'">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('pages.pages.summary', { total: pages.length, ready: readyCount }) }}</p>
          <button v-if="pages.length" type="button" data-tour="site-newpage" class="at-btn at-btn--blue" @click="openCreatePage()">
            <Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.pages.new') }}
          </button>
        </div>

        <EmptyState v-if="!pages.length" icon="lucide:file-plus-2" size="lg" :title="t('pages.pages.emptyTitle')" :description="t('pages.pages.emptyText')">
          <button type="button" class="at-btn at-btn--primary mt-2" @click="openCreatePage({ home: true })">
            <Icon name="lucide:house" class="h-4 w-4" />{{ t('pages.pages.createHome') }}
          </button>
        </EmptyState>

        <div v-else class="flex flex-col gap-3">
          <div v-if="!hasHome" class="at-banner">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('pages.pages.noHome') }}</span>
            <button type="button" class="at-btn at-btn--blue" @click="openCreatePage({ home: true })">{{ t('pages.pages.createHome') }}</button>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="overflow-x-auto no-scrollbar">
              <div class="at-seg !min-w-0">
                <button v-for="f in FILTERS" :key="f.key" type="button" class="at-seg__btn !py-1.5" :class="pageFilter === f.key && 'at-seg__btn--on'" @click="pageFilter = f.key">
                  {{ f.label }}<span class="text-xs opacity-60">{{ f.n }}</span>
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="at-btn flex-shrink-0" :class="showTrash && 'at-btn--blue'" @click="showTrash = !showTrash; selected = new Set()">
                <Icon name="lucide:trash-2" class="h-4 w-4" />{{ t('pages.trash.title') }}<span v-if="trashCount" class="text-xs opacity-70">{{ trashCount }}</span>
              </button>
              <UInput v-if="!showTrash" v-model="pageQuery" icon="i-lucide-search" :placeholder="t('pages.pages.search')" class="sm:w-72" />
            </div>
          </div>

          <!-- trash: deleted pages are kept 30 days -->
          <template v-if="showTrash">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('pages.trash.hint') }}</p>
              <button v-if="trash.length" type="button" class="at-btn hover:!bg-rose-50 hover:!text-rose-600" @click="emptyTrash"><Icon name="lucide:flame" class="h-4 w-4" />{{ t('pages.trash.empty') }}</button>
            </div>
            <p v-if="!trash.length" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.trash.none') }}</p>
            <div v-for="p in trash" :key="p.id" class="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
              <span class="icon-tile !h-9 !w-9 flex-shrink-0 opacity-60"><UIcon name="lucide:file-x" class="h-4 w-4" /></span>
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-gray-900 dark:text-white">{{ p.title }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.trash.daysLeft', { n: daysLeft(p) }) }}</div>
              </div>
              <button type="button" class="at-btn at-btn--blue flex-shrink-0" @click="restorePage(p)"><Icon name="lucide:undo-2" class="h-4 w-4" />{{ t('pages.trash.restore') }}</button>
              <button type="button" class="at-btn flex-shrink-0 !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :aria-label="t('pages.trash.purge')" :title="t('pages.trash.purge')" @click="purgePage(p)"><Icon name="lucide:x" class="h-4 w-4" /></button>
            </div>
          </template>

          <template v-else>
          <!-- bulk actions for the selected pages -->
          <div v-if="selected.size" class="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg ring-1 ring-primary-500/30 backdrop-blur dark:bg-[#1f1f1f]/95">
            <span class="mr-auto text-sm font-medium text-gray-900 dark:text-white">{{ t('pages.bulk.selected', { n: selected.size }) }}</span>
            <button type="button" class="at-btn" :disabled="bulkBusy" @click="bulk('publish')"><Icon name="lucide:rocket" class="h-4 w-4" />{{ t('pages.bulk.publish') }}</button>
            <button type="button" class="at-btn" :disabled="bulkBusy" @click="bulk('draft')"><Icon name="lucide:file-pen-line" class="h-4 w-4" />{{ t('pages.bulk.draft') }}</button>
            <button type="button" class="at-btn hover:!bg-rose-50 hover:!text-rose-600" :disabled="bulkBusy" @click="bulk('trash')"><Icon name="lucide:trash-2" class="h-4 w-4" />{{ t('pages.bulk.toTrash') }}</button>
            <button type="button" class="at-btn !px-2.5" :aria-label="t('common.cancel')" @click="selected = new Set()"><Icon name="lucide:x" class="h-4 w-4" /></button>
          </div>

          <div v-if="categories.length" class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('pages.categories.filter') }}</span>
            <button type="button" class="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition" :class="!categoryFilter ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-600 ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'" @click="categoryFilter = ''">{{ t('pages.categories.all') }}</button>
            <button v-for="c in categories" :key="c.id" type="button" class="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition" :class="categoryFilter === c.id ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-600 ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'" @click="categoryFilter = categoryFilter === c.id ? '' : c.id">{{ c.title }}<span class="ml-1 opacity-60">{{ c.pageCount }}</span></button>
          </div>

          <label v-if="visiblePages.length" class="flex w-fit cursor-pointer items-center gap-2 px-1 text-xs text-gray-500 dark:text-gray-400">
            <UCheckbox :model-value="allOnPageSelected" @update:model-value="toggleAllOnPage" />{{ t('pages.bulk.selectPage') }}
          </label>
          <p v-if="!visiblePages.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('pages.pages.noMatches') }}</p>

          <div
            v-for="p in pagedPages" :key="p.id"
            class="group flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 transition hover:ring-primary-400/60 hover:shadow-[0_14px_28px_-20px_rgba(37,99,235,0.5)] dark:bg-[#1f1f1f] dark:ring-white/10 dark:hover:ring-primary-400/50"
            :style="{ marginLeft: `${rowDepth(p) * 1.5}rem` }"
          >
            <UCheckbox class="flex-shrink-0" :model-value="selected.has(p.id)" :aria-label="t('pages.bulk.select')" @update:model-value="toggleSel(p.id)" />
            <span v-if="rowDepth(p)" class="-mr-1 flex-shrink-0 text-gray-300 dark:text-neutral-600"><Icon name="lucide:corner-down-right" class="h-4 w-4" /></span>
            <span class="icon-tile !h-9 !w-9 flex-shrink-0"><UIcon :name="p.path === '/' ? 'lucide:house' : childCount(p) ? 'lucide:folder-tree' : 'lucide:file-text'" class="h-4 w-4" /></span>
            <NuxtLink :to="`/${nsSlug}/pages/${siteId}/edit/${p.id}`" class="min-w-0 flex-1 no-underline" :title="t('pages.pages.openEditor')">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium text-gray-900 decoration-primary-400/70 underline-offset-4 transition group-hover:text-primary-600 group-hover:underline dark:text-white dark:group-hover:text-primary-300">{{ p.title }}</span>
                <span v-if="p.path === '/'" class="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{{ t('pages.pages.homeBadge') }}</span>
                <span v-else-if="childCount(p)" class="flex-shrink-0 text-[11px] text-gray-400">{{ t('pages.pages.children', { n: childCount(p) }) }}</span>
                <span class="hidden flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-600 opacity-0 transition group-hover:opacity-100 sm:inline-flex dark:text-primary-300"><Icon name="lucide:pencil" class="h-3 w-3" />{{ t('pages.pages.openEditor') }}</span>
              </div>
              <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ p.path }}</div>
              <div v-if="(p.categoryIds || []).length" class="mt-1 flex flex-wrap gap-1">
                <span v-for="cid in p.categoryIds.slice(0, 4)" :key="cid" class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-blue-500/15 dark:text-primary-300"><Icon name="lucide:tag" class="h-3 w-3" />{{ catTitle(cid) }}</span>
                <span v-if="p.categoryIds.length > 4" class="text-[11px] text-gray-400">+{{ p.categoryIds.length - 4 }}</span>
              </div>
            </NuxtLink>
            <button
              type="button"
              class="hidden flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-block"
              :class="p.status === 'PAGE_READY' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
              :title="t('pages.pages.toggleStatus')"
              @click="toggleReady(p)"
            >{{ p.status === 'PAGE_READY' ? t('pages.status.ready') : t('pages.status.draft') }}</button>
            <div class="flex flex-shrink-0 items-center gap-1">
              <NuxtLink :to="`/${nsSlug}/pages/${siteId}/edit/${p.id}`" class="at-btn !px-2.5" :aria-label="t('pages.pages.edit')" :title="t('pages.pages.edit')"><Icon name="lucide:pencil" class="h-4 w-4" /></NuxtLink>
              <button type="button" class="at-btn hidden !px-2.5 sm:inline-flex" :aria-label="t('pages.pages.quickEdit')" :title="t('pages.pages.quickEdit')" @click="openQuickEdit(p)"><Icon name="lucide:sliders-horizontal" class="h-4 w-4" /></button>
              <a v-if="isLive && p.status === 'PAGE_READY'" :href="pageUrl(p)" target="_blank" rel="noopener noreferrer" class="at-btn hidden !px-2.5 no-underline md:inline-flex" :aria-label="t('pages.pages.view')" :title="t('pages.pages.view')"><Icon name="lucide:external-link" class="h-4 w-4" /></a>
              <button v-if="p.path !== '/'" type="button" class="at-btn hidden !px-2.5 md:inline-flex" :aria-label="t('pages.pages.addChild')" :title="t('pages.pages.addChild')" @click="openCreatePage({ parentId: p.id })"><Icon name="lucide:corner-down-right" class="h-4 w-4" /></button>
              <button type="button" class="at-btn hidden !px-2.5 md:inline-flex" :aria-label="t('pages.pages.duplicate')" :title="t('pages.pages.duplicate')" @click="duplicatePage(p)"><Icon name="lucide:copy" class="h-4 w-4" /></button>
              <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :aria-label="t('common.delete')" :title="t('common.delete')" @click="deletePage(p)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
            </div>
          </div>

          <div v-if="visiblePages.length" class="at-tray-foot flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl px-4 py-3">
            <div class="text-xs text-gray-600 dark:text-gray-400">
              {{ t('common.showing') }}
              <span class="font-medium text-gray-900 dark:text-white">{{ (pageNo - 1) * pageSize + 1 }}</span>
              {{ t('common.to') }}
              <span class="font-medium text-gray-900 dark:text-white">{{ Math.min(pageNo * pageSize, visiblePages.length) }}</span>
              {{ t('common.of') }}
              <span class="font-medium text-gray-900 dark:text-white">{{ visiblePages.length }}</span>
              {{ t('pages.pages.pagesWord') }}
            </div>
            <PageNav v-model:page="pageNo" v-model:page-size="pageSize" :total="visiblePages.length" :size-options="[10, 25, 50]" />
          </div>
          </template>
        </div>
      </template>

      <!-- ═════════ CATEGORIES ═════════ -->
      <CategoriesPanel v-else-if="activeTab === 'categories'" :site="site" :ns-slug="nsSlug" :categories="categories" @changed="reloadCategories" @show-pages="showCategoryPages" />

      <GlobalBlocksPanel v-else-if="activeTab === 'blocks'" :site="site" :ns-slug="nsSlug" />

      <!-- ═════════ DESIGN ═════════ -->
      <ThemeDesigner v-else-if="activeTab === 'design'" :site="site" :ns-slug="nsSlug" :saving="designSaving" @save="saveDesign" />

      <!-- ═════════ DOMAINS ═════════ -->
      <DomainsPanel v-else-if="activeTab === 'domains'" :site="site" :ns-slug="nsSlug" @changed="reloadSite" />

      <!-- ═════════ PUBLISH ═════════ -->
      <template v-else-if="activeTab === 'publish'">
        <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.publish.liveTitle') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                <template v-if="site.publishedVersion">{{ t('pages.publish.liveVersion', { v: site.publishedVersion }) }} · <a :href="origin" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400">{{ site.host }}</a></template>
                <template v-else>{{ t('pages.publish.neverPublished') }}</template>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="at-btn" :disabled="checking" @click="runPreflight">
                <UIcon :name="checking ? 'lucide:loader-2' : 'lucide:list-checks'" class="h-4 w-4" :class="checking && 'animate-spin'" />{{ t('pages.publish.check') }}
              </button>
              <button type="button" class="at-btn at-btn--primary" :disabled="publishing || !pages.length" @click="publish">
                <UIcon :name="publishing ? 'lucide:loader-2' : 'lucide:rocket'" class="h-4 w-4" :class="publishing && 'animate-spin'" />{{ t('pages.publish.action') }}
              </button>
            </div>
          </div>
          <UInput v-model="publishNote" class="mt-3" :placeholder="t('pages.publish.notePlaceholder')" maxlength="120" />
          <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">{{ t('pages.publish.hint', { n: readyCount }) }}</p>
          <p v-if="origin.includes('localhost') || site.host.endsWith('.lota.tools')" class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('pages.publish.noindexHint') }}</p>
        </div>

        <div v-if="preflight" class="flex flex-col gap-2">
          <div v-if="preflight.ok && !warnIssues.length" class="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Icon name="lucide:circle-check" class="h-4 w-4" />{{ t('pages.publish.allGood') }}
          </div>
          <div v-for="(i, idx) in errorIssues" :key="`e${idx}`" class="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            <Icon name="lucide:circle-x" class="mt-0.5 h-4 w-4 flex-shrink-0" /><span><b v-if="i.pagePath">{{ i.pagePath }}: </b>{{ issueText(i) }}</span>
          </div>
          <div v-for="(i, idx) in warnIssues" :key="`w${idx}`" class="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon name="lucide:triangle-alert" class="mt-0.5 h-4 w-4 flex-shrink-0" /><span><b v-if="i.pagePath">{{ i.pagePath }}: </b>{{ issueText(i) }}</span>
          </div>
        </div>

        <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.publish.history') }}</div>
        <p v-if="!versions.length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('pages.publish.noVersions') }}</p>
        <div v-else class="flex flex-col gap-2">
          <div v-for="v in versions" :key="v.id" class="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
            <span class="icon-tile !h-9 !w-9 flex-shrink-0"><UIcon name="lucide:package" class="h-4 w-4" /></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                {{ v.version }}
                <span v-if="v.live" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{{ t('pages.publish.live') }}</span>
              </div>
              <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ fmt(v.createdAtUnix) }} · {{ t('pages.sites.pageCount', { n: v.pageCount }) }} · {{ fmtBytes(v.bytes) }}<template v-if="v.note"> · {{ v.note }}</template></div>
            </div>
            <button v-if="!v.live" type="button" class="at-btn" @click="rollback(v)"><Icon name="lucide:undo-2" class="h-4 w-4" />{{ t('pages.publish.rollback') }}</button>
          </div>
        </div>
        <LinkReportPanel :site-id="siteId" :ns-slug="nsSlug" :pages-count="pages.length" />
      </template>

      <!-- ═════════ REDIRECTS ═════════ -->

      <!-- ═════════ SETTINGS ═════════ -->
      <template v-else>
        <div class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <UFormGroup :label="t('pages.sites.name')" required><UInput v-model="settingsForm.name" /></UFormGroup>
          <UFormGroup :label="t('pages.settings.language')">
            <div class="at-seg !min-w-0 self-start">
              <button v-for="l in LANGS" :key="l.v" type="button" class="at-seg__btn" :class="settingsForm.defaultLang === l.v && 'at-seg__btn--on'" @click="settingsForm.defaultLang = l.v">{{ l.l }}</button>
            </div>
          </UFormGroup>
          <UFormGroup :label="t('pages.settings.gsv')" :help="t('pages.settings.gsvHint')"><UInput v-model="settingsForm.googleSiteVerification" placeholder="abc123…" /></UFormGroup>
          <UFormGroup :label="t('pages.settings.robots')" :help="t('pages.settings.robotsHint')">
            <UTextarea v-model="settingsForm.robotsTxt" :rows="4" placeholder="User-agent: *&#10;Allow: /" />
            <p v-if="site && site.host === site.platformHost" class="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{{ t('pages.settings.robotsPlatform') }}</p>
          </UFormGroup>
          <div class="flex justify-end">
            <button type="button" class="at-btn at-btn--primary" :disabled="settingsSaving" @click="saveSettings">
              <UIcon v-if="settingsSaving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
            </button>
          </div>
        </div>

        <BlogSettingsPanel :site="site" :saving="blogSaving" @save="saveBlog" />

        <div class="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ site.status === 'SITE_SUSPENDED' ? t('pages.settings.resume') : t('pages.settings.suspend') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.settings.suspendHint') }}</div>
            </div>
            <button type="button" class="at-btn at-btn--amber" @click="toggleSuspend">
              <Icon :name="site.status === 'SITE_SUSPENDED' ? 'lucide:play' : 'lucide:pause'" class="h-4 w-4" />{{ site.status === 'SITE_SUSPENDED' ? t('pages.settings.resume') : t('pages.settings.suspend') }}
            </button>
          </div>
          <div class="h-px bg-black/5 dark:bg-white/10" />
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.settings.deleteTitle') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.settings.deleteHint') }}</div>
            </div>
            <button type="button" class="at-btn hover:!bg-rose-50 hover:!text-rose-600" @click="removeSite"><Icon name="lucide:trash-2" class="h-4 w-4" />{{ t('common.delete') }}</button>
          </div>
        </div>
      <section class="flex flex-col gap-4">
        <div><h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('pages.tabs.redirects') }}</h3></div>
        <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <UInput v-model="redirectForm.from" placeholder="/old-page" @keyup.enter="addRedirect" />
            <UInput v-model="redirectForm.to" placeholder="/new-page" @keyup.enter="addRedirect" />
            <button type="button" class="at-btn at-btn--blue justify-center" :disabled="redirectSaving" @click="addRedirect"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('common.add') }}</button>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{{ t('pages.redirects.hint') }}</span>
            <button type="button" class="font-medium text-primary-600 dark:text-primary-400" @click="csvOpen = true">{{ t('pages.redirects.import') }}</button>
          </div>
        </div>
        <EmptyState v-if="!redirects.length" icon="lucide:arrow-right-left" :title="t('pages.redirects.empty')" :description="t('pages.redirects.emptyText')" />
        <div v-else class="flex flex-col gap-2">
          <div v-for="r in redirects" :key="r.id" class="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
            <div class="min-w-0 flex-1 text-sm">
              <span class="font-medium text-gray-900 dark:text-white">{{ r.fromPath }}</span>
              <Icon name="lucide:arrow-right" class="mx-1.5 inline h-3.5 w-3.5 text-gray-400" />
              <span class="break-all text-gray-600 dark:text-gray-300">{{ r.toPath }}</span>
            </div>
            <span class="hidden rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 sm:inline dark:bg-white/10 dark:text-gray-400">{{ t(`pages.redirects.source.${r.source}`) }}</span>
            <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :aria-label="t('common.delete')" @click="removeRedirect(r)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
          </div>
        </div>
      </section>
      </template>
    </template>

    <!-- create page -->
    <UModal v-model="pageModal" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ pageForm.home ? t('pages.pages.createHome') : t('pages.pages.new') }}</h3></template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('pages.pages.title')" required><UInput v-model="pageForm.title" autofocus @keyup.enter="createPage" /></UFormGroup>
          <div v-if="templates.length">
            <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.pages.template') }}</div>
            <div class="grid gap-2 sm:grid-cols-2">
              <button type="button" class="flex items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left ring-1 transition" :class="templateId === '' ? 'bg-blue-50 ring-blue-300 dark:bg-blue-500/10 dark:ring-blue-400/50' : 'bg-white ring-black/10 hover:ring-black/20 dark:bg-white/5 dark:ring-white/10'" @click="templateId = ''">
                <UIcon name="lucide:file" class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                <span><span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.pages.templateBlank') }}</span><span class="block text-xs text-gray-500 dark:text-gray-400">{{ t('pages.pages.templateBlankHint') }}</span></span>
              </button>
              <button v-for="tp in templates" :key="tp.id" type="button" class="flex items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left ring-1 transition" :class="templateId === tp.id ? 'bg-blue-50 ring-blue-300 dark:bg-blue-500/10 dark:ring-blue-400/50' : 'bg-white ring-black/10 hover:ring-black/20 dark:bg-white/5 dark:ring-white/10'" @click="templateId = tp.id">
                <UIcon :name="tp.icon" class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                <span><span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ tp.name }}</span><span class="block text-xs text-gray-500 dark:text-gray-400">{{ tp.description }}</span></span>
              </button>
            </div>
          </div>
          <template v-if="!pageForm.home">
            <UFormGroup :label="t('pages.pages.parent')">
              <PagePicker v-model="pageForm.parentId" :ns-slug="nsSlug" :site-id="siteId" />
            </UFormGroup>
            <UFormGroup :label="t('pages.pages.slug')" :error="pageError || undefined" :help="pageError ? undefined : t('pages.pages.slugHint')">
              <UInput v-model="pageForm.slug" @update:model-value="pageSlugTouched = true" @keyup.enter="createPage" />
            </UFormGroup>
            <div class="rounded-2xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <span class="break-all font-medium">{{ site?.host }}{{ parentPath }}/{{ pageForm.slug || '…' }}</span>
            </div>
          </template>
          <p v-else-if="pageError" class="text-xs text-red-600 dark:text-red-400">{{ pageError }}</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="pageModal = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="pageSaving" @click="createPage">
              <UIcon v-if="pageSaving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('pages.pages.createAndEdit') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- quick edit -->
    <UModal v-model="qeOpen" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ t('pages.pages.quickEdit') }}</h3></template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('pages.pages.title')" required><UInput v-model="qe.title" @keyup.enter="saveQuickEdit" /></UFormGroup>
          <template v-if="!qe.isHome">
            <UFormGroup :label="t('pages.pages.slug')" :error="qeError || undefined"><UInput v-model="qe.slug" @keyup.enter="saveQuickEdit" /></UFormGroup>
            <UFormGroup :label="t('pages.pages.parent')">
              <PagePicker :key="qe.id" v-model="qe.parentId" :ns-slug="nsSlug" :site-id="siteId" :exclude="descendantIds(qe.id)" />
            </UFormGroup>
            <UFormGroup :label="t('pages.pages.order')" :help="t('pages.pages.orderHint')"><UInput v-model="qe.sort" type="number" /></UFormGroup>
          </template>
          <p v-else-if="qeError" class="text-xs text-red-600 dark:text-red-400">{{ qeError }}</p>
          <UFormGroup v-if="categories.length" :label="t('pages.categories.title2')">
            <CategoryChips v-model="qe.cats" :categories="categories" />
          </UFormGroup>
          <div class="at-switch items-center justify-between">
            <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('pages.pages.inPublish') }}</span>
            <UToggle v-model="qe.ready" />
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="qeOpen = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="qeSaving" @click="saveQuickEdit">
              <UIcon v-if="qeSaving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- CSV import -->
    <UModal v-model="csvOpen" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ t('pages.redirects.import') }}</h3></template>
        <UFormGroup :help="t('pages.redirects.csvHint')">
          <UTextarea v-model="csvText" :rows="8" placeholder="/old,/new&#10;/promo,https://example.com/sale,302" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="csvOpen = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="csvBusy || !csvText.trim()" @click="importCsv">
              <UIcon v-if="csvBusy" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('pages.redirects.importAction') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
