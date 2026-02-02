<template>
    <div class="flex items-center px-8 py-10 sm:px-8 sm:py-10 bg-gray-50 dark:bg-gray-800 shadow-md rounded-2xl w-full min-h-[15rem] h-full text-left gap-6 overflow-hidden">
        <div class="flex-1 flex flex-col items-start min-w-0 pr-2 h-full">
            <div class="min-w-0">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                    {{ props.title }}
                </h3>
                <p v-if="props.name" class="text-gray-500 dark:text-gray-400 text-m mb-2 font-thin italic line-clamp-2">
                    «{{ props.name }}»
                </p>
                <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                    {{ props.description }}
                </p>
            </div>
            <UButton
                @click="props.action?.()"
                :disabled="!props.action"
                :color="props.action ? 'primary' : 'gray'"
                variant="outline"
                :class="['mt-auto w-fit']"
                :label="props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon'))"
            />
        </div>
        <UIcon :name="props.icon" class="w-16 h-16 text-primary dark:text-primary-light flex-shrink-0" />
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