<template>
  <NuxtLink
    :to="href"
    :class="[
      'group relative rounded-2xl border-2 p-8 transition-all duration-300',
      'transform hover:scale-105',
      status === 'coming'
        ? 'pointer-events-none border-slate-200 opacity-50 dark:border-slate-800'
        : 'border-transparent hover:shadow-2xl cursor-pointer',
      bgGradient
    ]"
  >
    <!-- Background glow effect -->
    <div
      :class="[
        'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
        status === 'active' && 'group-hover:shadow-inner'
      ]"
    />

    <!-- Content -->
    <div class="relative z-10">
      <!-- Icon -->
      <div :class="['mb-6 inline-flex rounded-xl p-3', iconBg]">
        <Icon
          :name="icon"
          :class="['h-8 w-8', iconColor]"
        />
      </div>

      <!-- Title -->
      <h3 class="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
        {{ title }}
        <span
          v-if="status === 'coming'"
          class="inline-block rounded bg-slate-300 dark:bg-slate-600 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {{ t('admin.comingSoon') }}
        </span>
      </h3>

      <!-- Description -->
      <p class="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {{ description }}
      </p>

      <!-- Arrow indicator (visible on hover for active items) -->
      <div
        v-if="status === 'active'"
        class="mt-6 inline-flex gap-2 text-sm font-semibold text-slate-900 dark:text-white opacity-0 transition-all duration-300 group-hover:opacity-100"
      >
        <span>{{ t('admin.open') }}</span>
        <Icon
          name="lucide:arrow-right"
          class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
        />
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

interface Props {
  title: string;
  description: string;
  icon: string;
  status?: 'active' | 'coming';
  href: string;
  bgGradient?: string;
  iconBg?: string;
  iconColor?: string;
}

const { t } = useI18n();

const props = withDefaults(defineProps<Props>(), {
  status: 'active',
  bgGradient: 'bg-white dark:bg-slate-900',
  iconBg: 'bg-blue-100 dark:bg-blue-900/30',
  iconColor: 'text-blue-600 dark:text-blue-400',
});
</script>

