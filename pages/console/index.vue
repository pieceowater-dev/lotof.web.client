<template>
  <div class="min-h-screen">
    <!-- Header -->
    <div class="cn-head">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NuxtLink
          :to="homePath()"
          class="at-btn mb-4 !px-3 !py-1.5 !text-xs"
        >
          <Icon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          {{ t('admin.backToLota') }}
        </NuxtLink>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="at-title !text-3xl sm:!text-4xl">
              {{ t('admin.panel') }}
            </h1>
            <p class="at-sub !text-base">
              {{ t('admin.manageOperations') }}
            </p>
          </div>
          <div class="at-row flex items-center gap-3 !rounded-full !py-2 !pl-2 !pr-5">
            <span class="hdr-avatar !h-9 !w-9 !text-sm">{{ (username || 'A').charAt(0).toUpperCase() }}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-gray-900 dark:text-white">{{ username }}</p>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ userEmail }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isOwner"
      class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div class="at-row flex items-center gap-2 !rounded-full !py-1.5 !pl-5 !pr-1.5">
        <Icon name="lucide:user-round-cog" class="h-4 w-4 flex-shrink-0 text-gray-400" />
        <input
          v-model="impersonateEmail"
          type="email"
          placeholder="email@..."
          aria-label="Войти как (email)"
          class="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-white"
          @keyup.enter="onImpersonate"
        >
        <button
          type="button"
          class="at-btn at-btn--primary shrink-0 disabled:opacity-50"
          :disabled="!impersonateEmail || impersonateLoading"
          @click="onImpersonate"
        >
          {{ impersonateLoading ? '...' : 'Войти как' }}
        </button>
      </div>
      <p
        v-if="impersonateError"
        class="mt-1.5 px-2 text-xs text-red-600 dark:text-red-400"
      >
        {{ impersonateError }}
      </p>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <!-- Modules Grid -->
      <div>
        <h2 class="at-h2 mb-5 !text-xl">
          {{ t('admin.modules') }}
        </h2>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <template v-if="isFullConsoleAdmin">
            <!-- Analytics Module -->
            <AdminModuleCard
              :title="t('admin.analytics')"
              :description="t('admin.analyticsDesc')"
              icon="lucide:bar-chart-2"
              status="active"
              href="/console/analytics"
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
            icon-bg="bg-sky-100 dark:bg-sky-900/30"
            icon-color="text-sky-600 dark:text-sky-400"
          />

          <AdminModuleCard
            :title="t('admin.publications')"
            :description="t('admin.publicationsDesc')"
            icon="lucide:newspaper"
            status="active"
            href="/console/publications"
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
  layout: 'quiet',
  middleware: 'console-access',
});

const { t } = useI18n();
useHead({ title: 'Консоль' });
const { homePath } = usePreferredSpace();
const { user, isLoggedIn, token } = useAuth();

const username = computed(() => user.value?.username || 'Admin');
const userEmail = computed(() => user.value?.email || 'unknown@example.com');

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
