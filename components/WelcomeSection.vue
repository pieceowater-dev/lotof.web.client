<script setup lang="ts">
defineProps<{ greeting: string, username: string, namespace: string }>();
const emit = defineEmits(['edit-profile', 'edit-people']);
</script>

<template>
    <div class="flex flex-col items-center justify-center text-center min-h-[65vh]">
        <span class="text-3xl mb-2">{{ greeting }}, <span class="font-semibold">{{ username }}</span>!</span>
        <span class="text-l mb-2">Текущее пространство - <span class="font-semibold">"{{ namespace }}"</span></span>
        <div class="flex gap-4 mt-2">
            <UButton @click="emit('edit-people')" icon="i-lucide-user-round-check" color="primary" variant="solid">
                Мои люди
            </UButton>
            <UButton variant="soft" @click="emit('edit-profile')">Настроить профиль</UButton>
        </div>
    </div>
</template>
