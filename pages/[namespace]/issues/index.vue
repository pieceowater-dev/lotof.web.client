<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useIssuesPlanLimits } from '@/composables/useIssuesPlanLimits';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { useConfirm } from '@/composables/useConfirm';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { dynamicLS } from '@/utils/storageKeys';
import BoardModal from '@/components/tasks/BoardModal.vue';
import type { TaskBoard } from '@/api/tasks/board/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { isOwnerOrManager } = useTasksStaffRole();
const { titleBySlug, idBySlug } = useNamespace();
const namespaceId = computed(() => idBySlug(nsSlug.value));

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `Issues — ${titleBySlug(nsSlug.value)}` : 'Issues',
}));

const boards = ref<TaskBoard[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

// A single board is the common case, and a namespace with several boards
// still has exactly one the user is "in" most of the time -- so this list
// page acts as a smart landing spot rather than something to click through
// every time: skip straight to the only board, or back to whichever one was
// last opened. `?pick=1` (set by the board page's "Boards" button) opts out
// so switching is always possible.
function redirectToBoard(target: TaskBoard) {
  navigateTo(`/${nsSlug.value}/issues/${target.slug}`, { replace: true });
}

function boardHasZenMode(b: TaskBoard): boolean {
  try {
    return !!(b.featureFlags ? JSON.parse(b.featureFlags).zen_mode : false);
  } catch {
    return false;
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const token = await getToken();
    const { tasksBoardsList } = await import('@/api/tasks/board/list');
    const res = await tasksBoardsList(token, nsSlug.value);
    boards.value = res.boards;
    if (route.query.pick !== '1' && boards.value.length) {
      // On a phone, "manage boards" isn't the useful landing view -- if Zen
      // Mode is available on any board, a courier/field worker almost
      // certainly wants their personal task queue instead of the desktop
      // kanban/board picker.
      if (process.client && window.innerWidth < 768 && boards.value.some(boardHasZenMode)) {
        navigateTo(`/${nsSlug.value}/issues/zen`, { replace: true });
        return;
      }
      if (boards.value.length === 1) {
        redirectToBoard(boards.value[0]);
        return;
      }
      const rememberedSlug = process.client ? localStorage.getItem(dynamicLS.tasksSelectedBoardSlug(nsSlug.value)) : null;
      const remembered = rememberedSlug ? boards.value.find((b) => b.slug === rememberedSlug) : null;
      if (remembered) {
        redirectToBoard(remembered);
        return;
      }
    }
  } catch (e) {
    logError('[tasks/index] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load boards';
  } finally {
    loading.value = false;
  }
}

const isModalOpen = ref(false);
const saving = ref(false);
const { isAtLimit, loadPlanLimits } = useIssuesPlanLimits();

function openCreate() {
  if (isAtLimit('max_boards', boards.value.length)) {
    useToast().add({ title: t('tasks.planLimitBoards') || 'Board limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }
  isModalOpen.value = true;
}
function openSettings(board: TaskBoard, ev: Event) {
  ev.stopPropagation();
  ev.preventDefault();
  navigateTo(`/${nsSlug.value}/issues/${board.slug}/settings`);
}

async function handleSubmit(payload: Record<string, any>) {
  saving.value = true;
  try {
    const token = await getToken();
    const { tasksCreateBoard } = await import('@/api/tasks/board/create');
    const created = await tasksCreateBoard(token, nsSlug.value, payload as any);
    boards.value = [...boards.value, created];
    useToast().add({ title: t('tasks.boardCreated') || 'Board created', color: 'primary' });
    isModalOpen.value = false;
  } catch (e) {
    logError('[tasks/index] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save board', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(board: TaskBoard, ev: Event) {
  ev.stopPropagation();
  ev.preventDefault();
  if (!(await confirm({ message: t('tasks.confirmDeleteBoard') || 'Delete this board and all of its issues?' }))) return;
  try {
    const token = await getToken();
    const { tasksDeleteBoard } = await import('@/api/tasks/board/delete');
    await tasksDeleteBoard(token, nsSlug.value, board.id);
    boards.value = boards.value.filter((b) => b.id !== board.id);
    useToast().add({ title: t('tasks.boardDeleted') || 'Board deleted', color: 'primary' });
  } catch (e) {
    logError('[tasks/index] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete board', color: 'red' });
  }
}

onMounted(() => {
  load();
  const { current } = useTasksToken();
  const token = current();
  if (token) loadPlanLimits(token, nsSlug.value);
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">{{ t('tasks.title') || 'Boards' }}</h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('tasks.subtitle') || 'Kanban boards for your team' }}</span>
      </div>
      <div class="flex items-center gap-2 self-start">
        <UButton
          v-if="isOwnerOrManager"
          icon="lucide:settings"
          size="xs"
          color="gray"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          :to="`/${nsSlug}/issues/settings`"
        >
          {{ t('tasks.settings') || 'Settings' }}
        </UButton>
        <UButton
          v-if="isOwnerOrManager"
          icon="lucide:plus"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          @click="openCreate"
        >
          {{ t('tasks.createBoard') || 'Create board' }}
        </UButton>
      </div>
    </div>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <div v-else-if="!boards.length" class="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
      <UIcon name="lucide:clipboard-check" class="w-10 h-10" />
      <p>{{ t('tasks.noBoards') || 'No boards yet' }}</p>
      <UButton v-if="isOwnerOrManager" icon="lucide:plus" color="primary" variant="soft" @click="openCreate">
        {{ t('tasks.createBoard') || 'Create board' }}
      </UButton>
    </div>

    <div v-else class="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
      <NuxtLink
        v-for="board in boards"
        :key="board.id"
        :to="`/${nsSlug}/issues/${board.slug}`"
        class="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40 flex-shrink-0">
              <UIcon name="lucide:layout-grid" class="w-4 h-4 text-primary-600 dark:text-primary-300" />
            </span>
            <div class="min-w-0">
              <div class="font-semibold truncate">{{ board.name }}</div>
              <UBadge v-if="!board.isActive" color="gray" variant="subtle" size="xs">{{ t('tasks.inactive') || 'Inactive' }}</UBadge>
            </div>
          </div>
          <div v-if="isOwnerOrManager" class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <UButton icon="lucide:settings" size="2xs" color="gray" variant="ghost" @click="openSettings(board, $event)" />
            <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleDelete(board, $event)" />
          </div>
        </div>
      </NuxtLink>
    </div>

    <BoardModal
      v-model="isModalOpen"
      :saving="saving"
      :is-first-board="boards.length === 0"
      :namespace-id="namespaceId"
      @submit="handleSubmit"
    />
  </div>
</template>
