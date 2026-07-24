<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.team')" 
      :description="t('admin.teamDesc')"
    >
      <template #actions>
        <button
          @click="showInviteModal = true"
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          <span>{{ t('admin.inviteAdmin') }}</span>
        </button>
      </template>
    </AdminHeader>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Roles Overview -->
      <div class="mb-8 grid gap-6 md:grid-cols-3">
        <!-- Super Admin -->
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center gap-3 mb-4">
            <div class="inline-flex rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
              <Icon name="lucide:shield" class="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.superAdmin') }}</h3>
            </div>
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {{ t('admin.superAdminDesc') }}
          </p>
          <div class="text-3xl font-bold text-slate-900 dark:text-white">{{ superAdminCount }}</div>
        </div>

        <!-- Admin -->
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center gap-3 mb-4">
            <div class="inline-flex rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
              <Icon name="lucide:lock" class="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.admin') }}</h3>
            </div>
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {{ t('admin.adminDesc') }}
          </p>
          <div class="text-3xl font-bold text-slate-900 dark:text-white">{{ adminCount }}</div>
        </div>

        <!-- CMS Editor -->
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center gap-3 mb-4">
            <div class="inline-flex rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Icon name="lucide:edit-3" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.cmsEditor') }}</h3>
            </div>
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {{ t('admin.cmsEditorDesc') }}
          </p>
          <div class="text-3xl font-bold text-slate-900 dark:text-white">{{ editorCount }}</div>
        </div>
      </div>

      <div v-if="errorMessage" class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        {{ errorMessage }}
      </div>

      <!-- Team Members List -->
      <div>
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.users') }}
        </h3>
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="overflow-x-auto">
          <table class="w-full min-w-[820px] text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.name') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.email') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.role') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.status') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.joined') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-6 py-4 text-slate-500 dark:text-slate-400">Loading...</td>
              </tr>
              <tr
                v-for="admin in admins"
                :key="admin.id"
                class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                  {{ admin.name }}
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">
                  {{ admin.email }}
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                      admin.roleKey === 'superAdmin'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                        : admin.roleKey === 'admin'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    ]"
                  >
                    {{ t(`admin.${admin.roleKey}`) }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                    <div class="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
                    {{ t('admin.active') }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">
                  {{ admin.joined }}
                </td>
                <td class="px-6 py-4">
                  <div v-if="canManageAdmins && !admin.isCurrent && !admin.isOwner" class="flex items-center gap-2">
                    <button
                      @click="openRoleModal(admin)"
                      class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950"
                    >
                      <Icon name="lucide:settings-2" class="h-4 w-4" />
                      <span>{{ t('admin.changeRoleAction') }}</span>
                    </button>
                    <button
                      @click="removeAdmin(admin.id)"
                      class="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Icon name="lucide:trash-2" class="h-4 w-4" />
                      <span>{{ t('admin.deleteAction') }}</span>
                    </button>
                  </div>
                  <span v-else-if="admin.isOwner" class="text-xs font-semibold text-slate-400 dark:text-slate-500">{{ t('admin.ownerLabel') }}</span>
                  <span v-else-if="admin.isCurrent" class="text-xs font-semibold text-slate-400 dark:text-slate-500">{{ t('admin.youLabel') }}</span>
                  <span v-else class="text-xs font-semibold text-slate-400 dark:text-slate-500">-</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- Pending Invitations -->
      <div class="mt-8">
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.pendingInvitations') }}
        </h3>
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Icon name="lucide:mail" class="mx-auto h-12 w-12 text-slate-400" />
          <p class="mt-4 text-slate-600 dark:text-slate-400">
            {{ t('admin.noRecentActivity') }}
          </p>
        </div>
      </div>

      <!-- Permission Guide -->
      <div class="mt-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h4 class="font-bold text-blue-900 dark:text-blue-200">{{ t('admin.rolePermissions') }}</h4>
        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <!-- Super Admin -->
          <div>
            <h5 class="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Icon name="lucide:shield" class="h-5 w-5" />
              {{ t('admin.superAdmin') }}
            </h5>
            <ul class="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <li>✓ {{ t('admin.allPermissions') }}</li>
              <li>✓ {{ t('admin.manageAdmins') }}</li>
              <li>✓ {{ t('admin.systemSettings') }}</li>
            </ul>
          </div>
          <!-- Admin -->
          <div>
            <h5 class="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Icon name="lucide:lock" class="h-5 w-5" />
              {{ t('admin.admin') }}
            </h5>
            <ul class="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <li>✓ {{ t('admin.billingManagement') }}</li>
              <li>✓ {{ t('admin.userManagement') }}</li>
              <li>✗ {{ t('admin.manageAdmins') }}</li>
            </ul>
          </div>
          <!-- CMS Editor -->
          <div>
            <h5 class="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Icon name="lucide:edit-3" class="h-5 w-5" />
              {{ t('admin.cmsEditor') }}
            </h5>
            <ul class="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <li>✓ {{ t('admin.newPublication') }}</li>
              <li>✓ {{ t('admin.cmsEditorDesc') }}</li>
              <li>✗ {{ t('admin.billingAccess') }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Contact Settings (Обратная связь) -->
      <div class="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h4 class="font-bold text-slate-900 dark:text-white">{{ t('admin.contactSettingsTitle') }}</h4>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {{ t('admin.contactSettingsDesc') }}
        </p>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {{ t('admin.contactPhone') }}
            </label>
            <input
              v-model="contactPhone"
              type="text"
              placeholder="+7 700 000 00 00"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {{ t('admin.contactWhatsapp') }}
            </label>
            <input
              v-model="contactWhatsapp"
              type="text"
              placeholder="+7 700 000 00 00"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
        <div v-if="contactSettingsError" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {{ contactSettingsError }}
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button
            @click="saveContactSettings"
            :disabled="contactSettingsSaving"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ contactSettingsSaving ? '...' : t('admin.save') }}
          </button>
          <span v-if="contactSettingsSavedAt" class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('admin.contactSettingsSaved') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Invite Modal -->
    <div v-if="showInviteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="w-full max-w-md rounded-lg bg-white p-6 dark:bg-slate-900">
        <h2 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.inviteAdmin') }}
        </h2>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              Email
            </label>
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="admin@example.com"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              {{ t('admin.role') }}
            </label>
            <select
              v-model.number="inviteRole"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option :value="0">{{ t('admin.superAdmin') }}</option>
              <option :value="1">{{ t('admin.admin') }}</option>
              <option :value="2">{{ t('admin.cmsEditor') }}</option>
            </select>
          </div>

          <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {{ errorMessage }}
          </div>
        </div>

        <div class="mt-6 flex gap-2">
          <button
            @click="invite"
            :disabled="inviteLoading || !inviteEmail.trim()"
            class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ inviteLoading ? '...' : t('admin.inviteAdmin') }}
          </button>
          <button
            @click="showInviteModal = false"
            :disabled="inviteLoading"
            class="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950"
          >
            {{ t('admin.cancel') || 'Cancel' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showRoleModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="w-full max-w-md rounded-lg bg-white p-6 dark:bg-slate-900">
        <h2 class="mb-2 text-lg font-bold text-slate-900 dark:text-white">{{ t('admin.changeRoleTitle') }}</h2>
        <p class="mb-4 text-sm text-slate-600 dark:text-slate-400">
          {{ selectedAdminName }}
        </p>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              {{ t('admin.role') }}
            </label>
            <select
              v-model.number="selectedRole"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option :value="0">{{ t('admin.superAdmin') }}</option>
              <option :value="1">{{ t('admin.admin') }}</option>
              <option :value="2">{{ t('admin.cmsEditor') }}</option>
            </select>
          </div>
        </div>

        <div class="mt-6 flex gap-2">
          <button
            @click="saveRoleChange"
            :disabled="actionLoading"
            class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ actionLoading ? '...' : t('admin.saveRoleAction') }}
          </button>
          <button
            @click="closeRoleModal"
            :disabled="actionLoading"
            class="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950"
          >
            {{ t('admin.cancel') || 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import AdminHeader from '@/components/admin/AdminHeader.vue';
import {
  capitalListAdmins,
  capitalInviteAdmin,
  capitalChangeAdminRole,
  capitalRemoveAdmin,
  capitalGetContactSettings,
  capitalUpdateContactSettings,
  type CapitalAdmin,
} from '@/api/capital/admin';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { user, token, fetchUser } = useAuth();

const currentUserId = computed(() => user.value?.id || '');
const currentUserEmail = computed(() => (user.value?.email || getEmailFromToken(token.value) || '').trim().toLowerCase());

type AdminRow = CapitalAdmin & {
  name: string;
  email: string;
  roleKey: 'superAdmin' | 'admin' | 'cmsEditor';
  status: 'active';
  joined: string;
  isCurrent: boolean;
  isOwner: boolean;
};

const admins = ref<AdminRow[]>([]);
const loading = ref(false);
const inviteLoading = ref(false);
const actionLoading = ref(false);
const showInviteModal = ref(false);
const showRoleModal = ref(false);
const inviteEmail = ref('');
const inviteRole = ref(2);
const selectedRole = ref(2);
const selectedAdminId = ref('');
const selectedAdminName = ref('');
const errorMessage = ref('');

const superAdminCount = computed(() => admins.value.filter((a) => a.role === 0).length);
const adminCount = computed(() => admins.value.filter((a) => a.role === 1).length);
const editorCount = computed(() => admins.value.filter((a) => a.role === 2).length);
const canManageAdmins = computed(() => admins.value.some((admin) => admin.isCurrent && admin.isOwner));

function toRoleKey(role: number): AdminRow['roleKey'] {
  if (role === 0) return 'superAdmin';
  if (role === 1) return 'admin';
  return 'cmsEditor';
}

function ownerNameFromEmail(email?: string | null): string {
  const value = (email || '').trim();
  if (!value) return '-';

  const at = value.indexOf('@');
  if (at <= 0) return value;
  return value.slice(0, at);
}

function getEmailFromToken(jwt?: string | null): string {
  const raw = (jwt || '').trim();
  if (!raw) return '';

  try {
    const parts = raw.split('.');
    if (parts.length < 2) return '';
    if (!process.client || typeof atob !== 'function') return '';

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { email?: string };
    return (payload.email || '').trim();
  } catch {
    return '';
  }
}

function mapRow(a: CapitalAdmin): AdminRow {
  const isMe = !!currentUserId.value && a.userId === currentUserId.value;
  const isOwner = a.role === 0;
  const email = (a.email || '').trim();
  const currentEmail = (user.value?.email || getEmailFromToken(token.value) || '').trim();
  const ownerEmail = email || (isOwner ? currentEmail : '');
  const resolvedEmail = isMe ? (user.value?.email || ownerEmail || '-') : (ownerEmail || '-');
  const isCurrent = isMe || (!!currentUserEmail.value && resolvedEmail.trim().toLowerCase() === currentUserEmail.value);
  return {
    ...a,
    name: isMe
      ? (user.value?.username || ownerNameFromEmail(user.value?.email) || a.userId)
      : (isOwner ? ownerNameFromEmail(ownerEmail) : (a.userId || '-')),
    email: resolvedEmail,
    roleKey: toRoleKey(a.role),
    status: 'active',
    joined: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '-',
    isCurrent,
    isOwner,
  };
}

async function loadAdmins() {
  if (!token.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const list = await capitalListAdmins(token.value);
    admins.value = list.map(mapRow);
  } catch (e: any) {
    errorMessage.value = e?.message || t('admin.loadAdminsFailed');
  } finally {
    loading.value = false;
  }
}

async function invite() {
  if (!token.value || !inviteEmail.value.trim()) return;
  inviteLoading.value = true;
  errorMessage.value = '';
  try {
    await capitalInviteAdmin(token.value, inviteEmail.value.trim(), inviteRole.value);
    inviteEmail.value = '';
    inviteRole.value = 2;
    showInviteModal.value = false;
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || t('admin.inviteAdminFailed');
  } finally {
    inviteLoading.value = false;
  }
}

function openRoleModal(row: AdminRow) {
  selectedAdminId.value = row.id;
  selectedAdminName.value = row.email || row.name || row.id;
  selectedRole.value = row.role;
  showRoleModal.value = true;
}

function closeRoleModal() {
  if (actionLoading.value) return;
  showRoleModal.value = false;
  selectedAdminId.value = '';
  selectedAdminName.value = '';
}

async function saveRoleChange() {
  if (!token.value || !selectedAdminId.value) return;
  actionLoading.value = true;
  errorMessage.value = '';
  try {
    await capitalChangeAdminRole(token.value, selectedAdminId.value, selectedRole.value);
    closeRoleModal();
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || t('admin.changeRoleFailed');
  } finally {
    actionLoading.value = false;
  }
}

async function removeAdmin(id: string) {
  if (!token.value) return;
  const { confirm } = useConfirm();
  const confirmed = await confirm({
    message: t('admin.deleteAdminConfirm'),
    confirmLabel: t('app.remove') || 'Remove',
    color: 'red',
    icon: 'lucide:user-x',
  });
  if (!confirmed) return;
  actionLoading.value = true;
  errorMessage.value = '';
  try {
    await capitalRemoveAdmin(token.value, id);
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || t('admin.removeAdminFailed');
  } finally {
    actionLoading.value = false;
  }
}

const contactPhone = ref('');
const contactWhatsapp = ref('');
const contactSettingsSaving = ref(false);
const contactSettingsSavedAt = ref('');
const contactSettingsError = ref('');

async function loadContactSettings() {
  if (!token.value) return;
  try {
    const settings = await capitalGetContactSettings(token.value);
    contactPhone.value = settings?.phone || '';
    contactWhatsapp.value = settings?.whatsapp || '';
  } catch (e: any) {
    console.error('[admins] Failed to load contact settings', e);
  }
}

async function saveContactSettings() {
  if (!token.value) return;
  contactSettingsSaving.value = true;
  contactSettingsError.value = '';
  contactSettingsSavedAt.value = '';
  try {
    await capitalUpdateContactSettings(token.value, contactPhone.value.trim(), contactWhatsapp.value.trim());
    contactSettingsSavedAt.value = new Date().toISOString();
  } catch (e: any) {
    contactSettingsError.value = e?.message || t('admin.contactSettingsSaveFailed');
  } finally {
    contactSettingsSaving.value = false;
  }
}

onMounted(async () => {
  if (!user.value?.id) {
    await fetchUser();
  }
  await loadAdmins();
  await loadContactSettings();
});
</script>
