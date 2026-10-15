<template>
  <div :class="stacked ? 'flex flex-col gap-3' : 'flex items-center gap-2'">
    <USelectMenu
      v-model="selectedTaskTypeIds"
      multiple
      :options="taskTypes.map((tt) => ({ label: tt.name, value: tt.id, icon: tt.icon }))"
      value-attribute="value"
      option-attribute="label"
      :class="stacked ? 'w-full' : 'w-36 flex-shrink-0'"
      :popper="{ strategy: 'fixed' }"
    >
      <template #label>
        <UIcon name="lucide:tags" class="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span class="truncate">{{ selectedTaskTypeIds.length ? selectedTaskTypeIds.length : (t('tasks.type') || 'Type') }}</span>
      </template>
      <template #option="{ option }">
        <UIcon :name="option.icon || 'lucide:shapes'" class="w-4 h-4 flex-shrink-0" />
        <span class="truncate">{{ option.label }}</span>
      </template>
    </USelectMenu>

    <USelectMenu
      v-model="selectedAssignee"
      :options="[{ label: t('tasks.anyAssignee') || 'Any assignee', value: '' }, ...memberOptions]"
      value-attribute="value"
      option-attribute="label"
      searchable
      :class="stacked ? 'w-full' : 'w-56 flex-shrink-0'"
      :popper="{ strategy: 'fixed' }"
    >
      <template #label>
        <UIcon name="lucide:user" class="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span class="truncate">{{ memberOptions.find((m) => m.value === selectedAssignee)?.label || (t('tasks.anyAssignee') || 'Any assignee') }}</span>
      </template>
      <template #option="{ option }">
        <UserAvatar v-if="option.value" :name="option.label" size="xs" />
        <UIcon v-else name="lucide:users" class="w-4 h-4 flex-shrink-0" />
        <span class="truncate">{{ option.label }}</span>
      </template>
    </USelectMenu>

    <button
      type="button"
      class="pill-filter inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
      :class="[myTasksOnly ? 'pill-filter--active' : '', stacked ? 'w-full !py-2.5' : 'flex-shrink-0']"
      :aria-pressed="myTasksOnly"
      @click="myTasksOnly = !myTasksOnly"
    >
      <UIcon name="lucide:user-check" class="w-4 h-4" />
      {{ t('tasks.myTasks') || 'My tasks' }}<span v-if="myOpenCount" class="tabular-nums opacity-70">· {{ myOpenCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { useI18n } from '@/composables/useI18n';
import type { TaskType } from '@/api/tasks/tasktype/list';

// The "who / what kind" filters of the Issues board, rendered inline in the filter
// row on desktop and stacked inside the filter sheet on phones -- the same three
// controls and the same state, so the two layouts can never drift apart.
defineProps<{
  taskTypes: TaskType[];
  memberOptions: { label: string; value: string }[];
  myOpenCount: number;
  stacked?: boolean;
}>();

const selectedTaskTypeIds = defineModel<string[]>('taskTypeIds', { required: true });
const selectedAssignee = defineModel<string>('assignee', { required: true });
const myTasksOnly = defineModel<boolean>('myTasksOnly', { required: true });

const { t } = useI18n();
</script>
