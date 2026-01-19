<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();
const { 
    greeting, 
    username, 
    allNamespaces, 
    currentNamespace 
} = defineProps<{ 
    greeting: string, 
    username: string, 
    allNamespaces: string[], 
    currentNamespace: string 
}>();

// Map slug -> title using composable cache
const { titleBySlug } = useNamespace();
const currentNsLabel = computed(() => titleBySlug(currentNamespace) || currentNamespace);

const emit = defineEmits(['edit-profile', 'edit-people', 'switch-namespace']);

const items: { label: string; click: () => void }[][] = [
    allNamespaces.map((ns: string) => ({ label: titleBySlug(ns) || ns, click: () => emit('switch-namespace', ns) }))
];

</script>

<template>
    <div class="flex flex-col items-center justify-center text-center min-h-[50vh] md:min-h-[65vh] px-2">
        <span class="text-xl md:text-3xl mb-2">{{ greeting }}, <span class="font-semibold">{{ username }}</span>!</span>
        <span class="text-sm md:text-base mb-4">
                    {{ t('app.currentNamespace') }} —
            <UDropdown 
                :items="items" 
                mode="hover" 
                :popper="{ offsetDistance: 0, placement: 'bottom-start' }" 
            >
                <UButton
                    icon="i-lucide-chevron-down"
                    size="md" md:size="lg"
                    color="primary"
                    variant="link"
                    :label="currentNsLabel"
                    :trailing="true"
                />
            </UDropdown>
        </span>
        <div class="flex flex-wrap gap-2 md:gap-4 mt-4 justify-center">
            <UButton @click="emit('edit-people')" icon="i-lucide-user-round-check" color="primary" variant="solid" size="sm" md:size="md">
                {{ t('app.myPeople') }}
            </UButton>
            <UButton variant="soft" size="sm" md:size="md" @click="emit('edit-profile')">{{ t('app.configureProfile') }}</UButton>
        </div>
    </div>
</template>
