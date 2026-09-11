<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Post } from '@/types/atrace';

const props = defineProps<{
  posts: Post[];
  selectedPostId: string | null;
  showSkeletons: boolean;
  canCreate?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:selectedPostId', value: string): void;
  (e: 'create'): void;
}>();

const { t } = useI18n();

// "All locations" is '' everywhere outside this component (selectedPostId
// prop/emit, index.vue, PostsCardScroller, AttendancePanel all compare
// against ''). Nuxt UI's USelectMenu can't actually display that selection
// though -- its internal `label` computed starts with `if (!props.modelValue)
// return null`, and '' is falsy, so the field silently renders blank
// whenever "all locations" is selected (confirmed: the dropdown itself
// still shows the right item checked, only the closed-field label is
// empty). ALL_SENTINEL is purely local plumbing to give USelectMenu a
// truthy value to key off of; get/set translate it back to '' at the prop
// boundary so nothing outside this component has to know about it.
const ALL_SENTINEL = '__all__';
const selectedPostIdForMenu = computed({
  get: () => {
    const id = props.selectedPostId ?? '';
    return id === '' ? ALL_SENTINEL : id;
  },
  set: (val: string) => emit('update:selectedPostId', val === ALL_SENTINEL ? '' : val),
});

const menuOptions = computed(() => [
  ...(props.posts.length > 0 ? [{ value: ALL_SENTINEL, label: t('app.allLocations') || 'All locations' }] : []),
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
        <label for="posts-mobile-selector" class="text-sm font-medium whitespace-nowrap">{{ t('app.location') || 'Локация' }}:</label>
        <USelectMenu
          id="posts-mobile-selector"
          v-model="selectedPostIdForMenu"
          :options="menuOptions"
          value-attribute="value"
          class="flex-1"
          :ui="{ menu: { popper: { base: 'z-[9999]' } } }"
        />
        <UButton
          v-if="canCreate"
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
