<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <NuxtLink
          to="/console"
          class="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <Icon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          {{ t('admin.backToConsole') }}
        </NuxtLink>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
          {{ t('admin.guide') }}
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          {{ t('admin.guideDesc') }}
        </p>
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-for="app in APPS"
          :key="app"
          size="sm"
          :variant="selectedApp === app ? 'solid' : 'soft'"
          :color="selectedApp === app ? 'primary' : 'gray'"
          @click="selectedApp = app"
        >
          {{ appLabel(app) }}
        </UButton>
      </div>

      <!-- Categories -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ t('admin.guideCategories') }}
            </h2>
            <UButton size="sm" icon="lucide:plus" @click="openCreateCategory">
              {{ t('admin.guideAddCategory') }}
            </UButton>
          </div>
        </template>

        <div v-if="categoriesLoading" class="py-6 text-sm text-slate-500">
          {{ t('app.loading') }}
        </div>
        <div v-else-if="!orderedCategories.length" class="py-6 text-sm text-slate-500">
          {{ t('admin.guideNoCategories') }}
        </div>
        <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            v-for="row in orderedCategories"
            :key="row.category.id"
            class="flex items-center justify-between py-3"
            :style="{ paddingLeft: `${row.depth * 1.5}rem` }"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Icon v-if="row.category.icon" :name="row.category.icon" class="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ row.category.nameRu || row.category.slug }}</span>
              <span class="text-xs text-slate-400 truncate">/{{ row.category.slug }}</span>
              <span v-if="!row.category.isActive" class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">
                {{ t('admin.guideInactive') }}
              </span>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <UButton size="xs" variant="ghost" icon="lucide:pencil" @click="openEditCategory(row.category)" />
              <UButton size="xs" variant="ghost" color="red" icon="lucide:trash-2" @click="confirmDeleteCategory(row.category)" />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Articles -->
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ t('admin.guideArticles') }}
            </h2>
            <UButton size="sm" icon="lucide:plus" @click="goToNewArticle">
              {{ t('admin.guideAddArticle') }}
            </UButton>
          </div>
        </template>

        <div class="flex flex-wrap items-center gap-3 pb-4">
          <USelectMenu
            v-model="articleFilters.categoryId"
            :options="categoryFilterOptions"
            value-attribute="value"
            option-attribute="label"
            :placeholder="t('admin.guideAllCategories')"
            class="w-56"
          />
          <UCheckbox v-model="articleFilters.onlyFaq" :label="t('admin.guideOnlyFaq')" />
          <USelectMenu
            v-model="articleFilters.status"
            :options="statusFilterOptions"
            value-attribute="value"
            option-attribute="label"
            class="w-40"
          />
          <UInput v-model="articleFilters.search" :placeholder="t('app.search')" icon="lucide:search" class="w-56" />
        </div>

        <div v-if="articlesLoading" class="py-6 text-sm text-slate-500">
          {{ t('app.loading') }}
        </div>
        <div v-else-if="!articles.length" class="py-6 text-sm text-slate-500">
          {{ t('admin.guideNoArticles') }}
        </div>
        <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            v-for="article in articles"
            :key="article.id"
            class="flex items-center justify-between py-3 gap-3"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ article.titleRu || article.slug }}</span>
                <span v-if="article.isFaq" class="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">FAQ</span>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px]"
                  :class="article.status === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                >
                  {{ article.status === 'PUBLISHED' ? t('admin.guidePublished') : t('admin.guideDraft') }}
                </span>
              </div>
              <div class="text-xs text-slate-400 truncate">/{{ article.slug }}</div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <UButton size="xs" variant="ghost" icon="lucide:pencil" @click="editArticle(article.id)" />
              <UButton size="xs" variant="ghost" color="red" icon="lucide:trash-2" @click="confirmDeleteArticle(article)" />
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <Modal v-model="categoryModalOpen" :header="categoryModalTitle">
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideParentCategory') }}</label>
          <USelectMenu
            v-model="categoryForm.parentId"
            :options="parentCategoryOptions"
            value-attribute="value"
            option-attribute="label"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <UInput v-model="categoryForm.slug" placeholder="getting-started" />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Название (RU)</label>
            <UInput v-model="categoryForm.nameRu" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Название (KK)</label>
            <UInput v-model="categoryForm.nameKk" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Название (EN)</label>
            <UInput v-model="categoryForm.nameEn" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideIcon') }}</label>
            <UInput v-model="categoryForm.icon" placeholder="lucide:book-open" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideSortOrder') }}</label>
            <UInput v-model.number="categoryForm.sortOrder" type="number" />
          </div>
        </div>
        <UCheckbox v-model="categoryForm.isActive" :label="t('admin.guideActive')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="categoryModalOpen = false">{{ t('app.cancel') }}</UButton>
          <UButton :loading="categorySaving" @click="saveCategory">{{ t('app.save') }}</UButton>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
import type { GuideApp, GuideArticleListItem, GuideArticleStatus, GuideCategory } from '@/api/guide/public';
import {
  consoleListGuideArticles,
  consoleListGuideCategories,
  guideCreateCategory,
  guideDeleteArticle,
  guideDeleteCategory,
  guideUpdateCategory,
} from '@/api/guide/admin';

definePageMeta({ middleware: 'console-access' });

const { t } = useI18n();
useHead({ title: 'Гид — Консоль' });

const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();
const { token } = useAuth();

const APPS: GuideApp[] = ['GLOBAL', 'LANDING', 'ISSUES', 'MENU', 'CONTACTS', 'ATRACE'];
const selectedApp = ref<GuideApp>('GLOBAL');

function appLabel(app: GuideApp): string {
  switch (app) {
    case 'ISSUES': return t('app.tasks');
    case 'MENU': return t('app.menu');
    case 'CONTACTS': return t('app.clients');
    case 'ATRACE': return t('app.attendance');
    case 'LANDING': return t('guide.appLanding');
    default: return t('guide.appGlobal');
  }
}

const categories = ref<GuideCategory[]>([]);
const categoriesLoading = ref(false);

async function loadCategories() {
  categoriesLoading.value = true;
  try {
    categories.value = await consoleListGuideCategories(token.value || '', selectedApp.value);
  } catch (error: any) {
    toast.add({ title: error?.message || 'Не удалось загрузить категории', color: 'red' });
  } finally {
    categoriesLoading.value = false;
  }
}

type CategoryRow = { category: GuideCategory; depth: number };

const orderedCategories = computed<CategoryRow[]>(() => {
  const byParent = new Map<string, GuideCategory[]>();
  for (const c of categories.value) {
    const key = c.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.nameRu.localeCompare(b.nameRu));
  }

  const rows: CategoryRow[] = [];
  function walk(parentKey: string, depth: number) {
    for (const c of byParent.get(parentKey) || []) {
      rows.push({ category: c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk('', 0);
  return rows;
});

const parentCategoryOptions = computed(() => [
  { value: '', label: t('admin.guideRootCategory') },
  ...categories.value
    .filter((c) => c.id !== editingCategoryId.value)
    .map((c) => ({ value: c.id, label: c.nameRu || c.slug })),
]);

const categoryModalOpen = ref(false);
const categorySaving = ref(false);
const editingCategoryId = ref<string | null>(null);
const categoryModalTitle = computed(() => (editingCategoryId.value ? t('admin.guideEditCategory') : t('admin.guideAddCategory')));

const categoryForm = reactive({
  parentId: '',
  slug: '',
  nameRu: '',
  nameKk: '',
  nameEn: '',
  icon: '',
  sortOrder: 0,
  isActive: true,
});

function resetCategoryForm() {
  categoryForm.parentId = '';
  categoryForm.slug = '';
  categoryForm.nameRu = '';
  categoryForm.nameKk = '';
  categoryForm.nameEn = '';
  categoryForm.icon = '';
  categoryForm.sortOrder = 0;
  categoryForm.isActive = true;
}

function openCreateCategory() {
  editingCategoryId.value = null;
  resetCategoryForm();
  categoryModalOpen.value = true;
}

function openEditCategory(category: GuideCategory) {
  editingCategoryId.value = category.id;
  categoryForm.parentId = category.parentId || '';
  categoryForm.slug = category.slug;
  categoryForm.nameRu = category.nameRu;
  categoryForm.nameKk = category.nameKk;
  categoryForm.nameEn = category.nameEn;
  categoryForm.icon = category.icon;
  categoryForm.sortOrder = category.sortOrder;
  categoryForm.isActive = category.isActive;
  categoryModalOpen.value = true;
}

async function saveCategory() {
  if (!categoryForm.slug.trim() || !categoryForm.nameRu.trim()) {
    toast.add({ title: t('admin.guideCategoryValidation'), color: 'red' });
    return;
  }

  categorySaving.value = true;
  try {
    const input = {
      parentId: categoryForm.parentId || null,
      app: selectedApp.value,
      slug: categoryForm.slug.trim(),
      nameRu: categoryForm.nameRu.trim(),
      nameKk: categoryForm.nameKk.trim(),
      nameEn: categoryForm.nameEn.trim(),
      icon: categoryForm.icon.trim(),
      sortOrder: categoryForm.sortOrder,
      isActive: categoryForm.isActive,
    };

    if (editingCategoryId.value) {
      await guideUpdateCategory(token.value || '', editingCategoryId.value, input);
    } else {
      await guideCreateCategory(token.value || '', input);
    }

    categoryModalOpen.value = false;
    await loadCategories();
    toast.add({ title: t('app.saved'), color: 'green' });
  } catch (error: any) {
    toast.add({ title: error?.message || 'Не удалось сохранить категорию', color: 'red' });
  } finally {
    categorySaving.value = false;
  }
}

async function confirmDeleteCategory(category: GuideCategory) {
  const ok = await confirm({
    title: t('admin.guideDeleteCategory'),
    message: t('admin.guideDeleteCategoryConfirm'),
  });
  if (!ok) return;

  try {
    await guideDeleteCategory(token.value || '', category.id);
    await loadCategories();
    toast.add({ title: t('app.deleted'), color: 'green' });
  } catch (error: any) {
    toast.add({ title: error?.message || 'Не удалось удалить категорию (проверьте вложенные статьи/категории)', color: 'red' });
  }
}

const articles = ref<GuideArticleListItem[]>([]);
const articlesLoading = ref(false);
const articleFilters = reactive({
  categoryId: '',
  onlyFaq: false,
  status: '' as GuideArticleStatus | '',
  search: '',
});

const categoryFilterOptions = computed(() => [
  { value: '', label: t('admin.guideAllCategories') },
  ...categories.value.map((c) => ({ value: c.id, label: c.nameRu || c.slug })),
]);

const statusFilterOptions = computed(() => [
  { value: '', label: t('admin.guideAllStatuses') },
  { value: 'DRAFT', label: t('admin.guideDraft') },
  { value: 'PUBLISHED', label: t('admin.guidePublished') },
]);

let articleSearchDebounce: ReturnType<typeof setTimeout> | null = null;

async function loadArticles() {
  articlesLoading.value = true;
  try {
    const res = await consoleListGuideArticles(
      token.value || '',
      {
        categoryId: articleFilters.categoryId || undefined,
        onlyFaq: articleFilters.onlyFaq || undefined,
        status: articleFilters.status || undefined,
        search: articleFilters.search || undefined,
        pageSize: 100,
      },
      selectedApp.value,
    );
    articles.value = res.items;
  } catch (error: any) {
    toast.add({ title: error?.message || 'Не удалось загрузить статьи', color: 'red' });
  } finally {
    articlesLoading.value = false;
  }
}

function goToNewArticle() {
  router.push({ path: '/console/guide/articles/new', query: { app: selectedApp.value } });
}

function editArticle(id: string) {
  router.push(`/console/guide/articles/${id}`);
}

async function confirmDeleteArticle(article: GuideArticleListItem) {
  const ok = await confirm({
    title: t('admin.guideDeleteArticle'),
    message: t('admin.guideDeleteArticleConfirm'),
  });
  if (!ok) return;

  try {
    await guideDeleteArticle(token.value || '', article.id);
    await loadArticles();
    toast.add({ title: t('app.deleted'), color: 'green' });
  } catch (error: any) {
    toast.add({ title: error?.message || 'Не удалось удалить статью', color: 'red' });
  }
}

watch(selectedApp, () => {
  articleFilters.categoryId = '';
  loadCategories();
  loadArticles();
}, { immediate: true });

watch(
  () => [articleFilters.categoryId, articleFilters.onlyFaq, articleFilters.status],
  () => loadArticles(),
);

watch(
  () => articleFilters.search,
  () => {
    if (articleSearchDebounce) clearTimeout(articleSearchDebounce);
    articleSearchDebounce = setTimeout(() => loadArticles(), 300);
  },
);
</script>
