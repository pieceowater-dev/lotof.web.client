<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { useToast } from '#imports';
import { addTagToClient, removeTagFromClient } from '@/api/contacts/tags';

interface Tag {
  id: string;
  name: string;
}

interface Props {
  tags: Tag[];
  clientId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tagAdded', tag: Tag): void;
  (e: 'tagRemoved', tagId: string): void;
  (e: 'openTagsModal'): void;
}>();

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { ensure } = useContactsToken();
const { selected: selectedNS } = useNamespace();

const localTags = ref<Tag[]>([...props.tags]);
const isRemoving = ref<string | null>(null);

// Watch for external tag changes
watch(() => props.tags, (newTags) => {
  localTags.value = [...newTags];
}, { deep: true });

async function handleRemoveTag(tagId: string) {
  if (!props.clientId || !token.value || !selectedNS.value) return;

  try {
    isRemoving.value = tagId;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    await removeTagFromClient(contactsToken, selectedNS.value, props.clientId, tagId);
    localTags.value = localTags.value.filter(t => t.id !== tagId);
    emit('tagRemoved', tagId);
    
    toast.add({
      title: t('common.success'),
      description: 'Tag removed',
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to remove tag',
      color: 'red',
    });
  } finally {
    isRemoving.value = null;
  }
}

function openTagsModal() {
  emit('openTagsModal');
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <UIcon name="i-heroicons-tag" class="w-5 h-5 text-rose-500 dark:text-rose-400" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.contacts.tags') }}</h2>
    </div>
    <div class="px-5 py-5">
      <div class="flex flex-wrap gap-2">
        <div
          v-for="tag in localTags"
          :key="tag.id"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 shadow-sm"
        >
          <UIcon name="lucide:tag" class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span>{{ tag.name }}</span>
          <button
            v-if="clientId"
            :disabled="isRemoving === tag.id"
            @click="handleRemoveTag(tag.id)"
            class="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-0.5"
            :title="isRemoving === tag.id ? 'Removing...' : 'Remove tag'"
          >
            <UIcon 
              :name="isRemoving === tag.id ? 'i-lucide-loader-2' : 'lucide:x'" 
              :class="['w-3 h-3', isRemoving === tag.id && 'animate-spin']"
            />
          </button>
        </div>
        
        <button
          v-if="clientId"
          @click="openTagsModal"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-sm font-medium transition-colors"
        >
          <UIcon name="lucide:plus" class="w-4 h-4" />
          <span>Add tag</span>
        </button>
        
        <span v-if="localTags.length === 0 && !clientId" class="text-gray-400 text-sm">—</span>
      </div>
    </div>
  </div>
</template>
