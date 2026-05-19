<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.team')" 
      :description="t('admin.teamDesc')"
    >
      <template #actions>
        <button
          @click="showInvite = !showInvite"
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

      <div v-if="showInvite" class="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            v-model="inviteUserId"
            type="text"
            placeholder="user UUID"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            v-model.number="inviteRole"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option :value="0">{{ t('admin.superAdmin') }}</option>
            <option :value="1">{{ t('admin.admin') }}</option>
            <option :value="2">{{ t('admin.cmsEditor') }}</option>
          </select>
          <button
            @click="invite"
            :disabled="inviteLoading"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ inviteLoading ? '...' : t('admin.inviteAdmin') }}
          </button>
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
          <table class="w-full text-left text-sm">
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
                  <div v-if="admin.id !== currentUserId" class="flex items-center gap-2">
                    <select
                      v-model.number="admin.role"
                      class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option :value="0">{{ t('admin.superAdmin') }}</option>
                      <option :value="1">{{ t('admin.admin') }}</option>
                      <option :value="2">{{ t('admin.cmsEditor') }}</option>
                    </select>
                    <button
                      @click="changeRole(admin)"
                      class="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Save
                    </button>
                    <button
                      @click="removeAdmin(admin.id)"
                      class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                    >
                      <Icon name="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
  type CapitalAdmin,
} from '@/api/capital/admin';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { user, token, fetchUser } = useAuth();

const currentUserId = computed(() => user.value?.id || '');

type AdminRow = CapitalAdmin & {
  name: string;
  email: string;
  roleKey: 'superAdmin' | 'admin' | 'cmsEditor';
  status: 'active';
  joined: string;
};

const admins = ref<AdminRow[]>([]);
const loading = ref(false);
const inviteLoading = ref(false);
const showInvite = ref(false);
const inviteUserId = ref('');
const inviteRole = ref(2);
const errorMessage = ref('');

const superAdminCount = computed(() => admins.value.filter((a) => a.role === 0).length);
const adminCount = computed(() => admins.value.filter((a) => a.role === 1).length);
const editorCount = computed(() => admins.value.filter((a) => a.role === 2).length);

function toRoleKey(role: number): AdminRow['roleKey'] {
  if (role === 0) return 'superAdmin';
  if (role === 1) return 'admin';
  return 'cmsEditor';
}

function mapRow(a: CapitalAdmin): AdminRow {
  const isMe = !!currentUserId.value && a.userId === currentUserId.value;
  return {
    ...a,
    name: isMe ? (user.value?.username || a.userId) : a.userId,
    email: isMe ? (user.value?.email || '-') : '-',
    roleKey: toRoleKey(a.role),
    status: 'active',
    joined: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '-',
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
    errorMessage.value = e?.message || 'Failed to load admins';
  } finally {
    loading.value = false;
  }
}

async function invite() {
  if (!token.value || !inviteUserId.value.trim()) return;
  inviteLoading.value = true;
  errorMessage.value = '';
  try {
    await capitalInviteAdmin(token.value, inviteUserId.value.trim(), inviteRole.value);
    inviteUserId.value = '';
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || 'Failed to invite admin';
  } finally {
    inviteLoading.value = false;
  }
}

async function changeRole(row: AdminRow) {
  if (!token.value) return;
  errorMessage.value = '';
  try {
    await capitalChangeAdminRole(token.value, row.id, row.role);
    row.roleKey = toRoleKey(row.role);
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || 'Failed to change role';
  }
}

async function removeAdmin(id: string) {
  if (!token.value) return;
  errorMessage.value = '';
  try {
    await capitalRemoveAdmin(token.value, id);
    await loadAdmins();
  } catch (e: any) {
    errorMessage.value = e?.message || 'Failed to remove admin';
  }
}

onMounted(async () => {
  if (!user.value?.id) {
    await fetchUser();
  }
  await loadAdmins();
});
</script>
