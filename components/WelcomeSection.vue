<script setup lang="ts">
defineProps<{ greeting: string, username: string }>();
const emit = defineEmits(['edit-profile']);
</script>

<template>
    <div class="flex flex-col items-center justify-center text-center min-h-[65vh]">
        <span class="text-3xl mb-2">{{ greeting }}, <span class="font-semibold">{{ username }}</span>!</span>
        <div class="flex gap-4 mt-2">
            <UButton icon="i-lucide-user-round-check" color="primary" variant="solid">
                Мои коллеги
            </UButton>
            <UButton variant="soft" @click="emit('edit-profile')">Редактировать профиль</UButton>
        </div>
    </div>
</template>
