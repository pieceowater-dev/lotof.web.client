<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePagesAccess } from '@/composables/usePagesAccess';
import { usePageTitle } from '@/composables/usePageTitle';
import { pagesApi, type PagesSite } from '@/api/pages/ops';
import { siteOrigin, slugifyText } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

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
  } catch (e) {
    logError('[pages] load sites', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    booting.value = false;
  }
}
onMounted(load);

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

function statusMeta(s: PagesSite) {
  if (s.status === 'SITE_SUSPENDED') return { label: t('pages.sites.suspended'), cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' };
  if (s.status === 'SITE_PUBLISHED') return { label: t('pages.sites.published'), cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
  return { label: t('pages.sites.draft'), cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' };
}
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <PageHeader :title="t('pages.title')" :subtitle="t('pages.subtitle')">
      <template #primary>
        <button v-if="isOwner" type="button" class="at-btn at-btn--primary" @click="openCreate">
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span class="hidden min-[440px]:inline">{{ t('pages.sites.new') }}</span>
          <span class="sr-only min-[440px]:hidden">{{ t('pages.sites.new') }}</span>
        </button>
      </template>
      <template #actions>
        <NuxtLink v-if="isOwner" :to="`/${nsSlug}/pages/team`" class="at-btn !px-2.5 no-underline" :title="t('pages.team.title')" :aria-label="t('pages.team.title')">
          <Icon name="lucide:users" class="h-4 w-4" />
        </NuxtLink>
      </template>
    </PageHeader>

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

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="s in sites"
        :key="s.id"
        :to="`/${nsSlug}/pages/${s.id}`"
        class="at-post !cursor-pointer gap-3 no-underline"
      >
        <div class="flex items-start gap-3">
          <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:globe" class="h-5 w-5" /></span>
          <div class="min-w-0 flex-1">
            <div class="truncate font-semibold text-gray-900 dark:text-white">{{ s.name }}</div>
            <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ s.host }}</div>
          </div>
          <span class="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusMeta(s).cls">{{ statusMeta(s).label }}</span>
        </div>
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ t('pages.sites.pageCount', { n: s.pageCount }) }}</span>
          <span v-if="s.publishedVersion">{{ t('pages.sites.version') }} {{ s.publishedVersion }}</span>
          <span v-else>{{ t('pages.sites.notPublished') }}</span>
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
