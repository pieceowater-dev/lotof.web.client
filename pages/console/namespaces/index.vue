<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <AdminHeader
      :title="t('admin.namespaces')"
      :description="t('admin.namespacesDesc')"
    />

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="favoriteRows.length" class="mb-6">
        <div class="mb-2 flex items-center gap-2">
          <Icon name="lucide:star" class="h-4 w-4 fill-current text-amber-400" />
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">
            {{ t('admin.favoriteNamespaces') || 'Избранные неймспейсы' }}
          </h2>
          <span class="text-xs text-slate-400">{{ favoriteRows.length }}</span>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="row in favoriteRows"
            :key="row.id"
            class="relative rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800/40 dark:bg-amber-900/10"
          >
            <button
              type="button"
              :title="t('admin.removeFromFavorites') || 'Убрать из избранного'"
              class="absolute right-2 top-2 text-amber-400 transition-colors hover:text-amber-500"
              @click="toggleFavorite(row.id)"
            >
              <Icon name="lucide:star" class="h-4 w-4 fill-current" />
            </button>
            <button type="button" class="block w-full pr-6 text-left" @click="focusNamespace(row)">
              <div class="truncate font-semibold text-slate-900 dark:text-white">{{ row.title }}</div>
              <div class="truncate font-mono text-[10px] text-slate-500">{{ row.slug }}</div>
              <div v-if="row.apps?.length" class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="app in row.apps"
                  :key="app.id"
                  class="inline-flex items-center rounded-md border border-blue-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800/30 dark:bg-slate-900 dark:text-blue-400"
                >{{ appLabel(app.appBundle) }}</span>
              </div>
              <div v-if="row.ownerInfo" class="mt-1.5 truncate text-[10px] text-slate-500">
                {{ row.ownerInfo.username }} · {{ row.ownerInfo.email }}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="relative flex-1 md:max-w-sm">
          <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="search"
            type="text"
            :placeholder="t('admin.searchNamespaces') || 'Название, слаг, имя, почта, телефон'"
            class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span v-if="searchActive">{{ t('admin.found') || 'Найдено' }}: {{ displayTotal }}</span>
          <span v-else>{{ t('admin.totalNamespaces') }}: {{ total }}</span>
          <span class="inline-flex items-center gap-1">
            <Icon name="lucide:building" class="h-3.5 w-3.5 text-sky-500" />
            {{ t('admin.companyNamespaces') }}: {{ statsLoading ? '…' : companyCount }}
          </span>
          <span class="inline-flex items-center gap-1">
            <Icon name="lucide:user" class="h-3.5 w-3.5 text-rose-500" />
            {{ t('admin.employeeNamespaces') }}: {{ statsLoading ? '…' : employeeCount }}
          </span>
        </div>
      </div>

      <div v-if="showSpinner" class="flex justify-center py-16">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-slate-400" />
      </div>

      <div v-else-if="!displayRows.length" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {{ t('admin.noNamespacesFound') || 'Неймспейсы не найдены' }}
      </div>

      <div v-else class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1390px] text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="w-10 px-4 py-3"><span class="sr-only">{{ t('admin.favorite') || 'Избранное' }}</span></th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.owner') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.apps') || 'Приложения' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.health') || 'Здоровье' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.members') || 'Участники' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.source') || 'Источник' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.lastActive') || 'Активность' }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.created') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in displayRows" :key="row.id">
                <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td class="px-4 py-4">
                    <button
                      type="button"
                      :title="isFavorite(row.id) ? (t('admin.removeFromFavorites') || 'Убрать из избранного') : (t('admin.addToFavorites') || 'В избранное')"
                      :aria-pressed="isFavorite(row.id)"
                      class="transition-colors"
                      :class="isFavorite(row.id) ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'"
                      @click="toggleFavorite(row.id)"
                    >
                      <Icon name="lucide:star" class="h-4 w-4" :class="isFavorite(row.id) ? 'fill-current' : ''" />
                    </button>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-900 dark:text-white">{{ row.title }}</div>
                    <div class="text-[10px] text-slate-500 font-mono">{{ row.slug }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div v-if="row.ownerInfo" class="flex flex-col">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-medium text-slate-900 dark:text-white">{{ row.ownerInfo.username }}</span>
                        <span
                          v-if="isEmployeeNamespace(row)"
                          :title="employerHint(row)"
                          class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
                        >
                          <Icon name="lucide:user" class="h-2.5 w-2.5" />
                          {{ t('admin.employeeBadge') }}
                        </span>
                      </div>
                      <span class="text-[10px] text-slate-500">{{ row.ownerInfo.email }}</span>
                      <span v-if="employerLabel(row)" class="text-[10px] text-rose-600 dark:text-rose-400">{{ t('admin.employeeOf') }} {{ employerLabel(row) }}</span>
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
                      v-if="row.apps?.length"
                      type="button"
                      :disabled="healthLoading[row.id]"
                      class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      @click="toggleHealth(row)"
                    >
                      <Icon v-if="healthLoading[row.id]" name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                      <Icon v-else name="lucide:activity" class="h-3.5 w-3.5" />
                      <span v-if="healthData[row.id]" :class="healthSummaryClass(row.id)">{{ healthSummaryLabel(row.id) }}</span>
                      <span v-else>{{ t('admin.checkHealth') || 'Проверить' }}</span>
                      <Icon :name="healthExpanded[row.id] ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-3.5 w-3.5" />
                    </button>
                    <span v-else class="text-[10px] text-slate-400 italic">&mdash;</span>
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
                  <td class="px-6 py-4">
                    <span
                      class="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
                      :title="row.lastActiveAt || ''"
                    >
                      <span class="h-1.5 w-1.5 rounded-full" :class="lastActiveDotClass(row.lastActiveAt, loadedAt)" />
                      {{ relativeLastActive(row.lastActiveAt, loadedAt) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 dark:text-slate-400">{{ formatDate(row.createdAt) }}</td>
                </tr>
                <tr v-if="healthExpanded[row.id]" class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                  <td colspan="9" class="px-6 py-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                      {{ t('admin.health') || 'Здоровье' }}
                    </div>
                    <div v-if="healthLoading[row.id] && !healthData[row.id]" class="text-xs text-slate-400">
                      {{ t('admin.checkingHealth') || 'Проверка…' }}
                    </div>
                    <div v-else-if="healthData[row.id]" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div
                        v-for="app in healthData[row.id]"
                        :key="app.appBundle"
                        class="rounded-lg border px-3 py-2 dark:bg-slate-950"
                        :class="healthCardClass(app)"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-xs font-medium text-slate-900 dark:text-white">{{ appLabel(app.appBundle) }}</span>
                          <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" :class="healthPillClass(app)">
                            {{ healthPillLabel(app) }}
                          </span>
                        </div>
                        <div v-if="!app.reachable || !app.schemaReady" class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <div v-if="app.appliedVersion || app.targetVersion">
                            {{ t('admin.appliedVersion') || 'Применена' }}: {{ app.appliedVersion || '—' }} / {{ t('admin.targetVersion') || 'Целевая' }}: {{ app.targetVersion || '—' }}
                          </div>
                          <div v-if="app.error" class="mt-0.5 text-rose-600 dark:text-rose-400">{{ app.error }}</div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="expanded[row.id] && row.memberInfos?.length" class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                  <td colspan="9" class="px-6 py-4">
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
          :total="displayTotal"
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
import { useFavoriteNamespaces } from '@/composables/useFavoriteNamespaces';
import {
  hubGetAdminNamespaces,
  hubGetAdminNamespacesPage,
  hubGetAdminNamespaceHealth,
  type AdminNamespaceRow,
  type AppHealthStatus,
} from '@/api/hub/admin';
import { relativeLastActive, lastActiveDotClass } from '@/utils/lastActive';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
useHead({ title: `Консоль — ${t('admin.namespaces') || 'Неймспейсы'}` });
const { token } = useAuth();
const { favoriteIds, isFavorite, toggle: toggleFavorite } = useFavoriteNamespaces();

const rows = ref<AdminNamespaceRow[]>([]);
const total = ref(0);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const expanded = ref<Record<string, boolean>>({});
const healthExpanded = ref<Record<string, boolean>>({});
const healthLoading = ref<Record<string, boolean>>({});
const healthData = ref<Record<string, AppHealthStatus[]>>({});
// Full platform-wide list (loaded once by loadStats). Feeds the
// company/employee counts, the pinned "favorites" section, and the
// name/email/phone search -- all of which need every namespace regardless
// of which page of `rows` the server returned.
const allRows = ref<AdminNamespaceRow[]>([]);
const statsLoading = ref(true);
const companyCount = ref(0);
const employeeCount = ref(0);
// "Now" snapshot for the relative activity column, refreshed each load so
// every row's "N ч назад" is measured against the same instant.
const loadedAt = ref(Date.now());

const favoriteRows = computed(() => {
  const set = new Set(favoriteIds.value);
  return allRows.value
    .filter((r) => set.has(r.id))
    .sort((a, b) => a.title.localeCompare(b.title));
});

// Search: an empty box keeps the fast server-paginated `rows`; as soon as
// something is typed we switch to filtering the full in-memory `allRows`
// (already fetched for the stats/favorites) so the query can also reach
// the owner's and members' name / email / phone -- e.g. typing "Серик"
// finds the namespace whose owner is Серик, which the server-side
// title/slug-only search never would. Space-separated terms are ANDed, so
// "серик gmail" narrows further.
const searchActive = computed(() => search.value.trim().length > 0);

function namespaceHaystack(r: AdminNamespaceRow): string {
  const parts: Array<string | null | undefined> = [
    r.title,
    r.slug,
    r.ownerInfo?.username,
    r.ownerInfo?.email,
    r.ownerInfo?.phone,
  ];
  for (const m of r.memberInfos || []) {
    parts.push(m.username, m.email, m.phone);
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

const filteredRows = computed(() => {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return allRows.value.filter((r) => {
    const haystack = namespaceHaystack(r);
    return terms.every((term) => haystack.includes(term));
  });
});

// What the table actually renders + paginates: the client-filtered list
// while searching (sliced here since there's no server round-trip), the
// server page otherwise.
const displayRows = computed(() => {
  if (!searchActive.value) return rows.value;
  const start = (page.value - 1) * pageSize;
  return filteredRows.value.slice(start, start + pageSize);
});
const displayTotal = computed(() => (searchActive.value ? filteredRows.value.length : total.value));
const totalPages = computed(() => Math.ceil(displayTotal.value / pageSize));

// While searching, results come from allRows -- show the spinner until
// that first full fetch lands rather than a misleading "nothing found".
const showSpinner = computed(() =>
  searchActive.value
    ? statsLoading.value && !allRows.value.length
    : loading.value && !rows.value.length,
);

// Jump from a favorite card to that namespace's row in the table below,
// where health/members can be inspected. Reuses the existing search box
// (debounced watcher reloads page 1 filtered to this slug).
function focusNamespace(row: AdminNamespaceRow) {
  search.value = row.slug;
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function toggleExpanded(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
}

// On-demand troubleshooting check -- only fetched the first time a row is
// expanded, then cached for the rest of the page's lifetime (no polling or
// auto-refresh, this is a manual "check now" action, not monitoring).
async function toggleHealth(row: AdminNamespaceRow) {
  const willExpand = !healthExpanded.value[row.id];
  healthExpanded.value = { ...healthExpanded.value, [row.id]: willExpand };
  if (!willExpand || healthData.value[row.id] || healthLoading.value[row.id] || !token.value) return;

  healthLoading.value = { ...healthLoading.value, [row.id]: true };
  try {
    const apps = await hubGetAdminNamespaceHealth(token.value, row.id);
    healthData.value = { ...healthData.value, [row.id]: apps };
  } catch (e) {
    console.error('[console/namespaces] Failed to check namespace health', e);
  } finally {
    healthLoading.value = { ...healthLoading.value, [row.id]: false };
  }
}

function appHealthStatus(app: AppHealthStatus): 'ok' | 'warn' | 'down' {
  if (!app.reachable) return 'down';
  if (!app.schemaReady) return 'warn';
  return 'ok';
}

function healthPillLabel(app: AppHealthStatus): string {
  const status = appHealthStatus(app);
  if (status === 'ok') return t('admin.healthOk') || 'OK';
  if (status === 'warn') return t('admin.healthStale') || 'Схема не готова';
  return t('admin.healthDown') || 'Недоступен';
}

function healthPillClass(app: AppHealthStatus): string {
  const status = appHealthStatus(app);
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400';
  if (status === 'warn') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400';
}

function healthCardClass(app: AppHealthStatus): string {
  const status = appHealthStatus(app);
  if (status === 'ok') return 'border-emerald-100 bg-white dark:border-emerald-800/30';
  if (status === 'warn') return 'border-amber-100 bg-white dark:border-amber-800/30';
  return 'border-rose-100 bg-white dark:border-rose-800/30';
}

function healthSummaryClass(id: string): string {
  const apps = healthData.value[id] || [];
  if (apps.some((a) => appHealthStatus(a) === 'down')) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (apps.some((a) => appHealthStatus(a) === 'warn')) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-emerald-600 dark:text-emerald-400 font-semibold';
}

function healthSummaryLabel(id: string): string {
  const apps = healthData.value[id] || [];
  const downCount = apps.filter((a) => appHealthStatus(a) === 'down').length;
  const warnCount = apps.filter((a) => appHealthStatus(a) === 'warn').length;
  if (downCount) return `${downCount} ${t('admin.healthDownShort') || 'недоступно'}`;
  if (warnCount) return `${warnCount} ${t('admin.healthStaleShort') || 'не готово'}`;
  return t('admin.healthOk') || 'OK';
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
  'pieceowater.issues': 'Issues',
  'pieceowater.goods': 'Goods',
  'pieceowater.plans': 'Plans',
};
function appLabel(bundle: string): string {
  return APP_LABELS[bundle] || bundle;
}

function isEmployeeNamespace(n: AdminNamespaceRow): boolean {
  return typeof n.ownerOtherNamespaceCount === 'number' && n.ownerOtherNamespaceCount > 0;
}
function employerLabel(n: AdminNamespaceRow): string {
  return (n.ownerEmployerNamespaces || []).map((e) => e.title).join(', ');
}
function employerHint(n: AdminNamespaceRow): string {
  const label = employerLabel(n);
  return label ? `${t('admin.employeeOf')} ${label}` : t('admin.employeeNamespaceHint');
}

// Fetches the full platform list into allRows (see its declaration) and
// derives the "Компаний"/"Сотрудников" counts from it.
async function loadStats() {
  if (!token.value) return;
  statsLoading.value = true;
  try {
    const res = await hubGetAdminNamespaces(token.value);
    allRows.value = res.rows;
    let companies = 0;
    let employees = 0;
    for (const n of res.rows) {
      if (n.ownerOtherNamespaceCount === 0) companies += 1;
      else if (typeof n.ownerOtherNamespaceCount === 'number' && n.ownerOtherNamespaceCount > 0) employees += 1;
    }
    companyCount.value = companies;
    employeeCount.value = employees;
  } catch (e) {
    console.error('[console/namespaces] Failed to load namespace stats', e);
  } finally {
    statsLoading.value = false;
  }
}

async function loadPage() {
  if (!token.value) return;
  loading.value = true;
  try {
    const res = await hubGetAdminNamespacesPage(token.value, page.value, 'TWENTY', search.value.trim() || undefined);
    rows.value = res.rows;
    total.value = res.total;
    loadedAt.value = Date.now();
  } catch (e) {
    console.error('[console/namespaces] Failed to load namespaces', e);
  } finally {
    loading.value = false;
  }
}

// Resetting page.value to 1 on search also trips this watcher, which then
// duplicates the loadPage() call the search handler already makes below --
// same shape of race as menu/index.vue's order list, though here both
// watchers call the same function so the only cost is a wasted duplicate
// request (and, if the user types again before the first pair settles,
// no guarantee the most recent one wins). suppressPageWatch skips the
// watcher once; the search handler always clears it back via nextTick so
// a reset that's a no-op (already on page 1) can't leave it stuck.
let suppressPageWatch = false;
watch(page, () => {
  if (suppressPageWatch) {
    suppressPageWatch = false;
    return;
  }
  // While searching, paging is a pure client-side slice of filteredRows.
  if (searchActive.value) return;
  loadPage();
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    suppressPageWatch = true;
    page.value = 1;
    await nextTick();
    suppressPageWatch = false;
    // Searching filters allRows in memory -- no fetch needed. Only hit the
    // server to restore the default paginated view once the box is cleared.
    if (!searchActive.value) loadPage();
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
  loadStats();
});
</script>
