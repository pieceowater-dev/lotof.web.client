<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// Shareable menu link generator: city (via branch) + a source tag, reusing
// the storefront's existing ?b= / ?t= query handling so this needs no
// backend changes — the tag rides along all the way to order.sourceTag on
// checkout (see pages/to/[namespace]/menu/index.vue's submitOrder).
const branches = ref<MenuBranch[]>([]);
const loading = ref(false);
const linkGenBranchId = ref('');
const linkGenCity = ref('');
const linkGenSource = ref('');
const branchOptions = computed(() => [
  { label: t('menu.allBranches') || 'All branches', value: '' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);
const generatedLink = computed(() => {
  if (!process.client) return '';
  const params = new URLSearchParams();
  if (linkGenBranchId.value) params.set('b', linkGenBranchId.value);
  const tag = [linkGenCity.value.trim(), linkGenSource.value.trim()].filter(Boolean).join('/');
  if (tag) params.set('t', tag);
  const qs = params.toString();
  return `${window.location.origin}/to/${nsSlug.value}/menu${qs ? `?${qs}` : ''}`;
});
async function copyGeneratedLink() {
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    useToast().add({ title: t('menu.linkCopied') || 'Link copied', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/share] copyGeneratedLink failed', e);
  }
}
async function loadBranches() {
  loading.value = true;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) return;
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/settings/share] loadBranches failed', e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadBranches);
</script>

<template>
  <div class="max-w-xl">
    <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
      <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon name="lucide:link" class="h-3.5 w-3.5" />
        {{ t('menu.menuLinkGenerator') || 'Menu link' }}
      </div>
      <p class="text-xs text-gray-400">{{ t('menu.menuLinkGeneratorDesc') || 'Add a city and source tag to track where an order came from.' }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <USelectMenu v-model="linkGenBranchId" :loading="loading" :options="branchOptions" value-attribute="value" option-attribute="label" size="sm" :placeholder="t('menu.cityTag') || 'City'" />
        <UInput v-model="linkGenSource" size="sm" :placeholder="t('menu.sourceTagLabel') || 'Source'" />
        <UButton size="sm" color="gray" variant="soft" icon="lucide:copy" @click="copyGeneratedLink">
          {{ t('menu.copyLink') || 'Copy link' }}
        </UButton>
      </div>
      <div class="text-xs font-mono text-gray-500 dark:text-gray-400 truncate bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2.5 py-1.5">{{ generatedLink }}</div>
    </div>
  </div>
</template>
