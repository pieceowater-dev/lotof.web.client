<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <NuxtLink
          :to="homePath()"
          class="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <Icon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          {{ t('admin.backToLota') }}
        </NuxtLink>
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

    <div
      v-if="isOwner"
      class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <input
          v-model="impersonateEmail"
          type="email"
          placeholder="email@..."
          class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-white"
          @keyup.enter="onImpersonate"
        >
        <button
          type="button"
          class="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          :disabled="!impersonateEmail || impersonateLoading"
          @click="onImpersonate"
        >
          {{ impersonateLoading ? '...' : 'Войти как' }}
        </button>
      </div>
      <p
        v-if="impersonateError"
        class="mt-1 text-xs text-red-600 dark:text-red-400"
      >
        {{ impersonateError }}
      </p>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Modules Grid -->
      <div>
        <h2 class="mb-8 text-2xl font-bold text-slate-900 dark:text-white">
          {{ t('admin.modules') }}
        </h2>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <template v-if="isFullConsoleAdmin">
            <!-- Analytics Module -->
            <AdminModuleCard
              :title="t('admin.analytics')"
              :description="t('admin.analyticsDesc')"
              icon="lucide:bar-chart-2"
              status="active"
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

            <!-- Namespaces Module -->
            <AdminModuleCard
              :title="t('admin.namespaces')"
              :description="t('admin.namespacesDesc')"
              icon="lucide:building-2"
              status="active"
              href="/console/namespaces"
              bg-gradient="bg-white dark:bg-slate-900"
              icon-bg="bg-purple-100 dark:bg-purple-900/30"
              icon-color="text-purple-600 dark:text-purple-400"
            />
          </template>

          <!-- Guide and Publications -- visible to Owner/Admin and the
               restricted Editor ("marketer") role alike (see admin.ts's
               allowEditorRole flag for Publications' own page-level gate).
               Kept second-to-last so they still show up front for Editor
               (the only cards that role sees) while sitting just before
               Team for full admins. -->
          <AdminModuleCard
            :title="t('admin.guide')"
            :description="t('admin.guideDesc')"
            icon="lucide:book-open"
            status="active"
            href="/console/guide"
            bg-gradient="bg-white dark:bg-slate-900"
            icon-bg="bg-sky-100 dark:bg-sky-900/30"
            icon-color="text-sky-600 dark:text-sky-400"
          />

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

          <template v-if="isFullConsoleAdmin">
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
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useConsoleAccess } from '@/composables/useConsoleAccess';
import { useImpersonation } from '@/composables/useImpersonation';

definePageMeta({
  middleware: 'console-access',
});

const { t } = useI18n();
useHead({ title: 'Консоль' });
const { homePath } = usePreferredSpace();
const { user, isLoggedIn, token } = useAuth();

const username = computed(() => user.value?.username || 'Admin');
const userEmail = computed(() => user.value?.email || 'unknown@lota.tools');

const { isFullConsoleAdmin, refreshConsoleAccess } = useConsoleAccess();
watch(
  () => [isLoggedIn.value, user.value?.id, token.value],
  () => refreshConsoleAccess(),
  { immediate: true },
);

// Client-side visibility only -- real enforcement is server-side
// (OWNER_EMAIL check in hub.gtw's /auth/impersonate). This just keeps the
// control from showing up for other admins, who'd only ever get a 403.
const isOwner = computed(() => (user.value?.email || '').trim().toLowerCase() === 'pieceowater@gmail.com');

const { startImpersonation } = useImpersonation();
const impersonateEmail = ref('');
const impersonateLoading = ref(false);
const impersonateError = ref('');
async function onImpersonate() {
  const email = impersonateEmail.value.trim();
  if (!email || impersonateLoading.value) return;
  impersonateLoading.value = true;
  impersonateError.value = '';
  const result = await startImpersonation(email);
  if (!result.success) {
    impersonateError.value = result.error || 'Не удалось';
    impersonateLoading.value = false;
    return;
  }
  window.location.href = '/';
}
</script>

<style scoped>
/* Custom animations can be added here if needed */
</style>
