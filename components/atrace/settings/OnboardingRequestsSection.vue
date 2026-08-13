<script lang="ts" setup>
import AppTable from '@/components/ui/AppTable.vue';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { useAuth } from '@/composables/useAuth';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import type { AtraceOnboardingRequest } from '@/api/atrace/onboarding/onboarding';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const { load: loadNamespaces, idBySlug } = useNamespace();
const { token: hubToken } = useAuth();

const requests = ref<AtraceOnboardingRequest[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const decidingId = ref<string | null>(null);

const rows = computed(() => requests.value.slice().sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));

const columns = computed(() => ([
  { key: 'username', label: t('app.onboardingUser') || 'Пользователь' },
  { key: 'email', label: t('common.email') || 'Email' },
  { key: 'postTitle', label: t('app.onboardingPost') || 'Точка' },
  { key: 'status', label: t('common.status') || 'Статус' },
  { key: 'actions', label: t('common.actions') },
]));

const statusColor: Record<string, string> = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'red',
};
const statusLabel: Record<string, string> = {
  pending: t('app.coveragePending') || 'На согласовании',
  approved: t('app.coverageApproved') || 'Согласовано',
  rejected: t('app.coverageRejected') || 'Отклонено',
};

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetOnboardingRequests } = await import('@/api/atrace/onboarding/onboarding');
    requests.value = await atraceGetOnboardingRequests(undefined, nsSlug.value);
  } catch (e: any) {
    if (isAtracePermissionError(e)) {
      error.value = t('app.settingsAccessDenied') || 'Недостаточно прав';
    } else {
      error.value = t('app.attendanceLoadFailed') || 'Не удалось загрузить';
    }
  } finally {
    loading.value = false;
  }
}

async function approve(row: AtraceOnboardingRequest) {
  decidingId.value = row.id;
  try {
    // Two independent steps, same split as everywhere else in this codebase
    // that adds someone to a namespace then activates them in atrace
    // (subscribePlan-style multi-step orchestration): hub's own namespace
    // membership first (owner's own session), then atrace's decision, which
    // on approval also attempts SetMemberActive respecting the plan's
    // max_employees limit server-side.
    await loadNamespaces();
    const nsId = idBySlug(nsSlug.value);
    const tok = hubToken.value;
    if (nsId && tok) {
      const { hubAddMember } = await import('@/api/hub/members/mutations');
      try {
        await hubAddMember(tok, nsId, row.userId);
      } catch (_e) {
        // Already a namespace member (e.g. re-approving after a race) --
        // proceed to the atrace decision regardless.
      }
    }

    const { atraceDecideOnboardingRequest } = await import('@/api/atrace/onboarding/onboarding');
    await atraceDecideOnboardingRequest(row.id, true, nsSlug.value);
    await load();
  } catch (_e: any) {
    useToast().add({ title: t('app.notification'), description: t('app.saveFailed') || 'Не удалось согласовать', color: 'red' });
  } finally {
    decidingId.value = null;
  }
}

async function reject(row: AtraceOnboardingRequest) {
  decidingId.value = row.id;
  try {
    const { atraceDecideOnboardingRequest } = await import('@/api/atrace/onboarding/onboarding');
    await atraceDecideOnboardingRequest(row.id, false, nsSlug.value);
    await load();
  } catch (_e: any) {
    useToast().add({ title: t('app.notification'), description: t('app.saveFailed') || 'Не удалось отклонить', color: 'red' });
  } finally {
    decidingId.value = null;
  }
}

onMounted(async () => {
  await load();
});
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-base font-medium">
        {{ t('app.onboardingRequests') || 'Заявки на вступление' }}
      </h2>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
      {{ t('app.onboardingRequestsHint') || 'Сотрудник отсканировал QR, но ещё не в команде A-Trace -- подтвердите или отклоните заявку' }}
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
      {{ t('app.noOnboardingRequests') || 'Заявок на вступление пока нет' }}
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
        <template #email-data="{ row }">
          {{ row.email || '—' }}
        </template>
        <template #postTitle-data="{ row }">
          {{ row.postTitle || '—' }}
        </template>
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
            v-if="row.status !== 'approved'"
            class="flex justify-end gap-1"
          >
            <UButton
              size="xs"
              variant="soft"
              color="emerald"
              icon="lucide:check"
              :loading="decidingId === row.id"
              :disabled="decidingId !== null"
              @click="approve(row)"
            >
              {{ t('app.acceptOnboarding') || 'Принять' }}
            </UButton>
            <UButton
              v-if="row.status === 'pending'"
              size="xs"
              variant="soft"
              color="red"
              icon="lucide:x"
              :loading="decidingId === row.id"
              :disabled="decidingId !== null"
              @click="reject(row)"
            >
              {{ t('app.reject') || 'Отклонить' }}
            </UButton>
          </div>
        </template>
      </AppTable>
    </div>
  </div>
</template>
