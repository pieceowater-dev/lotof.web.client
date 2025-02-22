<script lang="ts" setup>
import { ref } from 'vue';

defineProps<{ post: { title: string; address: string } }>();

const selected = ref(false);
</script>

<template>
    <div @click="selected = !selected"
        :class="selected ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'"
        class="shadow-md hover:shadow-sm p-4 rounded-xl w-60 cursor-pointer flex-shrink-0 min-h-[100px]">
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold">{{ post.title }}</h3>
            <UButton icon="i-lucide-pencil" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" />
        </div>
        <p class="text-sm" :class="selected ? 'text-white' : 'text-gray-600 dark:text-gray-100'">{{ post.address }}</p>
    </div>
</template>