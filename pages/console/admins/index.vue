<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.team')" 
      :description="t('admin.teamDesc')"
    >
      <template #actions>
        <button
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
          <div class="text-3xl font-bold text-slate-900 dark:text-white">1</div>
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
          <div class="text-3xl font-bold text-slate-900 dark:text-white">0</div>
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
          <div class="text-3xl font-bold text-slate-900 dark:text-white">0</div>
        </div>
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
                  <button
                    v-if="admin.id !== currentUserId"
                    class="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
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
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { user } = useAuth();

const currentUserId = computed(() => user.value?.id || '');

const admins = ref([
  {
    id: '1',
    name: user.value?.username || 'Иван Петров',
    email: user.value?.email || 'ivan@lota.tools',
    roleKey: 'superAdmin',
    status: 'active',
    joined: '2026-01-15'
  },
  {
    id: '2',
    name: 'Мария Сидорова',
    email: 'maria@lota.tools',
    roleKey: 'admin',
    status: 'active',
    joined: '2026-02-20'
  },
  {
    id: '3',
    name: 'Алексей Иванов',
    email: 'alexey@lota.tools',
    roleKey: 'cmsEditor',
    status: 'active',
    joined: '2026-03-10'
  }
]);
</script>
