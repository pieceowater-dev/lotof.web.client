<script lang="ts" setup>
import AppTable from '@/components/ui/AppTable.vue';
import EditMemberModal from '@/components/atrace/settings/EditMemberModal.vue';
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const {
  members, roles, loading, error,
  membersPage, membersPageCount, paginatedMembers,
  isEditMemberOpen, editingMember, editForm,
  loadMembers, loadRoles, openEditMember, handleSaveMember, toggleMemberActive,
} = useAtraceMembers(nsSlug);

const columns = computed(() => ([
  { key: 'username', label: t('common.username') },
  { key: 'email', label: t('common.email') },
  { key: 'roleName', label: t('common.role') },
  { key: 'requiredWorkingDays', label: t('app.requiredWorkingDays') },
  { key: 'requiredWorkingHours', label: t('app.requiredWorkingHours') },
  { key: 'isActive', label: t('atrace.members.status') },
  { key: 'actions', label: t('common.actions') }
]));

onMounted(async () => {
  await loadRoles();
  await loadMembers();
});
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <h2 class="text-base font-medium mb-3">
      {{ t('app.members') || 'Members' }}
    </h2>

    <div
      v-if="loading"
      class="text-gray-500 text-sm"
    >
      {{ t('app.loading') }}
    </div>
    <div
      v-else-if="error"
      class="text-red-500"
    >
      {{ error }}
    </div>

    <div
      v-else-if="members.length === 0"
      class="text-gray-500 text-center py-8"
    >
      {{ t('app.noMembers') || 'No members found' }}
    </div>

    <div
      v-else
      class="flex-1 min-h-0 overflow-auto pb-safe-or-4 member-table"
    >
      <AppTable
        v-model:page="membersPage"
        v-model:page-count="membersPageCount"
        :rows="paginatedMembers"
        :columns="columns"
        :loading="loading"
        :total="members.length"
        :pagination="true"
      >
        <template #roleName-data="{ row }">
          <span
            v-if="row.roleName"
            class="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-md"
          >
            {{ row.roleName }}
          </span>
          <span
            v-else
            class="text-gray-400 dark:text-gray-600 italic"
          >
            {{ t('app.noRole') || 'No role' }}
          </span>
        </template>
        <template #isActive-data="{ row }">
          <UToggle
            v-model="row.isActive"
            @update:model-value="toggleMemberActive(row)"
          />
        </template>
        <template #actions-data="{ row }">
          <div class="text-right">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="lucide:pencil"
              @click="openEditMember(row)"
            >
              {{ t('common.edit') || 'Edit' }}
            </UButton>
          </div>
        </template>
      </AppTable>
    </div>

    <EditMemberModal
      v-model="isEditMemberOpen"
      v-model:form="editForm"
      :member="editingMember"
      :roles="roles"
      @save="handleSaveMember"
    />
  </div>
</template>

<style scoped>
/* Make text columns wider and numeric columns compact */
.member-table :deep(thead th:nth-child(1)),
.member-table :deep(tbody td:nth-child(1)) { /* username */
    width: 24%;
}

.member-table :deep(thead th:nth-child(2)),
.member-table :deep(tbody td:nth-child(2)) { /* email */
    width: 32%;
}

.member-table :deep(thead th:nth-child(3)),
.member-table :deep(tbody td:nth-child(3)) { /* roleName */
    width: 20%;
}

.member-table :deep(thead th:nth-child(4)),
.member-table :deep(tbody td:nth-child(4)) { /* requiredWorkingDays */
    width: 10%;
    text-align: right;
}

.member-table :deep(thead th:nth-child(5)),
.member-table :deep(tbody td:nth-child(5)) { /* requiredWorkingHours */
    width: 10%;
    text-align: right;
}

.member-table :deep(thead th:nth-child(6)),
.member-table :deep(tbody td:nth-child(6)) { /* actions */
    width: 4%;
}

/* Ensure long text wraps/ellipsis properly */
.member-table :deep(tbody td) {
    white-space: nowrap;
}
.member-table :deep(tbody td span.truncate) {
    display: inline-block;
    max-width: 100%;
}
</style>
