<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.support')" 
      :description="t('admin.supportDesc')"
    />

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Stats -->
      <div class="grid gap-4 md:grid-cols-4 mb-8">
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.openTickets') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">3</div>
            </div>
            <Icon name="lucide:inbox" class="h-8 w-8 text-blue-600 dark:text-blue-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.inProgress') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">2</div>
            </div>
            <Icon name="lucide:loader" class="h-8 w-8 text-orange-600 dark:text-orange-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.resolved') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">18</div>
            </div>
            <Icon name="lucide:check-circle" class="h-8 w-8 text-green-600 dark:text-green-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.avgResponse') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">2h 30m</div>
            </div>
            <Icon name="lucide:clock" class="h-8 w-8 text-purple-600 dark:text-purple-400 opacity-20" />
          </div>
        </div>
      </div>

      <!-- Tickets List -->
      <div>
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.supportTickets') }}
        </h3>
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">ID</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Тема</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Статус</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Приоритет</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Создано</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">#TKT-001</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">API ошибка 500</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">In Progress</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-200">High</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-22</td>
                <td class="px-6 py-4">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:arrow-right" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">#TKT-002</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Вопрос по биллингу</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Open</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Medium</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-21</td>
                <td class="px-6 py-4">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:arrow-right" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">#TKT-003</td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">Функция не работает</td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Open</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">Low</span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">2026-04-20</td>
                <td class="px-6 py-4">
                  <button class="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    <Icon name="lucide:arrow-right" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- Coming Soon Notice -->
      <div class="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div class="flex gap-3">
          <Icon name="lucide:info" class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 class="font-semibold text-blue-900 dark:text-blue-200">
              {{ t('admin.supportSystemDev') }}
            </h4>
            <p class="mt-1 text-sm text-blue-800 dark:text-blue-300">
              Full ticket management system will be available in an upcoming release.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();

// Фейковые данные для визуализации
const stats = ref({
  openTickets: 3,
  inProgress: 2,
  resolved: 18,
  avgResponse: '2h 30m'
});
</script>

