<template>
    <div class="flex flex-col items-center justify-center text-center min-h-[65vh]">
        <span class="text-3xl mb-2">{{ greeting }}, <span class="font-semibold">{{ userName
                }}</span>!</span>
        <span class="text-lg text-gray-700 dark:text-gray-400 mb-4">Ваше пространство '{{ namespaceName }}'</span>
        <div class="flex gap-4 mt-2">
            <UButton icon="i-lucide-user-round-check" color="primary" variant="solid" :ui="{
                leadingIcon: 'text-(--ui-primary)'
            }" @click="onAction">
                Мои коллеги
            </UButton>
            <UButton variant="soft" @click="onAction">Редактировать профиль</UButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
    userName: {
        type: String,
        required: true
    },
    namespaceName: {
        type: String,
        required: true
    },
    onAction: { type: Function as PropType<(...args: any[]) => void>, default: () => { } }
});

const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return 'Доброй ночи';
  if (hours < 12) return 'Доброе утро';
  if (hours < 18) return 'Добрый день';
  return 'Добрый вечер';
});
</script>