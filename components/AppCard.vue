<template>
  <div
    class="group relative overflow-hidden w-full min-h-[16rem] h-full rounded-3xl border p-6 sm:p-7 text-left transition-all duration-200"
    :class="[
      isInstalled
        ? 'border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        : (isAvailable
          ? 'border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          : 'border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800'),
      props.action
        ? 'shadow-sm hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md dark:hover:border-gray-600'
        : 'shadow-sm opacity-90'
    ]"
  >
    <div
      class="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-gradient-to-bl from-blue-200/35 via-emerald-100/25 to-transparent blur-2xl dark:from-blue-500/20 dark:via-emerald-500/10"
    />

    <div class="relative flex h-full flex-col gap-5">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
              {{ props.title }}
            </h3>

            <span
              class="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-normal whitespace-nowrap"
              :class="[
                isInstalled
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : (isAvailable
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-gray-700 dark:bg-gray-700/60 dark:text-gray-300')
              ]"
            >
              {{ isInstalled ? (t('app.statusInstalled') || 'Installed') : (isAvailable ? (t('app.statusAvailable') || 'Available') : (t('app.statusComingSoon') || 'Coming soon')) }}
            </span>
          </div>

          <p
            v-if="props.name"
            class="mt-1 text-sm text-gray-500 dark:text-gray-400 italic line-clamp-1"
          >
            {{ props.name }}
          </p>
        </div>

        <div
          class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border"
          :class="[
            isInstalled
              ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
              : (isAvailable
                ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500')
          ]"
        >
          <UIcon :name="props.icon" class="h-8 w-8" />
        </div>
      </div>

      <p class="text-sm leading-6 text-gray-600 dark:text-gray-300 line-clamp-3">
        {{ props.description }}
      </p>

      <div class="mt-auto pt-1">
        <UButton
          :disabled="!props.action"
          :color="props.action ? 'primary' : 'gray'"
          :variant="props.action ? 'solid' : 'soft'"
          :class="[
            'w-fit px-4',
            props.action ? 'shadow-sm group-hover:shadow' : '',
            isAvailable
              ? '!border-0 !text-white !bg-gradient-to-r !from-blue-600 !to-emerald-500 hover:!from-blue-700 hover:!to-emerald-600'
              : ''
          ]"
          :label="props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon'))"
          @click="props.action?.()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

const props = defineProps<{
    icon: string
    title: string
    name?: string
    description: string
    action?: () => void | Promise<void>
    installed?: boolean // if false -> show "Get App"
    canAdd?: boolean
}>();

const isInstalled = computed(() => !!props.installed);
const isAvailable = computed(() => !props.installed && !!props.canAdd);
</script>