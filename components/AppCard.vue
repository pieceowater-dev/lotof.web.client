<template>
    <div class="flex items-center p-6 bg-white shadow-lg rounded-2xl w-96 h-60 text-left space-x-6">
        <div class="flex-1 flex flex-col justify-between items-start">
            <div>
                <!-- <UIcon :name="icon" class="text-4xl text-primary" /> -->
                <h3 class="text-xl font-bold">{{ title }}</h3>
                <p class="text-gray-500 text-sm">{{ description }}</p>
            </div>
            <UButton @click="onClick" color="primary" variant="outline" class="mt-4 w-fit">
                Открыть
            </UButton>
        </div>
        <!-- <div class="w-28 h-28 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden flex justify-center items-center">
        <slot name="screenshot"></slot>
      </div> -->

        <UIcon :name="icon" class="text-5xl text-primary" />

    </div>
</template>

<script setup>
defineProps({
    icon: String,
    title: String,
    description: String,
    onClick: Function
});
</script>