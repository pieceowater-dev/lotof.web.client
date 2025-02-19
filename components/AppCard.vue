<template>
    <div class="flex items-center p-6 bg-gray-100 dark:bg-gray-800 shadow-lg rounded-2xl w-96 h-60 text-left space-x-6">
        <div class="flex-1 flex flex-col justify-between items-start">
            <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ title }}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm">{{ description }}</p>
            </div>
            <UButton 
                @click="onClick" 
                :disabled="!onClick" 
                :color="onClick ? 'primary' : 'neutral'" 
                variant="outline" 
                class="mt-4 w-fit"
            >
                {{ onClick ? 'Открыть' : 'Скоро...' }}
            </UButton>
        </div>
        <UIcon :name="icon" class="text-5xl text-primary dark:text-primary-light" />
    </div>
</template>

<script setup lang="ts">
defineProps({
    icon: String,
    title: String,
    description: String,
    onClick: {
        type: Function,
        default: null
    }
});
</script>