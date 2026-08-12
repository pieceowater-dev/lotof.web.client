<script lang="ts" setup>
import AppTable from '@/components/ui/AppTable.vue';
import ShiftCoverageRequestModal from '@/components/atrace/ShiftCoverageRequestModal.vue';
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import type { AtraceShiftCoverage } from '@/api/atrace/schedule/coverage';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const { members, loadMembers } = useAtraceMembers(nsSlug);
const coverages = ref<AtraceShiftCoverage[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const canManage = ref(false);

const showModal = ref(false);

const memberNameById = computed(() => {
  const map = new Map<string, string>();
  members.value.forEach(m => map.set(m.userId, m.nickname || m.username || m.email || m.userId));
  return map;
});

const rows = computed(() => coverages.value
  .map(c => ({
    ...c,
    originalName: memberNameById.value.get(c.originalUserId) || c.originalUserId,
    coveringName: memberNameById.value.get(c.coveringUserId) || c.coveringUserId,
  }))
  .sort((a, b) => b.date.localeCompare(a.date)));

const columns = computed(() => ([
  { key: 'date', label: t('app.date') || 'Дата' },
  { key: 'originalName', label: t('app.coverageOriginal') || 'Кого подменяют' },
  { key: 'coveringName', label: t('app.coverageCovering') || 'Кто подменяет' },
  { key: 'status', label: t('common.status') || 'Статус' },
  { key: 'actions', label: t('common.actions') },
]));

const statusColor: Record<string, string> = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'red',
  cancelled: 'gray',
};
const statusLabel: Record<string, string> = {
  pending: t('app.coveragePending') || 'На согласовании',
  approved: t('app.coverageApproved') || 'Согласовано',
  rejected: t('app.coverageRejected') || 'Отклонено',
  cancelled: t('app.coverageCancelled') || 'Отменено',
};

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetShiftCoverages } = await import('@/api/atrace/schedule/coverage');
    coverages.value = await atraceGetShiftCoverages(undefined, undefined, undefined, nsSlug.value);
    canManage.value = true;
  } catch (e: any) {
    if (isAtracePermissionError(e, 'tracker.schedule.manage') || isAtracePermissionError(e, 'tracker.schedule.view')) {
      canManage.value = false;
      error.value = t('app.schedulePermissionError') || 'Недостаточно прав для просмотра всех подмен';
    } else {
      error.value = t('app.attendanceLoadFailed') || 'Не удалось загрузить';
    }
  } finally {
    loading.value = false;
  }
}

function openRequest() {
  showModal.value = true;
}

async function approve(row: AtraceShiftCoverage) {
  try {
    const { atraceApproveShiftCoverage } = await import('@/api/atrace/schedule/coverage');
    await atraceApproveShiftCoverage(row.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось согласовать';
  }
}

async function reject(row: AtraceShiftCoverage) {
  try {
    const { atraceRejectShiftCoverage } = await import('@/api/atrace/schedule/coverage');
    await atraceRejectShiftCoverage(row.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось отклонить';
  }
}

async function cancel(row: AtraceShiftCoverage) {
  try {
    const { atraceCancelShiftCoverage } = await import('@/api/atrace/schedule/coverage');
    await atraceCancelShiftCoverage(row.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось отменить';
  }
}

onMounted(async () => {
  await loadMembers();
  await load();
});
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-base font-medium">
        {{ t('app.shiftCoverage') || 'Подмены смен' }}
      </h2>
      <UButton
        size="xs"
        color="primary"
        icon="lucide:plus"
        @click="openRequest"
      >
        {{ t('app.requestCoverage') || 'Запросить подмену' }}
      </UButton>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
      {{ t('app.shiftCoverageHint') || 'Коллега может подменить сотрудника на смене; вступает в силу только после согласования руководителем' }}
    </p>

    <div
      v-if="error"
      class="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div
      v-if="loading"
      class="text-gray-500 text-sm"
    >
      {{ t('app.loading') }}
    </div>
    <div
      v-else-if="rows.length === 0"
      class="text-gray-500 text-center py-8"
    >
      {{ t('app.noCoverageRequests') || 'Запросов на подмену пока нет' }}
    </div>
    <div
      v-else
      class="flex-1 min-h-0 overflow-auto pb-safe-or-4"
    >
      <AppTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :total="rows.length"
        :pagination="false"
      >
        <template #status-data="{ row }">
          <span
            class="px-1.5 py-0.5 text-xs rounded"
            :class="`bg-${statusColor[row.status]}-100 dark:bg-${statusColor[row.status]}-900 text-${statusColor[row.status]}-800 dark:text-${statusColor[row.status]}-100`"
          >
            {{ statusLabel[row.status] || row.status }}
          </span>
        </template>
        <template #actions-data="{ row }">
          <div
            v-if="row.status === 'pending'"
            class="flex justify-end gap-1"
          >
            <UButton
              size="xs"
              variant="soft"
              color="emerald"
              icon="lucide:check"
              @click="approve(row)"
            >
              {{ t('app.approve') || 'Согласовать' }}
            </UButton>
            <UButton
              size="xs"
              variant="soft"
              color="red"
              icon="lucide:x"
              @click="reject(row)"
            >
              {{ t('app.reject') || 'Отклонить' }}
            </UButton>
            <UButton
              size="xs"
              variant="soft"
              color="gray"
              icon="lucide:ban"
              @click="cancel(row)"
            >
              {{ t('common.cancel') }}
            </UButton>
          </div>
        </template>
      </AppTable>
    </div>

    <ShiftCoverageRequestModal
      v-model="showModal"
      :ns-slug="nsSlug"
      @created="load"
    />
  </div>
</template>
