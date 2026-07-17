<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuShareLink } from '@/api/menu/sharelink/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// Shareable menu link generator: city (via branch) + a source tag, reusing
// the storefront's existing ?b= / ?t= query handling so order.sourceTag can
// track where an order came from (see pages/to/[namespace]/menu/index.vue's
// submitOrder). Generated links are saved server-side so a tenant can build
// a small library of tracking links (Instagram bio, Google profile, ...)
// instead of re-typing the same city/source combo from memory every time.
const branches = ref<MenuBranch[]>([]);
const savedLinks = ref<MenuShareLink[]>([]);
const loading = ref(false);
const saving = ref(false);

const linkGenBranchId = ref('');
const linkGenLabel = ref('');
const linkGenSource = ref('');

const branchOptions = computed(() => [
  { label: t('menu.allBranches') || 'All branches', value: '' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

function buildLink(branchId: string, sourceTag: string): string {
  if (!process.client) return '';
  const params = new URLSearchParams();
  if (branchId) {
    // Prefer the branch's short slug ("almaty") over its raw UUID — the
    // storefront accepts either, but the slug is what makes the link worth
    // sharing in the first place.
    const branch = branches.value.find((b) => b.id === branchId);
    params.set('b', branch?.slug || branchId);
  }
  if (sourceTag) params.set('t', sourceTag);
  const qs = params.toString();
  return `${window.location.origin}/to/${nsSlug.value}/menu${qs ? `?${qs}` : ''}`;
}

const generatedLink = computed(() => buildLink(linkGenBranchId.value, linkGenSource.value));

function branchName(id?: string | null): string {
  if (!id) return t('menu.allBranches') || 'All branches';
  return branches.value.find((b) => b.id === id)?.name || id;
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    useToast().add({ title: t('menu.linkCopied') || 'Link copied', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/share] copyLink failed', e);
  }
}

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/settings/share] loadBranches failed', e);
  }
}

async function loadSavedLinks() {
  loading.value = true;
  try {
    const menuToken = await getToken();
    const { menuShareLinksList } = await import('@/api/menu/sharelink/list');
    savedLinks.value = await menuShareLinksList(menuToken, nsSlug.value);
  } catch (e) {
    logError('[menu/settings/share] loadSavedLinks failed', e);
  } finally {
    loading.value = false;
  }
}

const isFormValid = computed(() => linkGenLabel.value.trim().length > 0);

async function saveLink() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateShareLink } = await import('@/api/menu/sharelink/create');
    const created = await menuCreateShareLink(menuToken, nsSlug.value, {
      branchId: linkGenBranchId.value || undefined,
      label: linkGenLabel.value.trim(),
      sourceTag: linkGenSource.value.trim(),
    });
    savedLinks.value = [created, ...savedLinks.value];
    linkGenLabel.value = '';
    linkGenSource.value = '';
    linkGenBranchId.value = '';
    useToast().add({ title: t('menu.linkSaved') || 'Link saved', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/share] saveLink failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save link', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function removeLink(link: MenuShareLink) {
  if (process.client && !window.confirm(t('menu.confirmDeleteShareLink') || 'Delete this link?')) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteShareLink } = await import('@/api/menu/sharelink/delete');
    await menuDeleteShareLink(menuToken, nsSlug.value, link.id);
    savedLinks.value = savedLinks.value.filter((l) => l.id !== link.id);
  } catch (e) {
    logError('[menu/settings/share] removeLink failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete link', color: 'red' });
  }
}

onMounted(() => {
  loadBranches();
  loadSavedLinks();
});
</script>

<template>
  <div class="max-w-2xl space-y-4">
    <!-- Generator -->
    <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
      <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon name="lucide:link" class="h-3.5 w-3.5" />
        {{ t('menu.menuLinkGenerator') || 'New menu link' }}
      </div>
      <p class="text-xs text-gray-400">{{ t('menu.menuLinkGeneratorDesc') || 'Add a city and source tag to track where an order came from — save it to reuse later.' }}</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UFormGroup :label="t('menu.linkLabel') || 'Label'" required>
          <UInput v-model="linkGenLabel" size="lg" :placeholder="t('menu.linkLabelPlaceholder') || 'e.g. Instagram bio'" />
        </UFormGroup>
        <UFormGroup :label="t('menu.cityTag') || 'City / branch'">
          <USelectMenu v-model="linkGenBranchId" :options="branchOptions" value-attribute="value" option-attribute="label" size="lg" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>
      </div>
      <UFormGroup :label="t('menu.sourceTagLabel') || 'Source tag'">
        <UInput v-model="linkGenSource" size="lg" placeholder="instagram" />
      </UFormGroup>

      <!-- Preview only — deliberately not copyable here. A link that gets
           shared before it's saved can never show up in the list below or
           be tied to a source tag report, so the only way to get a usable
           link is to save it first. -->
      <div class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2">
        <Icon name="lucide:eye" class="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <span class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ generatedLink }}</span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <p class="text-xs text-gray-400">{{ t('menu.saveLinkToUseHint') || 'Save it to get a copyable link' }}</p>
        <UButton color="primary" icon="lucide:bookmark-plus" :loading="saving" :disabled="!isFormValid || saving" @click="saveLink">
          {{ t('menu.saveLink') || 'Save link' }}
        </UButton>
      </div>
    </div>

    <!-- Saved links -->
    <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 px-5 pt-5 pb-2">
        <Icon name="lucide:list" class="h-3.5 w-3.5" />
        {{ t('menu.savedLinks') || 'Saved links' }}
      </div>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
      </div>
      <div v-else-if="!savedLinks.length" class="text-sm text-gray-400 px-5 pb-5">
        {{ t('menu.noSavedLinks') || 'No saved links yet — generate one above.' }}
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="link in savedLinks" :key="link.id" class="flex items-center gap-3 px-5 py-3">
          <div class="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center flex-shrink-0">
            <Icon name="lucide:link" class="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ link.label }}</div>
            <div class="text-xs text-gray-400 truncate">
              {{ branchName(link.branchId) }}<template v-if="link.sourceTag"> · {{ link.sourceTag }}</template>
            </div>
          </div>
          <UButton size="2xs" color="gray" variant="soft" icon="lucide:copy" @click="copyLink(buildLink(link.branchId || '', link.sourceTag))" />
          <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" @click="removeLink(link)" />
        </div>
      </div>
    </div>
  </div>
</template>
