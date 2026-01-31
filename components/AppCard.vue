<template>
    <div class="flex items-center p-8 bg-gray-50 dark:bg-gray-800 shadow-md rounded-2xl w-94 h-60 text-left gap-6 overflow-hidden">
        <div class="flex-1 flex flex-col justify-between items-start min-w-0 pr-2">
            <div class="min-w-0">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 break-words whitespace-normal leading-snug">
                    {{ props.title }}
                </h3>
                <p v-if="props.name" class="text-gray-500 dark:text-gray-400 text-m mb-2 font-thin italic break-words whitespace-normal">
                    «{{ props.name }}»
                </p>
                <p class="text-gray-600 dark:text-gray-400 text-sm break-words whitespace-normal">
                    {{ props.description }}
                </p>
            </div>
            <UButton
                @click="props.action?.()"
                :disabled="!props.action"
                :color="props.action ? 'primary' : 'gray'"
                variant="outline"
                :class="['mt-4 w-fit']"
                :label="props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon'))"
            />
        </div>
        <UIcon :name="props.icon" class="w-14 h-14 text-primary dark:text-primary-light flex-shrink-0" />
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