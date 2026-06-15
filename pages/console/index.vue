<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-4xl font-bold text-slate-900 dark:text-white">
              {{ t('admin.panel') }}
            </h1>
            <p class="mt-2 text-slate-600 dark:text-slate-400">
              {{ t('admin.manageOperations') }}
            </p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="lucide:user" class="h-4 w-4" />
              <span class="text-sm font-semibold">{{ username }}</span>
            </div>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ userEmail }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Modules Grid -->
      <div>
        <h2 class="mb-8 text-2xl font-bold text-slate-900 dark:text-white">
          {{ t('admin.modules') }}
        </h2>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- Analytics Module -->
          <AdminModuleCard
            :title="t('admin.analytics')"
            :description="t('admin.analyticsDesc')"
            icon="lucide:bar-chart-2"
            status="coming"
            href="/console/analytics"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-blue-100 dark:bg-blue-900/30"
            icon-color="text-blue-600 dark:text-blue-400"
          />

          <!-- Billing Module -->
          <AdminModuleCard
            :title="t('admin.billing')"
            :description="t('admin.billingDesc')"
            icon="lucide:credit-card"
            status="active"
            href="/console/billing"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-emerald-100 dark:bg-emerald-900/30"
            icon-color="text-emerald-600 dark:text-emerald-400"
          />

          <!-- Publications Module -->
          <AdminModuleCard
            :title="t('admin.publications')"
            :description="t('admin.publicationsDesc')"
            icon="lucide:newspaper"
            status="active"
            href="/console/publications"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-orange-100 dark:bg-orange-900/30"
            icon-color="text-orange-600 dark:text-orange-400"
          />

          <!-- Support Module -->
          <AdminModuleCard
            :title="t('admin.support')"
            :description="t('admin.supportDesc')"
            icon="lucide:headset"
            status="coming"
            href="/console/support"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-purple-100 dark:bg-purple-900/30"
            icon-color="text-purple-600 dark:text-purple-400"
          />

          <!-- Team Module -->
          <AdminModuleCard
            :title="t('admin.team')"
            :description="t('admin.teamDesc')"
            icon="lucide:users"
            status="active"
            href="/console/people"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-rose-100 dark:bg-rose-900/30"
            icon-color="text-rose-600 dark:text-rose-400"
          />

          <div class="group relative rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div class="mb-6 inline-flex rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              <Icon name="lucide:arrow-left-circle" class="h-8 w-8 text-slate-700 dark:text-slate-200" />
            </div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">{{ t('admin.backToLota') }}</h3>
            <p class="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {{ t('admin.backToLotaDesc') }}
            </p>
            <NuxtLink
              to="/"
              class="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {{ t('admin.backToLota') }}
              <Icon name="lucide:arrow-up-right" class="h-4 w-4" />
            </NuxtLink>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { user } = useAuth();

const username = computed(() => user.value?.username || 'Admin');
const userEmail = computed(() => user.value?.email || 'unknown@lota.tools');
</script>

<style scoped>
/* Custom animations can be added here if needed */
</style>
