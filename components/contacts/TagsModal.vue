<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '#imports';
import type { Tag } from '@/api/contacts/tags';
import { listTags, createTag, updateTag, deleteTag } from '@/api/contacts/tags';

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'tagCreated', tag: Tag): void;
}>();

const tags = ref<Tag[]>([]);
const loading = ref(false);
const isCreating = ref(false);
const newTagName = ref('');
const editingId = ref<string | null>(null);
const editingName = ref('');

const displayTags = computed(() => {
  if (editingId.value) {
    return tags.value.map(tag => 
      tag.id === editingId.value ? { ...tag, name: editingName.value } : tag
    );
  }
  return tags.value;
});

async function loadTags() {
  if (!token.value) return;
  try {
    loading.value = true;
    const response = await listTags(token.value);
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
  if (!newTagName.value.trim() || !token.value) return;
  
  try {
    isCreating.value = true;
    const newTag = await createTag(token.value, newTagName.value.trim());
    tags.value.push(newTag.createTag);
    newTagName.value = '';
    emit('tagCreated', newTag.createTag);
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
  if (!editingId.value || !editingName.value.trim() || !token.value) return;
  
  try {
    const updated = await updateTag(token.value, editingId.value, editingName.value.trim());
    const index = tags.value.findIndex(t => t.id === editingId.value);
    if (index !== -1) {
      tags.value[index] = updated.updateTag;
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
  if (!token.value) return;
  try {
    await deleteTag(token.value, id);
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
  <UModal :model-value="isOpen" @update:model-value="$emit('close')" title="Manage Tags">
    <div class="p-4 space-y-4">
      <!-- Create new tag -->
      <div class="flex gap-2">
        <UInput
          v-model="newTagName"
          placeholder="New tag name..."
          size="sm"
          @keyup.enter="handleCreateTag"
        />
        <UButton
          :loading="isCreating"
          @click="handleCreateTag"
          size="sm"
        >
          {{ t('common.add') }}
        </UButton>
      </div>

      <!-- Tags list -->
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="lucide:loader" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
        <div
          v-for="tag in displayTags"
          :key="tag.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div class="flex-1">
            <input
              v-if="editingId === tag.id"
              v-model="editingName"
              type="text"
              class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
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

        <div v-if="!loading && tags.length === 0" class="text-center py-8 text-gray-500 text-sm">
          No tags yet. Create one to get started.
        </div>
      </div>
    </div>
  </UModal>
</template>
