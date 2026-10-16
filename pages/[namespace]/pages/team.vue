<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePagesAccess } from '@/composables/usePagesAccess';
import { usePageTitle } from '@/composables/usePageTitle';
import { useConfirm } from '@/composables/useConfirm';
import { pagesApi, type PagesSite, type PagesStaffMember } from '@/api/pages/ops';
import { memberDisplayName } from '@/utils/memberDisplayName';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import { FilterPaginationLengthEnum } from '@gql-hub';

// Who of the namespace's members works in Pages, and where. Owner only.
type Member = { userId: string; username: string; email: string; nickname?: string | null };
type Row = Member & { staff: PagesStaffMember | null };

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();
const { confirm } = useConfirm();
const { token: hubToken } = useAuth();
const { getToken } = usePagesAuth();
const { load: loadAccess, isOwner, loaded: accessLoaded } = usePagesAccess(() => nsSlug.value);
usePageTitle('pages');

const booting = ref(true);
const members = ref<Member[]>([]);
const staff = ref<PagesStaffMember[]>([]);
const sites = ref<PagesSite[]>([]);
const ownerId = ref('');

async function loadMembers() {
  if (!hubToken.value) return;
  const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
  const { hubMembersList } = await import('@/api/hub/members/list');
  const ns = await hubNamespaceBySlug(hubToken.value, nsSlug.value);
  if (!ns?.id) return;
  ownerId.value = ns.owner || '';
  const all: Member[] = [];
  let page = 1;
  let batch: Member[];
  do {
    batch = await hubMembersList(hubToken.value, ns.id, page, FilterPaginationLengthEnum.Fifty);
    all.push(...batch);
    page += 1;
  } while (batch.length >= 50);
  members.value = all;
}

async function load() {
  try {
    await getToken(nsSlug.value);
    await loadAccess();
    if (!isOwner.value) { await navigateTo(`/${nsSlug.value}/pages`); return; }
    const [st, si] = await Promise.all([pagesApi.staff(nsSlug.value), pagesApi.sites(nsSlug.value), loadMembers()]);
    staff.value = st; sites.value = si;
  } catch (e) {
    logError('[pages/team] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    booting.value = false;
  }
}
onMounted(load);

const rows = computed<Row[]>(() => {
  const byUser = new Map(staff.value.map(s => [s.userId, s]));
  // the owner always has full access and needs no row
  return members.value.filter(m => m.userId !== ownerId.value).map(m => ({ ...m, staff: byUser.get(m.userId) || null }));
});
const siteName = (id: string) => sites.value.find(s => s.id === id)?.name || id.slice(0, 8);
const roleLabel = (r: string) => t(`pages.team.role.${r}`);
const scopeText = (s: PagesStaffMember) => (s.allSites ? t('pages.team.allSites') : s.siteIds.map(siteName).join(', '));

// ── edit one member ──
const open = ref(false);
const saving = ref(false);
const editing = ref<Row | null>(null);
const form = reactive({ role: 'NONE' as 'NONE' | 'ADMIN' | 'EDITOR', allSites: true, siteIds: [] as string[] });

function openEdit(r: Row) {
  editing.value = r;
  Object.assign(form, r.staff ? { role: r.staff.role, allSites: r.staff.allSites, siteIds: [...r.staff.siteIds] } : { role: 'EDITOR', allSites: true, siteIds: [] });
  open.value = true;
}
const toggleSite = (id: string) => { const i = form.siteIds.indexOf(id); if (i >= 0) form.siteIds.splice(i, 1); else form.siteIds.push(id); };
const canSave = computed(() => form.role === 'NONE' ? !!editing.value?.staff : (form.allSites || form.siteIds.length > 0));

async function save() {
  const row = editing.value;
  if (!row) return;
  saving.value = true;
  try {
    if (form.role === 'NONE') {
      await pagesApi.removeStaff(nsSlug.value, row.userId);
    } else {
      await pagesApi.upsertStaff(nsSlug.value, { userId: row.userId, role: form.role, allSites: form.allSites, siteIds: form.allSites ? [] : form.siteIds });
    }
    staff.value = await pagesApi.staff(nsSlug.value);
    open.value = false;
    toast.add({ title: t('pages.team.saved'), color: 'green' });
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function revoke(r: Row) {
  if (!r.staff) return;
  const ok = await confirm({
    title: t('pages.team.revokeTitle', { name: memberDisplayName(r) || r.email }), message: t('pages.team.revokeText'),
    confirmLabel: t('pages.team.revoke'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.removeStaff(nsSlug.value, r.userId);
    staff.value = await pagesApi.staff(nsSlug.value);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  }
}

const ROLES = ['ADMIN', 'EDITOR', 'NONE'] as const;
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <PageHeader :title="t('pages.team.title')" :subtitle="t('pages.team.subtitle')" :back-to="`/${nsSlug}/pages?all=1`" :back-label="t('pages.title')" />

    <AppSkeleton v-if="booting || !accessLoaded" variant="list" :rows="5" />

    <template v-else>
      <div class="grid gap-2 sm:grid-cols-2">
        <div class="rounded-2xl bg-white p-3.5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ roleLabel('ADMIN') }}</div>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.team.adminDesc') }}</p>
        </div>
        <div class="rounded-2xl bg-white p-3.5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ roleLabel('EDITOR') }}</div>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.team.editorDesc') }}</p>
        </div>
      </div>

      <p v-if="!rows.length" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.team.empty') }}</p>
      <div v-else class="flex flex-col gap-2">
        <div v-for="r in rows" :key="r.userId" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <UserAvatar :name="memberDisplayName(r) || r.email" :seed="r.email" size="sm" />
          <button type="button" class="min-w-0 flex-1 text-left" @click="openEdit(r)">
            <div class="truncate font-semibold text-gray-900 dark:text-white">{{ memberDisplayName(r) || r.email }}</div>
            <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ r.email }}</div>
          </button>
          <div v-if="r.staff" class="flex min-w-0 flex-wrap items-center gap-1.5">
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="r.staff.role === 'ADMIN' ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'">{{ roleLabel(r.staff.role) }}</span>
            <span class="max-w-[16rem] truncate text-xs text-gray-500 dark:text-gray-400">{{ scopeText(r.staff) }}</span>
          </div>
          <span v-else class="text-xs text-gray-400">{{ t('pages.team.noAccess') }}</span>
          <div class="flex flex-shrink-0 items-center gap-1.5">
            <button type="button" class="at-btn !px-2.5" :title="t('common.edit')" :aria-label="t('common.edit')" @click="openEdit(r)"><Icon name="lucide:pencil" class="h-4 w-4" /></button>
            <button v-if="r.staff" type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :title="t('pages.team.revoke')" :aria-label="t('pages.team.revoke')" @click="revoke(r)"><Icon name="lucide:user-x" class="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </template>

    <UModal v-model="open" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header>
          <div>
            <h3 class="text-base font-semibold">{{ t('pages.team.editTitle') }}</h3>
            <p v-if="editing" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ memberDisplayName(editing) }} · {{ editing.email }}</p>
          </div>
        </template>
        <div class="space-y-4">
          <div>
            <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.team.roleLabel') }}</div>
            <div class="at-seg !flex w-full">
              <button v-for="r in ROLES" :key="r" type="button" class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs" :class="form.role === r && 'at-seg__btn--on'" @click="form.role = r">{{ r === 'NONE' ? t('pages.team.noAccess') : roleLabel(r) }}</button>
            </div>
            <p v-if="form.role !== 'NONE'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ form.role === 'ADMIN' ? t('pages.team.adminDesc') : t('pages.team.editorDesc') }}</p>
          </div>

          <div v-if="form.role !== 'NONE'">
            <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.team.sitesLabel') }}</div>
            <div class="at-seg !flex w-full">
              <button type="button" class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs" :class="form.allSites && 'at-seg__btn--on'" @click="form.allSites = true">{{ t('pages.team.allSites') }}</button>
              <button type="button" class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs" :class="!form.allSites && 'at-seg__btn--on'" @click="form.allSites = false">{{ t('pages.team.chosenSites') }}</button>
            </div>
            <div v-if="!form.allSites" class="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
              <button v-for="s in sites" :key="s.id" type="button" class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-white/5" @click="toggleSite(s.id)">
                <UIcon :name="form.siteIds.includes(s.id) ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" :class="form.siteIds.includes(s.id) ? 'text-primary-600' : 'text-gray-300 dark:text-gray-600'" />
                <span class="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{{ s.name }}</span>
                <span class="truncate text-[11px] text-gray-400">{{ s.host }}</span>
              </button>
              <p v-if="!sites.length" class="py-3 text-center text-xs text-gray-500">{{ t('pages.sites.emptyTitle') }}</p>
            </div>
            <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.team.allSitesHint') }}</p>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="open = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="saving || !canSave" @click="save">
              <UIcon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
