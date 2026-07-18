<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { setUnauthorizedHandler } from '@/api/clients';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import PlanLimitsBanner from '@/components/atrace/settings/PlanLimitsBanner.vue';
import RoutesSection from '@/components/atrace/settings/RoutesSection.vue';
import MembersSection from '@/components/atrace/settings/MembersSection.vue';
import InviteMemberModal from '@/components/atrace/settings/InviteMemberModal.vue';

const { t } = useI18n();

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const goBack = () => {
    if (process.client) {
        window.history.back();
        return;
    }
    router.back();
};

const { ensure: ensureAtraceToken } = useAtraceToken();

const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const isInviteOpen = ref(false);

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

    // Check if user has access to settings (must be admin/manager, not teammate).
    // If the user is a teammate, fetching roles will fail with a permission error.
    try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) {
            router.push('/');
            return;
        }

        const { atraceGetRoles } = await import('@/api/atrace/role/getRoles');
        await atraceGetRoles(atraceToken, nsSlug.value);
    } catch (e: any) {
        if (isAtracePermissionError(e)) {
            accessDenied.value = true;
            accessDeniedMessage.value = t('app.settingsAccessDenied') || 'У вас нет доступа к настройкам ATrace. Обратитесь к администратору пространства.';
        }
    }
    // Sections below self-load their own data once mounted (only happens
    // once accessDenied stays false).
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
        <h1 class="text-2xl font-semibold">
          {{ t('common.settings.title') }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.atraceSettingsSubtitle') || 'Manage members, roles, and working days' }}</span>
      </div>
      <div class="flex flex-row flex-wrap justify-between items-center gap-2 w-full md:w-auto">
        <UButton
          icon="lucide:star"
          size="xs"
          color="amber"
          variant="soft"
          :to="`/${nsSlug}/atrace/plans`"
          class="min-w-fit whitespace-nowrap"
        >
          {{ t('app.upgradePlan') || 'Upgrade Plan' }}
        </UButton>
        <UButton
          icon="lucide:user-plus"
          size="xs"
          color="primary"
          class="min-w-fit whitespace-nowrap"
          @click="isInviteOpen = true"
        >
          {{ t('app.sendInvite') || 'Send Invitation' }}
        </UButton>
        <UButton
          icon="lucide:arrow-left"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          @click="goBack"
        >
          <span class="hidden sm:inline">{{ t('app.back') }}</span>
        </UButton>
      </div>
    </div>

    <div
      v-if="accessDenied"
      class="flex-1 flex items-center justify-center"
    >
      <div class="w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-8 text-center shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
          <UIcon
            name="i-heroicons-lock-closed"
            class="h-7 w-7"
          />
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('app.settingsAccessDenied') || 'Доступ к настройкам ограничен' }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ accessDeniedMessage || (t('app.attendancePermissionErrorHint') || 'Для этого раздела нужна роль с правами управления ATrace.') }}
        </p>
        <div class="mt-5 flex justify-center">
          <UButton
            color="primary"
            variant="soft"
            icon="lucide:arrow-left"
            @click="goBack"
          >
            {{ t('app.back') || 'Назад' }}
          </UButton>
        </div>
      </div>
    </div>

    <template v-else>
      <PlanLimitsBanner />
      <RoutesSection />
      <MembersSection />
    </template>
  </div>

  <InviteMemberModal v-model="isInviteOpen" />
</template>
