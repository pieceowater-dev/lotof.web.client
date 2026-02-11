<script lang="ts" setup>
const props = defineProps<{
  modelValue: boolean;
  title: string;
  showEditWarning?: boolean;
  editWarning?: string;
  nameLabel: string;
  namePlaceholder: string;
  postsLabel: string;
  postsHint: string;
  selectPlaceholder: string;
  emptyText: string;
  cancelLabel: string;
  saveLabel: string;
  error?: string | null;
  saving?: boolean;
  routeTitle: string;
  selectedPostId: string;
  selectedPostIds: string[];
  postOptions: Array<{ label: string; value: string }>;
  getPostLabel: (postId: string) => string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:routeTitle', value: string): void;
  (e: 'update:selectedPostId', value: string): void;
  (e: 'update:selectedPostIds', value: string[]): void;
  (e: 'save'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const routeTitleModel = computed({
  get: () => props.routeTitle,
  set: (value) => emit('update:routeTitle', value),
});

const selectedPostIdModel = computed({
  get: () => props.selectedPostId,
  set: (value) => emit('update:selectedPostId', value),
});

const dragIndex = ref<number | null>(null);

function updateSelectedPostIds(next: string[]) {
  emit('update:selectedPostIds', next);
}

function handleSelect(postId: string) {
  if (!postId) return;
  if (props.selectedPostIds.includes(postId)) {
    emit('update:selectedPostId', '');
    return;
  }
  updateSelectedPostIds([...props.selectedPostIds, postId]);
  emit('update:selectedPostId', '');
}

function handleRemove(index: number) {
  const next = [...props.selectedPostIds];
  next.splice(index, 1);
  updateSelectedPostIds(next);
}

function handleMove(index: number, dir: -1 | 1) {
  const nextIndex = index + dir;
  if (nextIndex < 0 || nextIndex >= props.selectedPostIds.length) return;
  const next = [...props.selectedPostIds];
  const temp = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = temp;
  updateSelectedPostIds(next);
}

function handleDragStart(index: number) {
  dragIndex.value = index;
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function handleDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null;
    return;
  }
  const next = [...props.selectedPostIds];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, moved);
  updateSelectedPostIds(next);
  dragIndex.value = null;
}

function handleDragEnd() {
  dragIndex.value = null;
}

function handleTouchStart(index: number) {
  dragIndex.value = index;
}

function handleTouchMove(event: TouchEvent) {
  if (dragIndex.value === null) return;
  const touch = event.touches[0];
  if (!touch) return;
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const row = target?.closest('[data-route-post-index]') as HTMLElement | null;
  if (!row) return;
  const indexAttr = row.getAttribute('data-route-post-index');
  const overIndex = indexAttr ? Number(indexAttr) : NaN;
  if (Number.isNaN(overIndex) || overIndex === dragIndex.value) return;
  const next = [...props.selectedPostIds];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(overIndex, 0, moved);
  updateSelectedPostIds(next);
  dragIndex.value = overIndex;
  event.preventDefault();
}

function handleTouchEnd() {
  dragIndex.value = null;
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ container: 'items-center' }">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
            {{ title }}
          </h3>
          <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="isOpen = false" />
        </div>
      </template>

      <div class="space-y-4">
        <div v-if="showEditWarning" class="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200 px-3 py-2 rounded-md">
          {{ editWarning }}
        </div>
        <UFormGroup :label="nameLabel">
          <UInput v-model="routeTitleModel" size="lg" :placeholder="namePlaceholder" />
        </UFormGroup>

        <UFormGroup :label="postsLabel" :help="postsHint">
          <div class="flex flex-col sm:flex-row gap-2">
            <USelectMenu
              v-model="selectedPostIdModel"
              :options="postOptions"
              option-attribute="label"
              value-attribute="value"
              :placeholder="selectPlaceholder"
              class="flex-1 min-w-0"
              @update:model-value="handleSelect"
            />
          </div>

          <div v-if="selectedPostIds.length === 0" class="text-xs text-gray-500 mt-2">
            {{ emptyText }}
          </div>
          <div v-else class="mt-3 space-y-2">
            <div
              v-for="(postId, index) in selectedPostIds"
              :key="`${postId}-${index}`"
              class="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 px-3 py-2"
              :data-route-post-index="index"
              draggable="true"
              @dragstart="handleDragStart(index)"
              @dragover="handleDragOver"
              @drop="handleDrop(index)"
              @dragend="handleDragEnd"
              @touchstart.passive="handleTouchStart(index)"
              @touchmove="handleTouchMove"
              @touchend="handleTouchEnd"
              @touchcancel="handleTouchEnd"
            >
              <div class="flex items-center gap-2 text-sm">
                <UIcon name="i-heroicons-bars-3" class="w-4 h-4 text-gray-400" />
                <span class="font-semibold">#{{ index + 1 }}</span>
                <span class="ml-1">{{ getPostLabel(postId) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <UButton size="xs" variant="soft" icon="lucide:arrow-up" @click="handleMove(index, -1)" />
                <UButton size="xs" variant="soft" icon="lucide:arrow-down" @click="handleMove(index, 1)" />
                <UButton size="xs" variant="soft" color="red" icon="lucide:x" @click="handleRemove(index)" />
              </div>
            </div>
          </div>
        </UFormGroup>

        <div v-if="error" class="text-sm text-red-500">{{ error }}</div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="primary" variant="soft" @click="isOpen = false">
            {{ cancelLabel }}
          </UButton>
          <UButton color="primary" icon="lucide:check" :loading="saving" @click="$emit('save')">
            {{ saveLabel }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
