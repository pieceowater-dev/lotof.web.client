<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import type { CellValue } from '@/utils/planFeatures';

// Dumb comparison-table renderer. Callers (PlanComparisonTable /
// BundleComparisonTable) build `columns` + `groups`; this just paints them.

defineProps<{
  title?: string;
  subtitle?: string;
  columns: Array<{ key: string; title: string; subtitle?: string; highlight?: boolean }>;
  groups: Array<{
    label?: string;
    rows: Array<{ label: string; values: Record<string, CellValue> }>;
  }>;
}>();

const { t } = useI18n();

function isBool(v: CellValue): v is boolean {
  return typeof v === 'boolean';
}
function isEmpty(v: CellValue): boolean {
  return v === null || v === undefined || v === '' || v === false;
}
</script>

<template>
  <section class="mt-12">
    <div class="mb-4">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ title || t('app.compareTitle') || 'Сравните, что вы получите' }}
      </h2>
      <p v-if="subtitle" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ subtitle }}
      </p>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div class="max-h-[75vh] overflow-auto rounded-2xl">
        <table class="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th class="sticky left-0 top-0 z-30 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 w-[38%]">
                {{ t('app.compareFeatureCol') || 'Возможность' }}
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                class="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-center align-bottom"
                :class="col.highlight ? 'bg-primary-50 dark:bg-primary-900' : 'bg-white dark:bg-gray-800'"
              >
                <div class="font-bold text-gray-900 dark:text-white">{{ col.title }}</div>
                <div v-if="col.subtitle" class="mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                  {{ col.subtitle }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, gi) in groups" :key="gi">
              <tr v-if="group.label" class="bg-gray-50 dark:bg-gray-900/40">
                <td
                  :colspan="columns.length + 1"
                  class="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  {{ group.label }}
                </td>
              </tr>
              <tr
                v-for="(row, ri) in group.rows"
                :key="gi + '-' + ri"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td class="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-3 text-gray-700 dark:text-gray-300">
                  {{ row.label }}
                </td>
                <td
                  v-for="col in columns"
                  :key="col.key"
                  class="px-4 py-3 text-center"
                  :class="col.highlight ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
                >
                  <template v-if="isBool(row.values[col.key])">
                    <UIcon
                      v-if="row.values[col.key]"
                      name="i-heroicons-check-circle"
                      class="inline h-5 w-5 text-emerald-500"
                    />
                    <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                  </template>
                  <span v-else-if="isEmpty(row.values[col.key])" class="text-gray-300 dark:text-gray-600">—</span>
                  <span v-else class="font-semibold text-gray-900 dark:text-white">{{ row.values[col.key] }}</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
