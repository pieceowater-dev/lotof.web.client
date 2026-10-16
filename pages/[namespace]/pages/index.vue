<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
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

const booting = ref(true);
const sites = ref<PagesSite[]>([]);

async function load() {
  try {
    await getToken(nsSlug.value);
    sites.value = await pagesApi.sites(nsSlug.value);
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
const form = reactive({ name: '', slug: '' });
const slugTouched = ref(false);
const slugError = ref('');
const techDomain = computed(() => sites.value[0]?.host?.split('.').slice(1).join('.') || (import.meta.dev ? 'pages.localhost' : 'pages.lota.tools'));
// A short random suffix keeps auto-generated addresses unique ("kofeynya-x7k2"), so two businesses
// naming their site "Кофейня" don't fight over the same address. Fixed per dialog so it stays put while typing.
const slugSuffix = ref('');
const newSuffix = () => Math.random().toString(36).replace(/[^a-z0-9]/g, '').padEnd(4, '0').slice(0, 4);
watch(() => form.name, (n) => {
  if (slugTouched.value) return;
  const base = slugifyText(n, 40);
  form.slug = base ? `${base}-${slugSuffix.value}` : '';
});

function openCreate() {
  form.name = ''; form.slug = ''; slugTouched.value = false; slugError.value = '';
  slugSuffix.value = newSuffix();
  createOpen.value = true;
}

const slugValid = computed(() => /^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$/.test(form.slug) && !form.slug.includes('--'));

async function create() {
  slugError.value = '';
  if (!form.name.trim() || !slugValid.value) {
    slugError.value = t('pages.sites.slugInvalid');
    return;
  }
  creating.value = true;
  try {
    const site = await pagesApi.createSite(nsSlug.value, { name: form.name.trim(), slug: form.slug });
    createOpen.value = false;
    await navigateTo(`/${nsSlug.value}/pages/${site.id}`);
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('already taken')) slugError.value = t('pages.sites.slugTaken');
    else if (msg.includes('3-63')) slugError.value = t('pages.sites.slugInvalid');
    else toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
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
  <div class="at-scope ct-scope p-4 pb-safe-or-4 flex flex-col gap-4">
    <PageHeader :title="t('pages.title')" :subtitle="t('pages.subtitle')">
      <template #primary>
        <button type="button" class="at-btn at-btn--primary" @click="openCreate">
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span class="hidden min-[440px]:inline">{{ t('pages.sites.new') }}</span>
          <span class="sr-only min-[440px]:hidden">{{ t('pages.sites.new') }}</span>
        </button>
      </template>
    </PageHeader>

    <div v-if="booting" class="py-4"><AppSkeleton variant="panel" :rows="2" /></div>

    <EmptyState
      v-else-if="!sites.length"
      icon="lucide:panels-top-left"
      size="lg"
      :title="t('pages.sites.emptyTitle')"
      :description="t('pages.sites.emptyText')"
    >
      <button type="button" class="at-btn at-btn--primary mt-2" @click="openCreate">
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
          <UFormGroup :label="t('pages.sites.address')" :error="slugError || undefined" :help="slugError ? undefined : t('pages.sites.addressHint')">
            <UInput v-model="form.slug" @update:model-value="slugTouched = true" @keyup.enter="create" />
          </UFormGroup>
          <div class="rounded-2xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
            <span class="text-gray-400">{{ t('pages.sites.willBeAt') }}</span>
            <span class="ml-1 break-all font-medium">{{ siteOrigin(`${form.slug || 'my-site'}.${techDomain}`) }}</span>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="createOpen = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="creating" @click="create">
              <UIcon v-if="creating" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('pages.sites.create') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
