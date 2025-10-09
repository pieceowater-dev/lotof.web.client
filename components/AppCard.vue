<template>
    <div class="flex items-center p-8 bg-gray-50 dark:bg-gray-800 shadow-lg rounded-2xl w-96 h-60 text-left space-x-6">
        <div class="flex-1 flex flex-col justify-between items-start">
            <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ title }}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm">{{ description }}</p>
            </div>
            <UButton
                @click="onClick"
                :disabled="!onClick"
                :color="onClick ? 'primary' : 'gray'"
                variant="outline"
                class="mt-4 w-fit"
                :label="onClick ? t('app.open') : t('app.comingSoon')"
            />
        </div>
        <UIcon :name="icon" class="text-5xl text-primary dark:text-primary-light" />
    </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

const props = defineProps<{
    icon: string
    title: string
    description: string
    onClick?: () => void | Promise<void>
}>();

const onClick = props.onClick;
const { title, description, icon } = props;
</script>