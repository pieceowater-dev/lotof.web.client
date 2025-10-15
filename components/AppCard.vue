<template>
    <div class="flex items-center p-8 bg-gray-50 dark:bg-gray-800 shadow-lg rounded-2xl w-96 h-60 text-left space-x-6">
        <div class="flex-1 flex flex-col justify-between items-start">
            <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {{ props.title }}
                </h3>
                <p v-if="props.name" class="text-gray-500 dark:text-gray-400 text-m mb-2 font-thin italic">
                    «{{ props.name }}»
                </p>
                <p class="text-gray-600 dark:text-gray-400 text-sm">{{ props.description }}</p>
            </div>
            <UButton
                @click="props.action || (() => {})"
                :color="props.action ? 'primary' : 'gray'"
                variant="outline"
                :class="['mt-4 w-fit', !props.action ? 'cursor-wait' : '']"
                :label="props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon'))"
            />
        </div>
        <UIcon :name="props.icon" class="text-5xl text-primary dark:text-primary-light" />
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