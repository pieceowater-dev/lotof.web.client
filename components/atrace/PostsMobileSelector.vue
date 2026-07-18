<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Post } from '@/types/atrace';

const props = defineProps<{
  posts: Post[];
  selectedPostId: string | null;
  showSkeletons: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:selectedPostId', value: string): void;
  (e: 'create'): void;
}>();

const { t } = useI18n();

// USelectMenu doesn't accept null, so bridge selectedPostId (which can be
// null before posts finish loading) through an empty-string-safe computed.
const selectedPostIdForMenu = computed({
  get: () => props.selectedPostId ?? '',
  set: (val: string) => emit('update:selectedPostId', val),
});

const menuOptions = computed(() => [
  ...(props.posts.length > 0 ? [{ value: '', label: t('app.allLocations') || 'All locations' }] : []),
  ...props.posts.filter(p => p.title && p.title.trim()).map(p => {
    const parts = [p.title.trim()];
    if (p.location?.city?.trim()) parts.push(p.location.city);
    if (p.location?.address?.trim()) parts.push(p.location.address);
    return { value: p.id, label: parts.join(' — ') };
  })
]);
</script>

<template>
  <div
    class="md:hidden px-4 py-4 flex-shrink-0"
    data-tour="posts-list-mobile"
  >
    <template v-if="showSkeletons">
      <div class="flex gap-2 items-center">
        <USkeleton class="h-4 w-20" />
        <USkeleton class="h-9 flex-1" />
        <USkeleton class="h-9 w-10" />
      </div>
    </template>
    <template v-else>
      <div class="flex gap-2 items-center">
        <label class="text-sm font-medium whitespace-nowrap">{{ t('app.location') || 'Локация' }}:</label>
        <USelectMenu
          v-model="selectedPostIdForMenu"
          :options="menuOptions"
          value-attribute="value"
          class="flex-1"
          :ui="{ menu: { popper: { base: 'z-[9999]' } } }"
        />
        <UButton
          data-tour="create-post-btn-mobile"
          icon="lucide:plus"
          size="sm"
          color="primary"
          variant="soft"
          @click="emit('create')"
        />
      </div>
    </template>
  </div>
</template>
