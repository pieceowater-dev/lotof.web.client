<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <AdminHeader
      :title="t('admin.namespaces')"
      :description="t('admin.namespacesDesc')"
    />

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="relative flex-1 md:max-w-sm">
          <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="search"
            type="text"
            :placeholder="t('admin.searchNamespaces') || 'Поиск по названию или слагу'"
            class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ t('admin.totalNamespaces') }}: {{ total }}
        </div>
      </div>

      <div v-if="loading && !rows.length" class="flex justify-center py-16">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-slate-400" />
      </div>

      <div v-else-if="!rows.length" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {{ t('admin.noNamespacesFound') || 'Неймспейсы не найдены' }}
      </div>

      <div v-else class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1100px] text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.owner') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.apps') || 'Приложения' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.members') || 'Участники' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.source') || 'Источник' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.created') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in rows" :key="row.id">
                <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900 dark:text-white">{{ row.title }}</div>
                    <div class="text-[10px] text-slate-500 font-mono">{{ row.slug }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div v-if="row.ownerInfo" class="flex flex-col">
                      <span class="text-xs font-medium text-slate-900 dark:text-white">{{ row.ownerInfo.username }}</span>
                      <span class="text-[10px] text-slate-500">{{ row.ownerInfo.email }}</span>
                      <a
                        v-if="row.ownerInfo.phone"
                        :href="`tel:${row.ownerInfo.phone}`"
                        class="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
                      >{{ row.ownerInfo.phone }}</a>
                    </div>
                    <span v-else class="text-slate-400 text-xs">&mdash;</span>
                  </td>
                  <td class="px-6 py-4">
                    <div v-if="row.apps?.length" class="flex flex-wrap gap-1">
                      <span
                        v-for="app in row.apps"
                        :key="app.id"
                        class="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30"
                      >
                        {{ appLabel(app.appBundle) }}
                      </span>
                    </div>
                    <span v-else class="text-[10px] text-slate-400 italic">{{ t('admin.noApps') || 'Нет приложений' }}</span>
                  </td>
                  <td class="px-6 py-4">
                    <button
                      v-if="row.memberInfos?.length"
                      type="button"
                      class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      @click="toggleExpanded(row.id)"
                    >
                      <Icon name="lucide:users" class="h-3.5 w-3.5" />
                      {{ row.memberInfos.length }}
                      <Icon :name="expanded[row.id] ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-3.5 w-3.5" />
                    </button>
                    <span v-else class="text-[10px] text-slate-400 italic">0</span>
                  </td>
                  <td class="px-6 py-4">
                    <span v-if="row.leadSource" class="font-mono text-[10px] text-slate-600 dark:text-slate-400">{{ row.leadSource }}</span>
                    <span v-else class="text-slate-400 text-xs">&mdash;</span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ formatDate(row.createdAt) }}</td>
                </tr>
                <tr v-if="expanded[row.id] && row.memberInfos?.length" class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                  <td colspan="6" class="px-6 py-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                      {{ t('admin.members') || 'Участники' }}
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div
                        v-for="member in row.memberInfos"
                        :key="member.id"
                        class="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div class="text-xs font-medium text-slate-900 dark:text-white">{{ member.username }}</div>
                        <div class="text-[10px] text-slate-500">{{ member.email }}</div>
                        <a
                          v-if="member.phone"
                          :href="`tel:${member.phone}`"
                          class="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
                        >{{ member.phone }}</a>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="totalPages > 1" class="mt-4 flex justify-end">
        <UPagination
          v-model="page"
          :page-count="pageSize"
          :total="total"
          size="xs"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { hubGetAdminNamespacesPage, type AdminNamespaceRow } from '@/api/hub/admin';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { token } = useAuth();

const rows = ref<AdminNamespaceRow[]>([]);
const total = ref(0);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const expanded = ref<Record<string, boolean>>({});

const totalPages = computed(() => Math.ceil(total.value / pageSize));

function toggleExpanded(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

const APP_LABELS: Record<string, string> = {
  'pieceowater.atrace': 'A-Trace',
  'pieceowater.contacts': 'Contacts',
  'pieceowater.menu': 'Orders',
};
function appLabel(bundle: string): string {
  return APP_LABELS[bundle] || bundle;
}

async function loadPage() {
  if (!token.value) return;
  loading.value = true;
  try {
    const res = await hubGetAdminNamespacesPage(token.value, page.value, 'TWENTY', search.value.trim() || undefined);
    rows.value = res.rows;
    total.value = res.total;
  } catch (e) {
    console.error('[console/namespaces] Failed to load namespaces', e);
  } finally {
    loading.value = false;
  }
}

watch(page, loadPage);

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadPage();
  }, 350);
});

onMounted(async () => {
  if (!token.value) {
    const { fetchUser, initialized } = useAuth();
    if (!initialized.value) {
      await fetchUser();
    }
  }
  loadPage();
});
</script>
