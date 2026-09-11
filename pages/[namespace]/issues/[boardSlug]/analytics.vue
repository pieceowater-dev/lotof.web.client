<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import FunnelAnalytics from '@/components/tasks/FunnelAnalytics.vue';
import type { FunnelStageDef } from '@/composables/useIssuesFunnelAnalytics';
import type { TaskBoard } from '@/api/tasks/board/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);
const { titleBySlug } = useNamespace();

// Management view — same gate as Board settings.
const { role: staffRole, isOwnerOrManager } = useTasksStaffRole();
watch(staffRole, (r) => {
  if (r && !isOwnerOrManager.value) navigateTo(`/${nsSlug.value}/issues/${boardSlug.value}`);
}, { immediate: true });

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const board = ref<TaskBoard | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

useHead(() => ({
  title: board.value?.name
    ? `${t('tasks.funnelTitle') || 'Analytics'} — ${board.value.name} — Issues${titleBySlug(nsSlug.value) ? ` — ${titleBySlug(nsSlug.value)}` : ''}`
    : `${t('tasks.funnelTitle') || 'Analytics'} — Issues`,
}));

const stages = computed<FunnelStageDef[]>(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      key: String(s.key || ''),
      label: String(s.label || s.key || ''),
      isTerminal: !!s.is_terminal,
      outcome: s.outcome === 'won' || s.outcome === 'lost' ? s.outcome : '',
      color: String(s.color || ''),
    }));
  } catch {
    return [];
  }
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const token = await getToken();
    const { tasksBoardsList } = await import('@/api/tasks/board/list');
    const res = await tasksBoardsList(token, nsSlug.value);
    board.value = res.boards.find((b) => b.slug === boardSlug.value) || null;
    if (!board.value) {
      navigateTo(`/${nsSlug.value}/issues`);
    }
  } catch (e) {
    logError('[tasks/analytics] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load board';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center gap-2 mb-4 flex-shrink-0">
      <UButton icon="lucide:arrow-left" size="xs" color="gray" variant="soft" :to="`/${nsSlug}/issues/${boardSlug}`">
        {{ t('app.back') || 'Back' }}
      </UButton>
      <h1 class="text-xl sm:text-2xl font-semibold truncate">
        {{ t('tasks.funnelTitle') || 'Funnel analytics' }} — {{ board?.name || '...' }}
      </h1>
    </div>

    <div v-if="error" class="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div v-if="loading && !board" class="flex-1 flex items-center justify-center text-gray-400">
      <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <FunnelAnalytics
      v-else-if="board"
      class="flex-1 min-h-0"
      :ns-slug="nsSlug"
      :board-id="board.id"
      :board-slug="boardSlug"
      :stages="stages"
    />
  </div>
</template>
