<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { RouteProgressRow } from '@/types/atrace';

defineProps<{
  progressStart: string;
  progressEnd: string;
  loading: boolean;
  error: string | null;
  rows: RouteProgressRow[];
  formatStatus: (status?: string | null) => { label: string; color: string };
}>();

const emit = defineEmits<{
  (e: 'update:progressStart', value: string): void;
  (e: 'update:progressEnd', value: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 sm:p-6">
    <div class="mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon
              name="i-heroicons-users"
              class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
            />
            {{ t('app.route.employees') || 'Сотрудники' }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ t('app.route.employeesHint') || 'Статистика прохождения маршрута по сотрудникам' }}
          </p>
        </div>

        <!-- Period selector -->
        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ t('app.period') || 'Период' }}:</label>
          <div class="flex items-center gap-2 flex-nowrap">
            <UInput
              :model-value="progressStart"
              type="date"
              size="sm"
              class="w-32 sm:w-36"
              @update:model-value="emit('update:progressStart', $event)"
            />
            <span class="text-xs text-gray-400">—</span>
            <UInput
              :model-value="progressEnd"
              type="date"
              size="sm"
              class="w-32 sm:w-36"
              @update:model-value="emit('update:progressEnd', $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-6"
    >
      <div class="flex flex-col items-center gap-2">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
        <p class="text-xs text-gray-500">
          {{ t('app.loading') || 'Loading...' }}
        </p>
      </div>
    </div>
    <div
      v-else-if="error"
      class="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3"
    >
      <UIcon
        name="i-heroicons-exclamation-circle"
        class="w-4 h-4 flex-shrink-0"
      />
      <span class="text-sm">{{ error }}</span>
    </div>
    <div
      v-else-if="rows.length === 0"
      class="text-center py-8"
    >
      <UIcon
        name="i-heroicons-users"
        class="w-12 h-12 text-gray-400 mx-auto mb-3"
      />
      <p class="text-sm text-gray-500">
        {{ t('app.route.progress.empty') || 'Нет данных по сотрудникам' }}
      </p>
    </div>
    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="row in rows"
        :key="row.userId"
        class="group relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
      >
        <div class="p-4">
          <!-- User header -->
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-base font-semibold flex-shrink-0">
              {{ row.username.substring(0, 2).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white truncate">
                {{ row.username }}
              </h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ row.email || row.userId }}
              </p>
            </div>
            <div
              class="px-2.5 py-1 rounded-md text-xs font-medium border flex-shrink-0"
              :class="formatStatus(row.lastStatus).color"
            >
              {{ formatStatus(row.lastStatus).label }}
            </div>
          </div>

          <!-- Meta info -->
          <div class="flex items-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-400">
            <div class="flex items-center gap-1.5">
              <UIcon
                name="i-heroicons-arrow-path"
                class="w-3.5 h-3.5"
              />
              <span class="font-medium">{{ row.completedCount + row.partialCount + row.violatedCount + row.pendingCount }}</span>
              <span>{{ t('app.route.passes') || 'прохождений' }}</span>
            </div>
            <span class="text-gray-300 dark:text-gray-600">•</span>
            <div class="flex items-center gap-1.5">
              <UIcon
                name="i-heroicons-calendar"
                class="w-3.5 h-3.5"
              />
              <span>{{ row.lastDate || (t('app.noData') || 'Нет данных') }}</span>
            </div>
          </div>

          <!-- Progress stats -->
          <div class="grid grid-cols-4 gap-2">
            <!-- Completed -->
            <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <div class="w-8 h-8 mx-auto rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-1.5">
                <UIcon
                  name="i-heroicons-check-circle"
                  class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">
                {{ row.completedCount }}
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('app.route.status.ok') || 'Успешно' }}
              </div>
            </div>

            <!-- Partial -->
            <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <div class="w-8 h-8 mx-auto rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-1.5">
                <UIcon
                  name="i-heroicons-exclamation-triangle"
                  class="w-4 h-4 text-orange-600 dark:text-orange-400"
                />
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">
                {{ row.partialCount }}
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('app.route.status.partial') || 'Частично' }}
              </div>
            </div>

            <!-- Violated -->
            <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <div class="w-8 h-8 mx-auto rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-1.5">
                <UIcon
                  name="i-heroicons-x-circle"
                  class="w-4 h-4 text-red-600 dark:text-red-400"
                />
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">
                {{ row.violatedCount }}
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('app.route.status.violation') || 'Нарушения' }}
              </div>
            </div>

            <!-- Pending -->
            <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <div class="w-8 h-8 mx-auto rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-1.5">
                <UIcon
                  name="i-heroicons-clock"
                  class="w-4 h-4 text-gray-600 dark:text-gray-400"
                />
              </div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">
                {{ row.pendingCount }}
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('app.route.status.pending') || 'Не пройдено' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
