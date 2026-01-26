<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { setUnauthorizedHandler } from '@/api/clients';
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

// Cache to prevent duplicate requests
let loadMembersPromise: Promise<void> | null = null;

// For modals
const isEditMemberOpen = ref(false);
const editingMember = ref<Member | null>(null);
const editForm = reactive<{ roleId: string; requiredWorkingDays: number; requiredWorkingHours: number }>({
    roleId: '',
    requiredWorkingDays: DEFAULT_REQUIRED_WORKING_DAYS,
    requiredWorkingHours: DEFAULT_REQUIRED_WORKING_HOURS
});

const { ensure: ensureAtraceToken } = useAtraceToken();

// Invite form state
const inviteEmail = ref('');
const inviteRoleId = ref<string>('');
const inviteDays = ref<number>(DEFAULT_REQUIRED_WORKING_DAYS);
const inviteHours = ref<number>(DEFAULT_REQUIRED_WORKING_HOURS);
const inviteSubmitting = ref(false);
const inviteError = ref<string | null>(null);
const isInviteOpen = ref(false);
const isValidInviteEmail = computed(() => {
    const email = inviteEmail.value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
});
const inviteCanSubmit = computed(() => isValidInviteEmail.value && !inviteSubmitting.value);

function buildActionsJson(): string {
    const ops: Array<any> = [];
    console.log('[buildActionsJson] inviteRoleId:', inviteRoleId.value);
    const roleIdNum = inviteRoleId.value ? parseInt(inviteRoleId.value, 10) : NaN;
    console.log('[buildActionsJson] roleIdNum:', roleIdNum);
    if (!Number.isNaN(roleIdNum)) {
        ops.push({ op: 'assign_role', params: { roleId: roleIdNum } });
    }
    const d = Math.max(0, Math.round(inviteDays.value));
    const h = Math.max(0, Math.round(inviteHours.value));
    ops.push({ op: 'create_schedule', params: { workDays: d, hoursPerDay: h } });
    console.log('[buildActionsJson] final ops:', ops);
    return JSON.stringify({ version: 1, 'pieceowater.atrace': ops });
}

async function submitInvite() {
    inviteError.value = null;
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!hubToken) {
        router.push('/');
        return;
    }
    const email = inviteEmail.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        inviteError.value = t('app.invalidEmail') || 'Enter a valid email';
        return;
    }
    try {
        inviteSubmitting.value = true;
        const { hubCreateInvite } = await import('@/api/hub/invite/create');
        const actions = buildActionsJson();
        console.log('[submitInvite] actions:', actions);
        // default expiresAt: 30 days
        const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        await hubCreateInvite(hubToken, {
            namespaceSlug: nsSlug.value,
            email,
            actions,
            expiresAt
        });
        useToast().add({ title: t('app.notification'), description: t('app.sendInvite') || 'Invite sent', color: 'primary' });
        inviteEmail.value = '';
        isInviteOpen.value = false;
    } catch (e: any) {
        inviteError.value = e?.response?.errors?.[0]?.message || e?.message || 'Failed to create invite';
    } finally {
        inviteSubmitting.value = false;
    }
}

async function loadMembers() {
    // Prevent duplicate concurrent requests
    if (loadMembersPromise) {
        return loadMembersPromise;
    }

    loading.value = true;
    error.value = null;
    
    loadMembersPromise = (async () => {
        try {
            const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
            if (!hubToken) {
                router.push('/');
                return;
            }

            // Get atrace token
            const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
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
            
            // Load role and schedule for each member using combined query
            const { atraceGetMemberRoleAndSchedule } = await import('@/api/atrace/member/getMemberWithRoleAndSchedule');
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            members.value = await Promise.all(
                membersList.map(async (m) => {
                    try {
                        // Try with userId first (new style)
                        let data = await atraceGetMemberRoleAndSchedule(
                            atraceToken,
                            nsSlug.value,
                            m.userId,
                            currentYear,
                            currentMonth
                        );
                        
                        // If no data, try with memberId (old style for owner)
                        if (!data.role) {
                            data = await atraceGetMemberRoleAndSchedule(
                                atraceToken,
                                nsSlug.value,
                                m.id,
                                currentYear,
                                currentMonth
                            );
                        }
                        
                        return {
                            ...m,
                            roleId: data.role?.id || null,
                            roleName: data.role?.name || null,
                            requiredWorkingDays: data.schedule?.shouldAttendDaysPerMonth ?? DEFAULT_REQUIRED_WORKING_DAYS,
                            requiredWorkingHours: data.schedule?.shouldAttendHoursPerDay ?? DEFAULT_REQUIRED_WORKING_HOURS
                        };
                    } catch (err) {
                        logError(`Failed to load role/schedule for member ${m.userId}/${m.id}:`, err);
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
            loadMembersPromise = null;
        }
    })();

    return loadMembersPromise;
}

async function loadRoles() {
    try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) return;

        const { atraceGetRoles } = await import('@/api/atrace/role/getRoles');
        roles.value = await atraceGetRoles(atraceToken, nsSlug.value);
        console.log('[loadRoles] loaded roles:', roles.value);
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
    
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
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
        
        // Try to use userId first for assignment (new style), fall back to memberId (old style)
        const primaryMemberId = editingMember.value.userId;
        const fallbackMemberId = editingMember.value.id;
        
        // Assign role via Atrace API if roleId is provided
        if (editForm.roleId) {
            try {
                await atraceAssignRole(atraceToken, nsSlug.value, editForm.roleId, primaryMemberId);
            } catch (err) {
                // If userId fails, try memberId
                logError(`Failed to assign role with userId, trying memberId:`, err);
                await atraceAssignRole(atraceToken, nsSlug.value, editForm.roleId, fallbackMemberId);
            }
        } else {
            // Remove role if empty
            const previousRoleId = editingMember.value.roleId;
            if (previousRoleId) {
                try {
                    await atraceRemoveRole(atraceToken, nsSlug.value, previousRoleId, primaryMemberId);
                } catch (err) {
                    // If userId fails, try memberId
                    logError(`Failed to remove role with userId, trying memberId:`, err);
                    await atraceRemoveRole(atraceToken, nsSlug.value, previousRoleId, fallbackMemberId);
                }
            }
        }

        // Force integers for required work params
        const requiredDays = Math.round(editForm.requiredWorkingDays);
        const requiredHours = Math.round(editForm.requiredWorkingHours);
        editForm.requiredWorkingDays = requiredDays;
        editForm.requiredWorkingHours = requiredHours;

        try {
            await atraceUpdateSchedule(
                atraceToken,
                nsSlug.value,
                primaryMemberId,
                currentYear,
                currentMonth,
                requiredDays,
                requiredHours
            );
        } catch (err) {
            // If userId fails, try memberId
            logError(`Failed to update schedule with userId, trying memberId:`, err);
            await atraceUpdateSchedule(
                atraceToken,
                nsSlug.value,
                fallbackMemberId,
                currentYear,
                currentMonth,
                requiredDays,
                requiredHours
            );
        }
        
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
    // Redirect to index on atrace token unauthorized
    setUnauthorizedHandler(() => {
        try { useAtraceToken().clear(); } catch {}
        router.push('/');
    });
    const tok = await ensureAtraceToken(nsSlug.value, useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value);
    if (!tok) {
        setTimeout(() => router.push('/'), 0);
        return;
    }
    await loadRoles();
    await loadMembers();
});

onUnmounted(() => {
    // Remove handler to avoid affecting other pages
    setUnauthorizedHandler(null);
});
</script>

<template>
    <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
        <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
            <div class="text-left">
                <h1 class="text-2xl font-semibold">{{ t('common.settings') }}</h1>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.atraceSettingsSubtitle') || 'Manage members, roles, and working days' }}</span>
            </div>
            <div class="flex flex-row justify-between items-center gap-2 w-full md:w-auto">
                <UButton 
                    icon="lucide:user-plus" 
                    size="xs" 
                    color="primary" 
                    @click="isInviteOpen = true"
                    class="flex-1 md:flex-none whitespace-nowrap"
                >
                    {{ t('app.sendInvite') || 'Send Invitation' }}
                </UButton>
                <UButton 
                    icon="lucide:arrow-left" 
                    size="xs" 
                    color="primary" 
                    variant="soft"
                    :to="`/${nsSlug}/atrace`"
                    class="flex-1 md:flex-none"
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

                        <div v-else class="flex-1 min-h-0 overflow-x-auto member-table">
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
        <UModal v-model="isEditMemberOpen" :ui="{ container: 'items-center' }">
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

        <!-- Create Invite Modal -->
        <UModal v-model="isInviteOpen" :ui="{ container: 'items-center justify-center' }">
            <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', base: 'w-full max-w-2xl', body: { base: 'w-full' } }">
                <template #header>
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                                {{ t('app.sendInvite') || 'Send Invitation' }}
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {{ t('app.namespace') || 'Namespace' }}: <span class="font-medium">{{ nsSlug }}</span>
                            </p>
                        </div>
                        <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="isInviteOpen = false" />
                    </div>
                </template>

                <div class="space-y-6">
                    <!-- Email -->
                    <div>
                        <UFormGroup :label="t('common.email') || 'Email'" :help="t('app.searchEmailPlaceholder')" class="space-y-2">
                            <UInput 
                                v-model="inviteEmail" 
                                type="email" 
                                size="lg" 
                                :placeholder="'name@example.com'"
                                :state="inviteEmail && !isValidInviteEmail ? 'error' : 'success'"
                            />
                            <p v-if="inviteEmail && !isValidInviteEmail" class="text-xs text-red-500">
                                {{ t('app.invalidEmail') || 'Please enter a valid email' }}
                            </p>
                        </UFormGroup>
                    </div>

                    <!-- Role -->
                    <div>
                        <UFormGroup :label="t('common.role') || 'Role'" class="space-y-2">
                            <USelectMenu 
                                v-model="inviteRoleId"
                                size="lg"
                                :options="[
                                    { label: t('app.noRole') || 'No role', value: '' },
                                    ...roles.map(r => ({ label: r.name, value: r.id }))
                                ]"
                                option-attribute="label"
                                value-attribute="value"
                                :placeholder="t('app.selectRole') || 'Select a role'"
                            />
                        </UFormGroup>
                    </div>

                    <!-- Working Requirements -->
                    <div>
                        <div style="display: none">
                            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                {{ t('app.workingRequirements') || 'Working Requirements' }}
                            </h4>
                            <div class="grid grid-cols-2 gap-4">
                                <UFormGroup 
                                    :label="t('app.requiredWorkingDays') || 'Days per Month'"
                                    :help="t('app.requiredWorkingDaysHint') || '1–31 days'"
                                    class="space-y-2"
                                >
                                    <UInput 
                                        v-model.number="inviteDays" 
                                        type="number" 
                                        size="lg" 
                                        min="0" 
                                        max="31" 
                                        step="1" 
                                        inputmode="numeric"
                                    />
                                </UFormGroup>

                                <UFormGroup 
                                    :label="t('app.requiredWorkingHours') || 'Hours per Day'"
                                    :help="t('app.requiredWorkingHoursHint') || '0–24 hours'"
                                    class="space-y-2"
                                >
                                    <UInput 
                                        v-model.number="inviteHours" 
                                        type="number" 
                                        size="lg" 
                                        min="0" 
                                        max="24" 
                                        step="1" 
                                        inputmode="numeric"
                                    />
                                </UFormGroup>
                            </div>
                        </div>
                    </div>

                    <!-- Error message -->
                    <div v-if="inviteError" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                        {{ inviteError }}
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <UButton 
                            icon="lucide:x" 
                            color="primary" 
                            variant="soft" 
                            @click="isInviteOpen = false"
                        >
                            {{ t('common.cancel') || 'Cancel' }}
                        </UButton>
                        <UButton 
                            :disabled="!inviteCanSubmit" 
                            :loading="inviteSubmitting" 
                            icon="lucide:send" 
                            color="primary" 
                            @click="submitInvite"
                        >
                            {{ t('app.sendInvite') || 'Send Invitation' }}
                        </UButton>
                    </div>
                </template>
            </UCard>
        </UModal>
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

.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>
