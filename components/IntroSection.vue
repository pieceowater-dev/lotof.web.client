<template>
  <div class="flex flex-col items-center justify-center min-h-[65vh] text-center">
    <div class="flex flex-col items-center justify-center my-10">
      <img src="/assets/logo.png" alt="Logo" class="h-20 w-20" />
      <span class="text-5xl font-thin text-primary">{{ title || t('app.title') }}</span>
    </div>
    <span class="text-3xl font-bold mr-2 ml-2">{{ subtitle || t('app.tagline') }}</span>
    <span class="text-xl text-gray-600 dark:text-gray-400 mr-2 ml-2">{{ description || t('app.description') }}</span>

    <UButton icon="i-lucide-rocket" color="primary" variant="solid" :ui="{ leadingIcon: 'text-(--ui-primary)' }" class="mt-8" @click="onAction">
      {{ buttonText || t('app.login') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  onAction: { type: Function as PropType<(...args: any[]) => void>, default: () => { } }
});
</script>