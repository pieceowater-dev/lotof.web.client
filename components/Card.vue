<script lang="ts" setup>
import { ref, computed } from 'vue';

type Post = {
    id: string;
    title: string;
    description?: string | null;
    location?: { address?: string | null; city?: string | null; country?: string | null } | null;
};

const props = withDefaults(defineProps<{ post: Post; canDelete?: boolean }>(), { canDelete: false });
const emit = defineEmits<{ (e: 'edit', post: Post): void; (e: 'delete', post: Post): void }>();

const selected = ref(false);

function onEdit(e: MouseEvent) {
    e.stopPropagation();
    emit('edit', props.post);
}
function onDelete(e: MouseEvent) {
    e.stopPropagation();
    emit('delete', props.post);
}
const locationText = computed(() => {
    const parts = [props.post.location?.address || '', props.post.location?.city || ''].filter(Boolean)
    return parts.join(', ')
});

const hasDescription = computed(() => !!(props.post.description && props.post.description.trim().length > 0));
</script>

<template>
    <div @click="selected = !selected"
        :class="selected ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'"
        class="shadow-md hover:shadow-sm p-4 rounded-xl w-60 cursor-pointer flex-shrink-0 min-h-[100px]">
        <div class="flex items-center gap-2 mb-2">
            <h3 class="text-lg font-semibold truncate min-w-0 flex-1" :title="post.title">{{ post.title }}</h3>
            <div class="flex-none flex gap-1">
                <UButton @click="onEdit" icon="i-lucide-pencil" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" />
                <UButton v-if="canDelete" @click="onDelete" icon="i-lucide-trash-2" size="xs" color="red" :variant="selected ? 'solid' : 'ghost'" />
            </div>
        </div>
        <p v-if="locationText" class="text-sm truncate" :class="selected ? 'text-white' : 'text-gray-600 dark:text-gray-100'"
           :title="locationText">
            {{ locationText }}
        </p>
        <!-- Reserve space for one description line to keep cards equal height -->
        <div class="mt-1 h-5">
            <p v-if="hasDescription" class="text-xs truncate"
               :class="selected ? 'text-white/90' : 'text-gray-500 dark:text-gray-300'"
               :title="post.description || ''">
                {{ post.description }}
            </p>
        </div>
    </div>
</template>