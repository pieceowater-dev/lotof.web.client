<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Route } from '@/api/atrace/route/list';
import type { RoutePass } from '@/api/atrace/route/validatePass';

defineProps<{
  route: Route | null;
  orderedPostCount: number;
  routePasses: RoutePass[];
  routePassesLoading: boolean;
  routePassesError: string | null;
}>();

const { t } = useI18n();

const showRouteConceptInfo = ref(false);
const showStatInfoTooltip = ref(false);
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 sm:p-6 mb-4">
    <div class="flex flex-col gap-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <UIcon
              name="i-heroicons-map"
              class="w-6 h-6 text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('app.route.label') || 'Маршрут' }}
              </div>
              <button
                class="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
                :title="t('app.route.concept.title') || 'Как работают маршруты'"
                @click="showRouteConceptInfo = !showRouteConceptInfo"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="w-4 h-4"
                />
              </button>
            </div>
            <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              {{ route?.title || '—' }}
            </h2>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
              <UIcon
                name="i-heroicons-view-columns"
                class="w-4 h-4"
              />
              <span>{{ orderedPostCount }} {{ t('app.route.posts') || 'постов' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Block: Route Concept Explanation (Collapsible) -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[500px]"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 max-h-[500px]"
        leave-to-class="opacity-0 max-h-0"
      >
        <div
          v-if="showRouteConceptInfo"
          class="overflow-hidden"
        >
          <div class="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0">
                <UIcon
                  name="i-heroicons-information-circle"
                  class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div class="flex-1">
                <h4 class="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                  {{ t('app.route.concept.title') || 'Как работают маршруты' }}
                </h4>
                <div class="text-sm text-emerald-800 dark:text-emerald-200 space-y-2">
                  <p>{{ t('app.route.concept.description') || 'Маршрут — это список постов в заданном порядке. Сотрудник отмечается на постах, а система связывает эти отметки с маршрутом.' }}</p>
                  <p>{{ t('app.route.concept.dataCollection') || 'Статистика берется из отметок на постах (records): по каждой дате строится отдельное прохождение маршрута.' }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Statistics Info Toggle -->
      <div
        v-if="!routePassesLoading && !routePassesError && routePasses.length > 0"
        class="flex items-center gap-2 mb-2"
      >
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('app.route.statistics') || 'Статистика' }}</span>
        <button
          class="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          :title="t('app.route.stat.info') || 'Как считаются цифры'"
          @click="showStatInfoTooltip = !showStatInfoTooltip"
        >
          <UIcon
            name="i-heroicons-information-circle"
            class="w-4 h-4"
          />
        </button>
      </div>

      <!-- Statistics Info Panel -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[200px]"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 max-h-[200px]"
        leave-to-class="opacity-0 max-h-0"
      >
        <div
          v-if="showStatInfoTooltip"
          class="overflow-hidden mb-3"
        >
          <div class="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
            <div class="text-xs text-gray-700 dark:text-gray-300 space-y-1.5">
              <div class="flex items-start gap-2">
                <div class="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <UIcon
                    name="i-heroicons-arrow-path"
                    class="w-3 h-3 text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <span class="font-medium">{{ t('app.route.stat.total') || 'Всего' }}</span> — {{ t('app.route.stat.totalHint') || 'Количество прохождений маршрута за выбранный период (каждая дата = одно прохождение)' }}
                </div>
              </div>
              <div class="flex items-start gap-2">
                <div class="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <UIcon
                    name="i-heroicons-check-circle"
                    class="w-3 h-3 text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <span class="font-medium">{{ t('app.route.status.ok') || 'Успешно' }}</span> — {{ t('app.route.stat.completedHint') || 'Полные прохождения: есть отметки по всем постам и порядок соблюдён' }}
                </div>
              </div>
              <div class="flex items-start gap-2">
                <div class="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <UIcon
                    name="i-heroicons-exclamation-triangle"
                    class="w-3 h-3 text-orange-600 dark:text-orange-400"
                  />
                </div>
                <div>
                  <span class="font-medium">{{ t('app.route.status.partial') || 'Частично' }}</span> — {{ t('app.route.stat.partialHint') || 'Есть отметки только по части постов маршрута' }}
                </div>
              </div>
              <div class="flex items-start gap-2">
                <div class="w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <UIcon
                    name="i-heroicons-x-circle"
                    class="w-3 h-3 text-red-600 dark:text-red-400"
                  />
                </div>
                <div>
                  <span class="font-medium">{{ t('app.route.status.violation') || 'Нарушения' }}</span> — {{ t('app.route.stat.violatedHint') || 'Отметки есть, но порядок маршрута нарушен' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Statistics Grid -->
      <div
        v-if="!routePassesLoading && !routePassesError && routePasses.length > 0"
        class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2"
      >
        <!-- Total passes -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="i-heroicons-arrow-path"
                class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ routePasses.length }}
              </div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('app.route.stat.total') || 'Всего' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Completed -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="i-heroicons-check-circle"
                class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ routePasses.filter(p => p.status.toLowerCase() === 'completed').length }}
              </div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('app.route.status.ok') || 'Успешно' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Partial -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-5 h-5 text-orange-600 dark:text-orange-400"
              />
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ routePasses.filter(p => p.status.toLowerCase() === 'partial').length }}
              </div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('app.route.status.partial') || 'Частично' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Violations -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="i-heroicons-x-circle"
                class="w-5 h-5 text-red-600 dark:text-red-400"
              />
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ routePasses.filter(p => p.status.toLowerCase() === 'violated').length }}
              </div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('app.route.status.violation') || 'Нарушения' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
