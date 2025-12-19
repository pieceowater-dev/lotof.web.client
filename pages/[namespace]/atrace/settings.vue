<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';

const { t } = useI18n();

// Types
type Member = {
    id: string;
    userId: string;
    username: string;
    email: string;
    roleId?: string | null;
    roleName?: string | null;
    requiredWorkingDays?: number;
    requiredWorkingHours?: number;
};

type Role = {
    id: string;
    name: string;
    permissionIds: string[];
};

const DEFAULT_REQUIRED_WORKING_DAYS = 22;
const DEFAULT_REQUIRED_WORKING_HOURS = 8;

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const members = ref<Member[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const columns = computed(() => ([
    { key: 'username', label: t('common.username') },
    { key: 'email', label: t('common.email') },
    { key: 'roleName', label: t('common.role') },
    { key: 'requiredWorkingDays', label: t('app.requiredWorkingDays') },
    { key: 'requiredWorkingHours', label: t('app.requiredWorkingHours') },
    { key: 'actions', label: t('common.actions') }
]));

// Pagination
const membersPage = ref(1);
const membersPageCount = ref(10);
const paginatedMembers = computed(() => {
    const start = (membersPage.value - 1) * membersPageCount.value;
    const end = start + membersPageCount.value;
    return members.value.slice(start, end);
});

// For modals
const isEditMemberOpen = ref(false);
const editingMember = ref<Member | null>(null);
const editForm = reactive<{ roleId: string; requiredWorkingDays: number; requiredWorkingHours: number }>({
    roleId: '',
    requiredWorkingDays: DEFAULT_REQUIRED_WORKING_DAYS,
    requiredWorkingHours: DEFAULT_REQUIRED_WORKING_HOURS
});

const { ensure: ensureAtraceToken } = useAtraceToken();

async function loadMembers() {
    loading.value = true;
    error.value = null;
    try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        if (!hubToken) {
            router.push('/');
            return;
        }

        // Get atrace token
        const atraceToken = await ensureAtraceToken();
        if (!atraceToken) {
            router.push('/');
            return;
        }

        // Get namespace ID from route or from API
        const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
        const ns = await hubNamespaceBySlug(hubToken, nsSlug.value);
        if (!ns?.id) {
            error.value = 'Namespace not found';
            return;
        }

        // Load members - using FIFTY to get more members
        const { hubMembersList } = await import('@/api/hub/members/list');
        const membersList = await hubMembersList(hubToken, ns.id, 1, 'FIFTY');
        
        // Load role assignments for each member from atrace API
        const { atraceGetMemberRole } = await import('@/api/atrace/role/getMemberRole');
        const { atraceGetSchedule } = await import('@/api/atrace/attendance/schedule');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        members.value = await Promise.all(
            membersList.map(async (m) => {
                try {
                    const [role, schedule] = await Promise.all([
                        atraceGetMemberRole(atraceToken, nsSlug.value, m.id),
                        atraceGetSchedule(atraceToken, nsSlug.value, m.id, currentYear, currentMonth).catch((err) => {
                            logError(`Failed to load schedule for member ${m.id}:`, err);
                            return null;
                        })
                    ]);
                    return {
                        ...m,
                        roleId: role?.id || null,
                        roleName: role?.name || null,
                        requiredWorkingDays: schedule?.shouldAttendDaysPerMonth ?? DEFAULT_REQUIRED_WORKING_DAYS,
                        requiredWorkingHours: schedule?.shouldAttendHoursPerDay ?? DEFAULT_REQUIRED_WORKING_HOURS
                    };
                } catch (err) {
                    logError(`Failed to load role for member ${m.id}:`, err);
                    return {
                        ...m,
                        roleId: null,
                        roleName: null,
                        requiredWorkingDays: DEFAULT_REQUIRED_WORKING_DAYS,
                        requiredWorkingHours: DEFAULT_REQUIRED_WORKING_HOURS
                    };
                }
            })
        );

    } catch (e: unknown) {
        error.value = getErrorMessage(e) || 'Failed to load members';
    } finally {
        loading.value = false;
    }
}

async function loadRoles() {
    try {
        const atraceToken = await ensureAtraceToken();
        if (!atraceToken) return;

        const { atraceGetRoles } = await import('@/api/atrace/role/getRoles');
        roles.value = await atraceGetRoles(atraceToken, nsSlug.value);
    } catch (e) {
        logError('Failed to load roles:', e);
        // Fallback to empty array on error
        roles.value = [];
    }
}

function openEditMember(member: Member) {
    editingMember.value = member;
    editForm.roleId = member.roleId || '';
    editForm.requiredWorkingDays = member.requiredWorkingDays ?? DEFAULT_REQUIRED_WORKING_DAYS;
    editForm.requiredWorkingHours = member.requiredWorkingHours ?? DEFAULT_REQUIRED_WORKING_HOURS;
    isEditMemberOpen.value = true;
}

async function handleSaveMember() {
    if (!editingMember.value) return;
    
    const atraceToken = await ensureAtraceToken();
    if (!atraceToken) {
        router.push('/');
        return;
    }

    try {
        const { atraceAssignRole, atraceRemoveRole } = await import('@/api/atrace/role/assign');
        const { atraceUpdateSchedule } = await import('@/api/atrace/attendance/schedule');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // Assign role via Atrace API if roleId is provided
        if (editForm.roleId) {
            await atraceAssignRole(atraceToken, nsSlug.value, editForm.roleId, editingMember.value.id);
        } else {
            // Remove role if empty
            const previousRoleId = editingMember.value.roleId;
            if (previousRoleId) {
                await atraceRemoveRole(atraceToken, nsSlug.value, previousRoleId, editingMember.value.id);
            }
        }

        // Force integers for required work params
        const requiredDays = Math.round(editForm.requiredWorkingDays);
        const requiredHours = Math.round(editForm.requiredWorkingHours);
        editForm.requiredWorkingDays = requiredDays;
        editForm.requiredWorkingHours = requiredHours;

        await atraceUpdateSchedule(
            atraceToken,
            nsSlug.value,
            editingMember.value.id,
            currentYear,
            currentMonth,
            requiredDays,
            requiredHours
        );
        
        // Close modal and reload members to get fresh data from backend
        isEditMemberOpen.value = false;
        editingMember.value = null;
        
        // Reload members to reflect changes from backend
        await loadMembers();
    } catch (e: unknown) {
        error.value = getErrorMessage(e) || 'Failed to update member';
    }
}

onMounted(async () => {
    const tok = await ensureAtraceToken(nsSlug.value, useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value);
    if (!tok) {
        setTimeout(() => router.push('/'), 0);
        return;
    }
    await loadRoles();
    await loadMembers();
});
</script>

<template>
    <div class="h-full flex flex-col p-4 min-h-0">
        <div class="flex justify-between items-center mb-4 flex-shrink-0">
            <div class="text-left">
                <h1 class="text-2xl font-semibold">{{ t('common.settings') }}</h1>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.atraceSettingsSubtitle') || 'Manage members, roles, and working days' }}</span>
            </div>
            <div>
                <UButton 
                    icon="lucide:arrow-left" 
                    size="xs" 
                    color="primary" 
                    variant="soft"
                    :to="`/${nsSlug}/atrace`"
                >
                    {{ t('app.back') }}
                </UButton>
            </div>
        </div>

        <!-- Members Management Section -->
    <div class="flex-1 min-h-0 flex flex-col">
            <h2 class="text-base font-medium mb-3">{{ t('app.members') || 'Members' }}</h2>
            
            <div v-if="loading" class="text-gray-500 text-sm">{{ t('app.loading') }}</div>
            <div v-else-if="error" class="text-red-500">{{ error }}</div>
            
            <div v-else-if="members.length === 0" class="text-gray-500 text-center py-8">
                {{ t('app.noMembers') || 'No members found' }}
            </div>

            <div v-else class="flex-1 min-h-0">
                <AppTable 
                    :rows="paginatedMembers" 
                    :columns="columns" 
                    :loading="loading"
                    v-model:page="membersPage"
                    v-model:pageCount="membersPageCount"
                    :total="members.length"
                    :pagination="true"
                >
                  <template #roleName-data="{ row }">
                    <span v-if="row.roleName" class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md">
                      {{ row.roleName }}
                    </span>
                    <span v-else class="text-gray-400 dark:text-gray-600 italic">
                      {{ t('app.noRole') || 'No role' }}
                    </span>
                  </template>
                  <template #actions-data="{ row }">
                    <div class="text-right">
                      <UButton size="xs" color="primary" variant="soft" icon="lucide:pencil" @click="openEditMember(row)">
                        {{ t('common.edit') || 'Edit' }}
                      </UButton>
                    </div>
                  </template>
                </AppTable>
            </div>
        </div>

        <!-- Edit Member Modal -->
        <UModal v-model="isEditMemberOpen">
            <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
                <template #header>
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                            {{ t('app.editMember') || 'Edit Member' }}
                        </h3>
                        <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="isEditMemberOpen = false" />
                    </div>
                </template>

                <div class="space-y-6" v-if="editingMember">
                    <!-- Member Info -->
                    <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div class="grid grid-cols-1 gap-3">
                            <div>
                                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {{ t('common.username') }}
                                </span>
                                <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                    {{ editingMember.username }}
                                </p>
                            </div>
                            <div>
                                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {{ t('common.email') }}
                                </span>
                                <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                    {{ editingMember.email }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Role Selection -->
                    <UFormGroup :label="t('common.role') || 'Role'" class="space-y-2">
                        <USelect 
                            v-model="editForm.roleId"
                            size="lg"
                            :options="[
                                { label: t('app.noRole') || 'No role', value: '' },
                                ...roles.map(r => ({ label: r.name, value: r.id }))
                            ]"
                            option-attribute="label"
                            value-attribute="value"
                        />
                    </UFormGroup>

                    <!-- Working Requirements -->
                    <div class="space-y-4">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                            {{ t('app.workingRequirements') || 'Working Requirements' }}
                        </h4>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <UFormGroup 
                                :label="t('app.requiredWorkingDays') || 'Required Days/Month'"
                                :help="t('app.requiredWorkingDaysHint') || 'Days per month'"
                            >
                                <UInput 
                                    v-model.number="editForm.requiredWorkingDays" 
                                    type="number"
                                    size="lg"
                                    min="0"
                                    max="31"
                                    step="1"
                                    inputmode="numeric"
                                    :placeholder="'22'"
                                />
                            </UFormGroup>

                            <UFormGroup 
                                :label="t('app.requiredWorkingHours') || 'Required Hours/Day'"
                                :help="t('app.requiredWorkingHoursHint') || 'Hours per day'"
                            >
                                <UInput 
                                    v-model.number="editForm.requiredWorkingHours" 
                                    type="number"
                                    size="lg"
                                    min="0"
                                    max="24"
                                    step="1"
                                    inputmode="numeric"
                                    :placeholder="'8'"
                                />
                            </UFormGroup>
                        </div>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <UButton 
                            icon="lucide:x" 
                            color="primary" 
                            variant="soft"
                            @click="isEditMemberOpen = false"
                        >
                            {{ t('common.cancel') || 'Cancel' }}
                        </UButton>
                        <UButton 
                            icon="lucide:check" 
                            color="primary"
                            @click="handleSaveMember"
                        >
                            {{ t('common.save') || 'Save' }}
                        </UButton>
                    </div>
                </template>
            </UCard>
        </UModal>
    </div>
</template>
