<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import IntegrationsPanel from '@/components/pages/IntegrationsPanel.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { useOnboarding } from '@/composables/useOnboarding';
import { pagesTour } from '@/config/tours';
import { usePagesAccess } from '@/composables/usePagesAccess';
import { usePageTitle } from '@/composables/usePageTitle';
import { pagesApi, type PagesSite } from '@/api/pages/ops';
import { siteAssetUrl, siteOrigin, slugifyText } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const aiOpen = ref(false);
const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();
const { getToken } = usePagesAuth();
usePageTitle('pages');

const { load: loadAccess, isOwner } = usePagesAccess(() => nsSlug.value);
const booting = ref(true);
const sites = ref<PagesSite[]>([]);

async function load() {
  try {
    await getToken(nsSlug.value);
    await Promise.all([loadAccess(), pagesApi.sites(nsSlug.value).then((r) => { sites.value = r; })]);
    // one site: go straight to it; the back arrow on its page returns here with ?all=1
    if (sites.value.length === 1 && !route.query.all && route.query.tour !== '1') {
      await navigateTo(`/${nsSlug.value}/pages/${sites.value[0].id}`, { replace: true });
      return;
    }
  } catch (e) {
    logError('[pages] load sites', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    booting.value = false;
  }
}
onMounted(async () => {
  await load();
  maybeStartTour();
});

// Offer the intro once, to an owner who has not seen it, and whenever it is requested with ?tour=1.
function maybeStartTour() {
  if (!isOwner.value || !sites.value.length || booting.value) return;
  const { isCompleted, startTour } = useOnboarding();
  const asked = route.query.tour === '1';
  if (isCompleted(pagesTour.id) && !asked) return;
  setTimeout(() => startTour(pagesTour), asked ? 700 : 1500);
  if (asked) navigateTo({ query: { all: '1' } }, { replace: true });
}

// ── create ──
const createOpen = ref(false);
const creating = ref(false);
const form = reactive({ name: '' });
const techDomain = computed(() => sites.value[0]?.host?.split('.').slice(1).join('.') || (import.meta.dev ? 'pages.localhost' : 'pages.lota.tools'));

// The address is generated, never typed: transliterated name plus a short random code, so two businesses
// naming their site "Кофейня" do not collide. The code is fixed per dialog so the preview does not flicker.
const slugSuffix = ref('');
const newSuffix = () => Math.random().toString(36).replace(/[^a-z0-9]/g, '').padEnd(4, '0').slice(0, 4);
const slug = computed(() => `${slugifyText(form.name, 40) || 'site'}-${slugSuffix.value}`);
const previewUrl = computed(() => siteOrigin(`${slug.value}.${techDomain.value}`));

function openCreate() {
  form.name = '';
  slugSuffix.value = newSuffix();
  createOpen.value = true;
}

async function create() {
  if (!form.name.trim()) return;
  creating.value = true;
  try {
    // A taken address is a (rare) collision of the random code: draw a new one and retry silently.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const site = await pagesApi.createSite(nsSlug.value, { name: form.name.trim(), slug: slug.value });
        createOpen.value = false;
        await navigateTo(`/${nsSlug.value}/pages/${site.id}`);
        return;
      } catch (e: any) {
        const msg = String(e?.response?.errors?.[0]?.message || '');
        if (!msg.includes('already taken') || attempt === 3) throw e;
        slugSuffix.value = newSuffix();
      }
    }
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    creating.value = false;
  }
}

// Card banner colour: the site's own accent from its theme, the brand gradient otherwise.
function accent(s: PagesSite): string {
  try {
    const v = JSON.parse(s.settings.themeVarsJson || '{}');
    const c = v.accent || v.primary || v.brand;
    if (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) return c;
  } catch { /* default */ }
  return '';
}

function statusMeta(s: PagesSite) {
  if (s.status === 'SITE_SUSPENDED') return { label: t('pages.sites.suspended'), cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' };
  if (s.status === 'SITE_PUBLISHED') return { label: t('pages.sites.published'), cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
  return { label: t('pages.sites.draft'), cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' };
}
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <PageHeader data-tour="pages-title" :title="t('pages.title')" :subtitle="t('pages.subtitle')">
      <template #primary>
        <button v-if="isOwner" type="button" data-tour="pages-new" class="at-btn at-btn--primary" @click="openCreate">
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span class="hidden min-[440px]:inline">{{ t('pages.sites.new') }}</span>
          <span class="sr-only min-[440px]:hidden">{{ t('pages.sites.new') }}</span>
        </button>
      </template>
      <template #actions>
        <NuxtLink v-if="isOwner" :to="`/${nsSlug}/pages/team`" data-tour="pages-team" class="at-btn !px-2.5 no-underline" :title="t('pages.team.title')" :aria-label="t('pages.team.title')">
          <Icon name="lucide:users" class="h-4 w-4" />
        </NuxtLink>
        <NuxtLink v-if="isOwner" :to="`/${nsSlug}/pages/plan`" data-tour="pages-plan" class="at-btn !px-2.5 no-underline" :title="t('pages.plan.title')" :aria-label="t('pages.plan.title')">
          <Icon name="lucide:gauge" class="h-4 w-4" />
        </NuxtLink>
      </template>
    </PageHeader>

    <section v-if="!booting && isOwner" data-tour="pages-ai" class="rounded-3xl bg-white ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
      <button type="button" class="flex w-full items-center gap-3 rounded-3xl px-4 py-3.5 text-left sm:px-5" :aria-expanded="aiOpen" @click="aiOpen = !aiOpen">
        <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:sparkles" class="h-5 w-5" /></span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.tabs.integrations') }}</span>
          <span class="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{{ t('pages.integrations.teaser') }}</span>
        </span>
        <UIcon name="lucide:chevron-down" class="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform" :class="aiOpen && 'rotate-180'" />
      </button>
      <div v-if="aiOpen" class="border-t border-black/5 px-4 pb-4 pt-4 sm:px-5 dark:border-white/10">
        <IntegrationsPanel :sites="sites" :ns-slug="nsSlug" />
      </div>
    </section>

    <AppSkeleton v-if="booting" variant="cards" :rows="3" />

    <EmptyState
      v-else-if="!sites.length"
      icon="lucide:panels-top-left"
      size="lg"
      :title="t('pages.sites.emptyTitle')"
      :description="t('pages.sites.emptyText')"
    >
      <button v-if="isOwner" type="button" class="at-btn at-btn--primary mt-2" @click="openCreate">
        <Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.sites.new') }}
      </button>
    </EmptyState>

    <div v-else data-tour="pages-cards" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="s in sites"
        :key="s.id"
        :to="`/${nsSlug}/pages/${s.id}`"
        class="group flex flex-col overflow-hidden rounded-3xl bg-white no-underline ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#1f1f1f] dark:ring-white/10"
      >
        <div class="relative h-20" :style="accent(s) ? { background: `linear-gradient(135deg, ${accent(s)}, ${accent(s)}99)` } : { background: 'linear-gradient(135deg,#2563eb,#10b981)' }">
          <span class="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-sm"><i class="inline-block h-2 w-2 rounded-full" :class="s.status === 'SITE_PUBLISHED' ? 'bg-emerald-500' : s.status === 'SITE_SUSPENDED' ? 'bg-rose-500' : 'bg-amber-500'" />{{ statusMeta(s).label }}</span>
        </div>
        <div class="-mt-7 flex flex-col gap-3 px-4 pb-4">
          <span class="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow ring-1 ring-black/5 dark:bg-[#2a2a2a] dark:ring-white/10">
            <img v-if="s.settings.logoUrl" :src="siteAssetUrl(s.host, s.settings.logoUrl)" alt="" class="h-full w-full object-contain">
            <UIcon v-else name="lucide:globe" class="h-6 w-6 text-gray-500" />
          </span>
          <div class="min-w-0">
            <div class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ s.name }}</div>
            <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ s.host }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span class="inline-flex items-center gap-1"><UIcon name="lucide:file-text" class="h-3.5 w-3.5" />{{ t('pages.sites.pageCount', { n: s.pageCount }) }}</span>
            <span v-if="s.publishedVersion" class="inline-flex items-center gap-1"><UIcon name="lucide:rocket" class="h-3.5 w-3.5" />{{ t('pages.sites.version') }} {{ s.publishedVersion }}</span>
            <span v-else class="inline-flex items-center gap-1"><UIcon name="lucide:pencil-line" class="h-3.5 w-3.5" />{{ t('pages.sites.notPublished') }}</span>
            <span class="inline-flex items-center gap-1"><UIcon name="lucide:languages" class="h-3.5 w-3.5" />{{ (s.settings.langs?.length ? s.settings.langs : [s.settings.defaultLang]).join(' · ') }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <UModal v-model="createOpen" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header>
          <h3 class="text-base font-semibold">{{ t('pages.sites.createTitle') }}</h3>
        </template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('pages.sites.name')" required>
            <UInput v-model="form.name" autofocus :placeholder="t('pages.sites.namePlaceholder')" @keyup.enter="create" />
          </UFormGroup>
          <div class="rounded-2xl bg-gray-50 px-3.5 py-3 dark:bg-white/5">
            <div class="text-xs text-gray-400">{{ t('pages.sites.willBeAt') }}</div>
            <div class="mt-0.5 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
              <UIcon name="lucide:globe" class="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span class="break-all">{{ form.name.trim() ? previewUrl : '…' }}</span>
            </div>
          </div>
          <div class="flex items-start gap-2.5 rounded-2xl bg-primary-50/70 px-3.5 py-3 text-sm text-gray-700 dark:bg-primary-500/10 dark:text-gray-200">
            <UIcon name="lucide:badge-check" class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
            <span>{{ t('pages.sites.domainNote') }}</span>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="createOpen = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="creating || !form.name.trim()" @click="create">
              <UIcon v-if="creating" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('pages.sites.create') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
