<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.publications')" 
      :description="t('admin.publicationsDesc')"
    >
      <template #actions>
        <NuxtLink
          to="/console/publications/new"
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span>{{ t('admin.newPublication') }}</span>
        </NuxtLink>
      </template>
    </AdminHeader>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Content Categories -->
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <!-- Blog -->
        <div class="group rounded-lg border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 cursor-pointer">
          <div class="flex items-start justify-between">
            <div>
              <div class="inline-flex rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Icon name="lucide:rss" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-white">{{ t('admin.blog') }}</h3>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('admin.blogDesc') }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ publicationCounts.blog }}</div>
            <Icon name="lucide:arrow-right" class="h-5 w-5 text-blue-600 dark:text-blue-400 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        <!-- What's New -->
        <div class="group rounded-lg border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 cursor-pointer">
          <div class="flex items-start justify-between">
            <div>
              <div class="inline-flex rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Icon name="lucide:sparkles" class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-white">{{ t('admin.whatsnew') }}</h3>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('admin.whatsnewDesc') }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ publicationCounts.whatsnew }}</div>
            <Icon name="lucide:arrow-right" class="h-5 w-5 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        <!-- Articles (SEO) -->
        <div class="group rounded-lg border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 cursor-pointer">
          <div class="flex items-start justify-between">
            <div>
              <div class="inline-flex rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                <Icon name="lucide:file-text" class="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-white">{{ t('admin.articles') }}</h3>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('admin.articlesDesc') }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ publicationCounts.articles }}</div>
            <Icon name="lucide:arrow-right" class="h-5 w-5 text-orange-600 dark:text-orange-400 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        <!-- Learning Materials -->
        <div class="group rounded-lg border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 cursor-pointer">
          <div class="flex items-start justify-between">
            <div>
              <div class="inline-flex rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                <Icon name="lucide:book" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-white">{{ t('admin.learning') }}</h3>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('admin.learningDesc') }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ publicationCounts.learning }}</div>
            <Icon name="lucide:arrow-right" class="h-5 w-5 text-purple-600 dark:text-purple-400 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>

      <!-- All Publications List -->
      <div class="mt-12">
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.allPublications') }}
        </h3>
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Заголовок</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Категория</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Статус</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Автор</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Дата</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">Введение в платформу</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Блог</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">Published</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Admin</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-20</td>
                <td class="px-6 py-4 flex gap-2">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:edit-2" class="h-4 w-4" />
                  </button>
                  <button class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">Новая API v2</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Что нового</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">Published</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Admin</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-18</td>
                <td class="px-6 py-4 flex gap-2">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:edit-2" class="h-4 w-4" />
                  </button>
                  <button class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">SEO оптимизация</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">Статьи</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Draft</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Editor</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-15</td>
                <td class="px-6 py-4 flex gap-2">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:edit-2" class="h-4 w-4" />
                  </button>
                  <button class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">Введение для начинающих</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Обучение</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">Published</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Admin</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-10</td>
                <td class="px-6 py-4 flex gap-2">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:edit-2" class="h-4 w-4" />
                  </button>
                  <button class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Coming Soon Notice -->
      <div class="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div class="flex gap-3">
          <Icon name="lucide:info" class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 class="font-semibold text-blue-900 dark:text-blue-200">
              {{ t('admin.cmsIntegration') }}
            </h4>
            <p class="mt-1 text-sm text-blue-800 dark:text-blue-300">
              {{ t('admin.cmsIntegrationDesc') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();

// Фейковые данные для визуализации
const publicationCounts = ref({
  blog: 12,
  whatsnew: 5,
  articles: 23,
  learning: 8
});

const allPublications = ref([
  { id: '1', title: 'Введение в платформу', category: 'blog', status: 'published', author: 'Admin', date: '2026-04-20' },
  { id: '2', title: 'Новая API v2', category: 'whatsnew', status: 'published', author: 'Admin', date: '2026-04-18' },
  { id: '3', title: 'SEO оптимизация', category: 'articles', status: 'draft', author: 'Editor', date: '2026-04-15' },
  { id: '4', title: 'Введение для начинающих', category: 'learning', status: 'published', author: 'Admin', date: '2026-04-10' }
]);
</script>

