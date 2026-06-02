<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <AdminHeader
      :title="t('admin.publications')"
      :description="t('admin.publicationsDesc')"
    >
      <template #actions>
        <UButton
          icon="lucide:plus"
          color="primary"
          @click="$router.push('/console/publications/new')"
        >
          {{ t('admin.newPublication') }}
        </UButton>
      </template>
    </AdminHeader>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-nowrap gap-3 overflow-x-auto pb-1">
        <button
          v-for="cat in categories"
          :key="cat.value"
          type="button"
          class="relative min-w-[180px] flex-1 shrink-0 rounded-2xl border p-4 text-left transition-all duration-200"
          :class="selectedCategory === cat.value ? cat.activeClass : cat.inactiveClass"
          @click="selectCategory(cat.value)"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-medium uppercase tracking-[0.08em]" :class="selectedCategory === cat.value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'">
                {{ cat.label }}
              </div>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-bold leading-none text-slate-900 dark:text-white">{{ categoryCount(cat.value) }}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400">материалов</span>
              </div>
            </div>
            <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors" :class="selectedCategory === cat.value ? cat.iconActiveClass : cat.iconInactiveClass">
              <Icon :name="cat.icon" class="h-5 w-5" />
            </div>
          </div>
        </button>
      </div>

      <div class="mt-6 flex flex-col gap-3 md:flex-row">
        <div class="relative flex-1">
          <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="search"
            type="text"
            placeholder="Поиск по заголовку или slug"
            class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
        </div>
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="reload"
        >
          Обновить
        </button>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Заголовок</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Slug</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Категория</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Статус</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Автор</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Дата</th>
              <th class="px-4 py-3 font-semibold text-slate-900 dark:text-white">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-6 text-center text-slate-500">Загрузка...</td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td colspan="7" class="px-4 py-6 text-center text-slate-500">Ничего не найдено</td>
            </tr>
            <tr
              v-for="row in rows"
              v-else
              :key="row.slug"
              class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ row.title }}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ row.slug }}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ categoryLabel(row.category) }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="row.status === 'published'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'"
                >
                  {{ row.status === 'published' ? 'Published' : 'Draft' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ row.author }}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ row.updatedAt || row.publishedAt }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    @click="$router.push(`/console/publications/${row.slug}`)"
                  >
                    <Icon name="lucide:edit-2" class="h-3.5 w-3.5" />
                    Редактировать
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                    @click="deletePublication(row)"
                  >
                    <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                    Архивировать
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div>Всего: {{ total }}</div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
            :disabled="page <= 1"
            @click="page = page - 1"
          >
            Назад
          </button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
            :disabled="page >= totalPages"
            @click="page = page + 1"
          >
            Вперёд
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AdminHeader from '@/components/admin/AdminHeader.vue';
import { useI18n } from '@/composables/useI18n';
import { capitalArchivePublication, capitalListPublications, type PublicationListRow } from '@/api/publications';

definePageMeta({ middleware: 'admin' });

const { t } = useI18n();
const authToken = useCookie<string | null>('auth_token');
const legacyToken = useCookie<string | null>('token');

const categories = computed(() => [
  {
    value: 'all',
    label: t('app.all'),
    icon: 'lucide:layers-3',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  {
    value: 'blog',
    label: t('admin.blog'),
    icon: 'lucide:rss',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  {
    value: 'whatsnew',
    label: t('admin.whatsnew'),
    icon: 'lucide:sparkles',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  {
    value: 'articles',
    label: t('admin.articles'),
    icon: 'lucide:file-text',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  {
    value: 'learning',
    label: t('admin.learning'),
    icon: 'lucide:book',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  {
    value: 'news',
    label: t('admin.news'),
    icon: 'lucide:newspaper',
    activeClass: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
    iconActiveClass: 'border-blue-200 bg-white text-blue-600 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300',
    iconInactiveClass: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
]);

const selectedCategory = ref('all');
const search = ref('');
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const rows = ref<PublicationListRow[]>([]);
const counts = ref<Record<string, number>>({ all: 0, blog: 0, whatsnew: 0, articles: 0, learning: 0, news: 0 });
const toast = useToast();

function categoryLabel(value: string) {
  const found = categories.value.find((c) => c.value === value);
  return found?.label || value;
}

function categoryCount(value: string) {
  return Number(counts.value[value] || 0);
}

function selectCategory(value: string) {
  selectedCategory.value = value;
  page.value = 1;
}

async function load() {
  loading.value = true;
  try {
    const token = String(authToken.value || legacyToken.value || '').trim();
    const res = await capitalListPublications(token, {
      category: selectedCategory.value === 'all' ? undefined : selectedCategory.value,
      search: search.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
      includeDraft: true,
    });

    rows.value = res.items || [];
    total.value = Number(res.total || 0);
    totalPages.value = Number(res.totalPages || 1);
    page.value = Number(res.page || 1);
    counts.value = res.counts || counts.value;
  } catch (error: any) {
    toast.add({
      title: 'Не удалось загрузить публикации',
      description: error?.message || 'Проверьте авторизацию и подключение к Capital',
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

function reload() {
  load();
}

async function deletePublication(row: PublicationListRow) {
  const confirmed = window.confirm(`Архивировать публикацию \"${row.title}\"? Публикация исчезнет из списков и публичной выдачи.`);
  if (!confirmed) return;

  try {
    await capitalArchivePublication(String(authToken.value || legacyToken.value || '').trim(), row.slug, row.version);

    toast.add({
      title: 'Публикация архивирована',
      color: 'green',
    });

    if (rows.value.length === 1 && page.value > 1) {
      page.value = page.value - 1;
      return;
    }

    await load();
  } catch (error: any) {
    toast.add({
      title: 'Не удалось архивировать публикацию',
      description: error?.message || 'Проверьте права доступа',
      color: 'red',
    });
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  page.value = 1;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(), 250);
});

watch([selectedCategory, page], () => {
  load();
});

load();
</script>

