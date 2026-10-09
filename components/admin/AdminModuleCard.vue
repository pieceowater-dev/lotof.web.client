<template>
  <NuxtLink
    :to="href"
    class="cn-card group"
    :class="status === 'coming' ? 'pointer-events-none opacity-50' : ''"
  >
    <div class="flex items-start justify-between gap-3">
      <span :class="['cn-ico', iconBg]">
        <Icon
          :name="icon"
          :class="['h-6 w-6', iconColor]"
        />
      </span>
      <span
        v-if="status === 'active'"
        class="cta-arrow !h-9 !w-9 !bg-slate-900/5 text-slate-600 dark:!bg-white/10 dark:text-slate-300"
      >
        <Icon
          name="lucide:arrow-up-right"
          class="h-4 w-4"
        />
      </span>
    </div>

    <h3 class="mt-5 flex items-center gap-2 text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
      {{ title }}
      <span
        v-if="status === 'coming'"
        class="at-chip !text-[10px] !font-bold uppercase"
      >
        {{ t('admin.comingSoon') }}
      </span>
    </h3>
    <p class="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-400">
      {{ description }}
    </p>
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

