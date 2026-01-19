<template>
    <div class="flex flex-col md:flex-row items-center md:items-start p-4 md:p-8 bg-gray-50 dark:bg-gray-800 shadow-lg rounded-2xl w-full md:w-96 text-center md:text-left space-y-4 md:space-y-0 md:space-x-6">
        <div class="flex-1 flex flex-col justify-between items-center md:items-start w-full md:w-auto">
            <div class="w-full">
                <h3 class="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                    {{ props.title }}
                </h3>
                <p v-if="props.name" class="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-2 font-thin italic">
                    «{{ props.name }}»
                </p>
                <p class="text-gray-600 dark:text-gray-400 text-xs md:text-sm">{{ props.description }}</p>
            </div>
            <UButton
                @click="props.action?.()"
                :disabled="!props.action"
                :color="props.action ? 'primary' : 'gray'"
                variant="outline"
                :class="['mt-4 w-full md:w-fit']"
                :label="props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon'))"
            />
        </div>
        <UIcon :name="props.icon" class="text-4xl md:text-5xl text-primary dark:text-primary-light flex-shrink-0" />
    </div>
</template>

<script setup lang="ts">
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
</script>