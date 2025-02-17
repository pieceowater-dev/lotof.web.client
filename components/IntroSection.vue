<template>
  <div class="flex flex-col items-center justify-center min-h-[70vh] text-center">
    <div class="flex flex-col items-center justify-center my-10">
      <img src="/assets/logo.png" alt="Logo" class="h-20 w-20" />
      <span class="text-5xl font-thin text-primary">{{ title }}</span>
    </div>
    <span class="text-3xl font-bold">{{ subtitle }}</span>
    <span class="text-xl text-gray-600 dark:text-gray-400">{{ description }}</span>

    <UButton icon="i-lucide-rocket" color="primary" variant="solid" :ui="{
      leadingIcon: 'text-(--ui-primary)'
    }" class="mt-8" @click="onAction">
      {{ buttonText }}
    </UButton>
  </div>


</template>

<script setup lang="ts">
defineProps({
  title: { type: String, default: 'lota' },
  subtitle: { type: String, default: 'Все, что надо.' },
  description: { type: String, default: 'Сервисы для успешной работы в команде' },
  buttonText: { type: String, default: 'Войти' },
  onAction: { type: Function as PropType<(...args: any[]) => void>, default: () => { } }
});
</script>