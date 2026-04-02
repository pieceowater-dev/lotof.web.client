<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
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
const editInputRef = ref<HTMLInputElement | null>(null);
const selectedTagId = ref<string | null>(null);
const isAddingTag = ref(false);
const confirmDeleteId = ref<string | null>(null);

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
      description: t('contacts.tagsLoadError'),
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
    if (isSelectMode.value && props.clientId) {
      selectedTagId.value = newTag.id;
      await handleAddTag(newTag.id);
    }
    
    toast.add({
      title: t('common.success'),
      description: t('contacts.tagCreated'),
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: t('contacts.createTagError'),
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
      description: t('contacts.tagUpdated'),
      color: 'green',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: t('contacts.updateTagError'),
      color: 'red',
    });
  }
}

function requestDeleteTag(id: string) {
  confirmDeleteId.value = id;
}

function cancelDeleteTag() {
  confirmDeleteId.value = null;
}

async function handleDeleteTag(id: string) {
  if (!token.value || !selectedNS.value) return;
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    await deleteTag(contactsToken, selectedNS.value, id);
    tags.value = tags.value.filter(t => t.id !== id);
    confirmDeleteId.value = null;
    toast.add({
      title: t('common.success'),
      description: t('contacts.tagDeleted'),
      color: 'green',
    });
  } catch (error) {
    confirmDeleteId.value = null;
    toast.add({
      title: t('common.error'),
      description: t('contacts.deleteTagError'),
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
      description: t('contacts.tagAddedToClient'),
      color: 'green',
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Check if it's a duplicate key error
    if (errorMessage.includes('duplicate key') || errorMessage.includes('23505')) {
      toast.add({
        title: t('common.info'),
        description: t('contacts.tagAlreadyAssigned'),
        color: 'blue',
      });
      emit('close');
    } else {
      toast.add({
        title: t('common.error'),
        description: t('contacts.addTagError'),
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
  confirmDeleteId.value = null;
  nextTick(() => editInputRef.value?.focus());
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = '';
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadTags();
  } else {
    confirmDeleteId.value = null;
    editingId.value = null;
  }
});
</script>

<template>
  <UModal
    :model-value="isOpen"
    @update:model-value="$emit('close')"
  >
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          {{ isSelectMode ? t('contacts.addTagToClient') : t('contacts.manageTags') }}
        </h2>
        <UButton
          color="gray"
          variant="ghost"
          icon="lucide:x"
          class="-my-1"
          @click="$emit('close')"
        />
      </div>

      <!-- Create new tag -->
      <div class="flex gap-2">
        <UInput
          v-model="newTagName"
          :placeholder="isSelectMode ? t('contacts.newTagNameOrSelect') : t('contacts.newTagName')"
          size="sm"
          @keyup.enter="handleCreateTag"
        />
        <UButton
          :loading="isCreating"
          size="sm"
          @click="handleCreateTag"
        >
          {{ isSelectMode ? t('common.create') : t('common.add') }}
        </UButton>
      </div>

      <!-- Tags list -->
      <div
        v-if="loading"
        class="flex justify-center py-8"
      >
        <UIcon
          name="lucide:loader"
          class="w-6 h-6 animate-spin text-gray-400"
        />
      </div>

      <div
        v-else
        class="space-y-2 max-h-[400px] overflow-y-auto"
      >
        <!-- Select mode -->
        <template v-if="isSelectMode">
          <div
            v-for="tag in displayTags"
            :key="tag.id"
            class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            :class="{ 'ring-2 ring-blue-500': selectedTagId === tag.id }"
          >
            <!-- Name / inline edit -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <UIcon
                name="lucide:tag"
                class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <template v-if="editingId === tag.id">
                <input
                  ref="editInputRef"
                  v-model="editingName"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-0.5 text-sm border rounded bg-white dark:bg-gray-700 border-blue-400 dark:border-blue-500 outline-none ring-1 ring-blue-400"
                  @keyup.enter="handleUpdateTag"
                  @keyup.escape="cancelEdit"
                >
              </template>
              <span
                v-else
                class="text-sm font-medium truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                :title="t('contacts.doubleClickToRename')"
                @dblclick.stop="startEdit(tag)"
                @click.stop="confirmDeleteId !== tag.id && handleAddTag(tag.id)"
              >{{ tag.name }}</span>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 ml-2 flex-shrink-0">
              <!-- Save/cancel edit -->
              <template v-if="editingId === tag.id">
                <UButton
                  size="xs"
                  color="green"
                  variant="ghost"
                  icon="lucide:check"
                  @click.stop="handleUpdateTag"
                />
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:x"
                  @click.stop="cancelEdit"
                />
              </template>
              <!-- Confirm delete -->
              <template v-else-if="confirmDeleteId === tag.id">
                <span class="text-xs text-gray-500 dark:text-gray-400 mr-1">{{ t('contacts.areYouSure') }}</span>
                <UButton
                  size="xs"
                  color="red"
                  variant="solid"
                  icon="lucide:trash-2"
                  @click.stop="handleDeleteTag(tag.id)"
                />
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:x"
                  @click.stop="cancelDeleteTag()"
                />
              </template>
              <!-- Normal -->
              <template v-else>
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:pencil"
                  :title="t('contacts.renameTag')"
                  @click.stop="startEdit(tag)"
                />
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:trash-2"
                  :title="t('common.delete')"
                  @click.stop="requestDeleteTag(tag.id)"
                />
                <UButton
                  size="xs"
                  color="blue"
                  variant="soft"
                  icon="lucide:plus"
                  :loading="isAddingTag && selectedTagId === tag.id"
                  :title="t('contacts.addTagToClient')"
                  @click.stop="handleAddTag(tag.id)"
                />
              </template>
            </div>
          </div>
        </template>

        <!-- Manage mode -->
        <template v-else>
          <div
            v-for="tag in displayTags"
            :key="tag.id"
            class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 group/tag"
          >
            <!-- Name / inline edit -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <UIcon
                name="lucide:tag"
                class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <template v-if="editingId === tag.id">
                <input
                  ref="editInputRef"
                  v-model="editingName"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-0.5 text-sm border rounded bg-white dark:bg-gray-700 border-blue-400 dark:border-blue-500 outline-none ring-1 ring-blue-400"
                  @keyup.enter="handleUpdateTag"
                  @keyup.escape="cancelEdit"
                >
              </template>
              <span
                v-else
                class="text-sm font-medium truncate cursor-text select-none"
                :title="t('contacts.doubleClickToRename')"
                @dblclick="startEdit(tag)"
              >{{ tag.name }}</span>
              <!-- Pencil hint — visible on row hover when not editing -->
              <UIcon
                v-if="editingId !== tag.id && confirmDeleteId !== tag.id"
                name="lucide:pencil"
                class="w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover/tag:opacity-100 transition-opacity cursor-pointer hover:text-blue-500"
                :title="t('contacts.doubleClickToRename')"
                @click="startEdit(tag)"
              />
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 ml-2 flex-shrink-0">
              <template v-if="editingId === tag.id">
                <UButton
                  size="xs"
                  color="green"
                  variant="ghost"
                  icon="lucide:check"
                  @click="handleUpdateTag"
                />
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:x"
                  @click="cancelEdit"
                />
              </template>
              <template v-else-if="confirmDeleteId === tag.id">
                <span class="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">{{ t('contacts.areYouSure') }}</span>
                <UButton
                  size="xs"
                  color="red"
                  variant="solid"
                  icon="lucide:trash-2"
                  @click="handleDeleteTag(tag.id)"
                />
                <UButton
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="lucide:x"
                  @click="cancelDeleteTag()"
                />
              </template>
              <template v-else>
                <UButton
                  size="xs"
                  color="red"
                  variant="ghost"
                  icon="lucide:trash-2"
                  @click="requestDeleteTag(tag.id)"
                />
              </template>
            </div>
          </div>
        </template>

        <div
          v-if="!loading && tags.length === 0"
          class="text-center py-8 text-gray-500 text-sm"
        >
          {{ isSelectMode ? t('contacts.noTagsAvailable') : t('contacts.noTagsYet') }}
        </div>
      </div>
    </div>
  </UModal>
</template>
