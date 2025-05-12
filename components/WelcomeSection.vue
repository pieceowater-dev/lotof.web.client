<script setup lang="ts">
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

const emit = defineEmits(['edit-profile', 'edit-people', 'switch-namespace']);

const items: { label: string; click: () => void }[][] = [allNamespaces
  .map((ns: string) => ({ label: ns, click: () => emit('switch-namespace', ns) }))];

</script>

<template>
    <div class="flex flex-col items-center justify-center text-center min-h-[65vh]">
        <span class="text-3xl mb-2">{{ greeting }}, <span class="font-semibold">{{ username }}</span>!</span>
        <span class="text-l mb-2">
            Текущее пространство —
            <UDropdown 
                :items="items" 
                mode="hover" 
                :popper="{ offsetDistance: 0, placement: 'bottom-start' }" 
            >
                <UButton
                    
                    icon="i-lucide-chevron-down"
                    size="xl"
                    color="primary"
                    variant="link"
                    :label="currentNamespace"
                    :trailing="true"
                />
            </UDropdown>
        </span>
        <div class="flex gap-4 mt-2">
            <UButton @click="emit('edit-people')" icon="i-lucide-user-round-check" color="primary" variant="solid">
                Мои люди
            </UButton>
            <UButton variant="soft" @click="emit('edit-profile')">Настроить профиль</UButton>
        </div>
    </div>
</template>
