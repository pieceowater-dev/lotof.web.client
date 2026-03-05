<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { useToast } from '#imports';
import type { Tag } from '@/api/contacts/tags';
import { listTags, createTag, updateTag, deleteTag, addTagToClient } from '@/api/contacts/tags';

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { ensure } = useContactsToken();
const { selected: selectedNS } = useNamespace();

const props = defineProps<{
  isOpen: boolean;
  mode?: 'manage' | 'select'; // 'manage' for CRUD, 'select' for choosing tags for a client
  clientId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'tagCreated', tag: Tag): void;
  (e: 'tagAdded', tag: Tag): void;
}>();

const tags = ref<Tag[]>([]);
const loading = ref(false);
const isCreating = ref(false);
const newTagName = ref('');
const editingId = ref<string | null>(null);
const editingName = ref('');
const selectedTagId = ref<string | null>(null);
const isAddingTag = ref(false);

const mode = computed(() => props.mode || 'manage');
const isSelectMode = computed(() => mode.value === 'select');

const displayTags = computed(() => {
  if (editingId.value) {
    return tags.value.map(tag => 
      tag.id === editingId.value ? { ...tag, name: editingName.value } : tag
    );
  }
  return tags.value;
});

async function loadTags() {
  if (!token.value || !selectedNS.value) return;
  try {
    loading.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const response = await listTags(contactsToken, selectedNS.value);
    tags.value = response.tags?.rows || [];
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to load tags',
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function handleCreateTag() {
  if (!newTagName.value.trim() || !token.value || !selectedNS.value) return;
  
  try {
    isCreating.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const response = await createTag(contactsToken, selectedNS.value, newTagName.value.trim());
    const newTag = response.createTag;
    tags.value.push(newTag);
    newTagName.value = '';
    emit('tagCreated', newTag);
    
    // If in select mode, immediately select and add the new tag
    if (isSelectMode && props.clientId) {
      selectedTagId.value = newTag.id;
      await handleAddTag(newTag.id);
    }
    
    toast.add({
      title: t('common.success'),
      description: 'Tag created successfully',
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to create tag',
      color: 'red',
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleUpdateTag() {
  if (!editingId.value || !editingName.value.trim() || !token.value || !selectedNS.value) return;
  
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const response = await updateTag(contactsToken, selectedNS.value, editingId.value, editingName.value.trim());
    const index = tags.value.findIndex(t => t.id === editingId.value);
    if (index !== -1) {
      tags.value[index] = response.updateTag;
    }
    editingId.value = null;
    editingName.value = '';
    toast.add({
      title: t('common.success'),
      description: 'Tag updated successfully',
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to update tag',
      color: 'red',
    });
  }
}

async function handleDeleteTag(id: string) {
  if (!token.value || !selectedNS.value) return;
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    await deleteTag(contactsToken, selectedNS.value, id);
    tags.value = tags.value.filter(t => t.id !== id);
    toast.add({
      title: t('common.success'),
      description: 'Tag deleted successfully',
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to delete tag',
      color: 'red',
    });
  }
}

async function handleAddTag(tagId: string) {
  if (!props.clientId || !token.value || !selectedNS.value) return;
  
  try {
    isAddingTag.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    await addTagToClient(contactsToken, selectedNS.value, props.clientId, tagId);
    const tag = tags.value.find(t => t.id === tagId);
    if (tag) {
      emit('tagAdded', tag);
    }
    
    emit('close');
    toast.add({
      title: t('common.success'),
      description: 'Tag added to client',
      color: 'green',
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Check if it's a duplicate key error
    if (errorMessage.includes('duplicate key') || errorMessage.includes('23505')) {
      toast.add({
        title: t('common.info'),
        description: 'This tag is already assigned to the client',
        color: 'blue',
      });
      emit('close');
    } else {
      toast.add({
        title: t('common.error'),
        description: 'Failed to add tag',
        color: 'red',
      });
    }
  } finally {
    isAddingTag.value = false;
  }
}

function startEdit(tag: Tag) {
  editingId.value = tag.id;
  editingName.value = tag.name;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = '';
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadTags();
  }
});
</script>

<template>
  <UModal :model-value="isOpen" @update:model-value="$emit('close')" :title="isSelectMode ? 'Add tag to client' : 'Manage Tags'">
    <div class="p-4 space-y-4">
      <!-- Create new tag -->
      <div class="flex gap-2">
        <UInput
          v-model="newTagName"
          :placeholder="isSelectMode ? 'New tag name or select below...' : 'New tag name...'"
          size="sm"
          @keyup.enter="handleCreateTag"
        />
        <UButton
          :loading="isCreating"
          @click="handleCreateTag"
          size="sm"
        >
          {{ isSelectMode ? t('common.create') : t('common.add') }}
        </UButton>
      </div>

      <!-- Tags list -->
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="lucide:loader" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
        <!-- Select mode: just show tags to select -->
        <template v-if="isSelectMode">
          <div
            v-for="tag in displayTags"
            :key="tag.id"
            @click="handleAddTag(tag.id)"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            :class="{ 'ring-2 ring-blue-500': selectedTagId === tag.id }"
          >
            <div class="flex items-center gap-2">
              <UIcon name="lucide:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span class="text-sm font-medium">{{ tag.name }}</span>
            </div>
            <UIcon 
              v-if="isAddingTag && selectedTagId === tag.id"
              name="lucide:loader-2" 
              class="w-4 h-4 animate-spin text-blue-500"
            />
            <UIcon
              v-else
              name="lucide:plus-circle"
              class="w-4 h-4 text-gray-400 hover:text-blue-500"
            />
          </div>
        </template>

        <!-- Manage mode: show all CRUD operations -->
        <template v-else>
          <div
            v-for="tag in displayTags"
            :key="tag.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-2 flex-1">
              <UIcon name="lucide:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <input
                v-if="editingId === tag.id"
                v-model="editingName"
                type="text"
                class="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                @keyup.enter="handleUpdateTag"
                @keyup.escape="cancelEdit"
              />
              <span v-else class="text-sm font-medium">{{ tag.name }}</span>
            </div>
            <div class="flex gap-1">
              <UButton
                v-if="editingId === tag.id"
                size="xs"
                color="green"
                variant="ghost"
                icon="lucide:check"
                @click="handleUpdateTag"
              />
              <UButton
                v-else
                size="xs"
                color="blue"
                variant="ghost"
                icon="lucide:edit-2"
                @click="startEdit(tag)"
              />
              <UButton
                v-if="editingId === tag.id"
                size="xs"
                color="gray"
                variant="ghost"
                icon="lucide:x"
                @click="cancelEdit"
              />
              <UButton
                v-else
                size="xs"
                color="red"
                variant="ghost"
                icon="lucide:trash-2"
                @click="handleDeleteTag(tag.id)"
              />
            </div>
          </div>
        </template>

        <div v-if="!loading && tags.length === 0" class="text-center py-8 text-gray-500 text-sm">
          {{ isSelectMode ? 'No tags available. Create one first.' : 'No tags yet. Create one to get started.' }}
        </div>
      </div>
    </div>
  </UModal>
</template>
