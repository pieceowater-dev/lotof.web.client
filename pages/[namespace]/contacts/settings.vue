<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import BonusPinManager from '@/components/contacts/BonusPinManager.vue';
import ImportModal from '@/components/contacts/ImportModal.vue';
import PlanLimitsBanner from '@/components/contacts/settings/PlanLimitsBanner.vue';
import StampCardsPanel from '@/components/contacts/settings/StampCardsPanel.vue';
import DynamicFieldsPanel from '@/components/contacts/settings/DynamicFieldsPanel.vue';
import MembersRolesPanel from '@/components/contacts/settings/MembersRolesPanel.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');

const loading = ref(true);
const error = ref<string | null>(null);
const contactsToken = ref<string | null>(null);
const showImportModal = ref(false);

const goBack = () => {
  if (process.client) {
    window.history.back();
    return;
  }
  router.back();
};

async function loadSettings() {
  try {
    loading.value = true;
    error.value = null;

    if (!hubToken.value || !nsSlug.value) {
      error.value = t('common.error.missingCredentials');
      return;
    }

    const token = await ensure(nsSlug.value, hubToken.value);
    if (!token) return;

    contactsToken.value = token;
  } catch (e) {
    logError('Failed to load settings:', e);
    error.value = t('common.errorDetails.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadSettings();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('common.settings.title') }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ nsTitle }}
        </span>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="lucide:star"
          size="xs"
          color="amber"
          variant="soft"
          :to="`/${nsSlug}/contacts/plans`"
        >
          {{ t('app.upgradePlan') || 'Upgrade Plan' }}
        </UButton>
        <UButton
          icon="lucide:arrow-left"
          size="xs"
          color="primary"
          variant="soft"
          class="self-start min-w-fit whitespace-nowrap gap-2"
          @click="goBack"
        >
          <span class="hidden sm:inline">{{ t('app.back') }}</span>
        </UButton>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-if="error && !loading"
      class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center flex-1"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <!-- Settings Content -->
    <div
      v-else
      class="flex-1 flex flex-col min-h-0"
    >
      <div class="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto">
        <PlanLimitsBanner />

        <!-- Stamp Cards, Import, and Bonus PIN Management (Grid Layout) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StampCardsPanel />

          <!-- Right Column: Import and Bonus PIN Management -->
          <div class="flex flex-col gap-4">
            <!-- Import -->
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                    Импорт клиентов
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Загрузите список клиентов из Excel-файла
                  </p>
                </div>
                <UButton
                  icon="lucide:upload"
                  size="sm"
                  color="emerald"
                  variant="soft"
                  @click="showImportModal = true"
                >
                  Импорт
                </UButton>
              </div>
            </div>

            <!-- Bonus PIN Management -->
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <BonusPinManager
                :token="contactsToken || ''"
                @success="(msg) => toast.add({ title: msg, color: 'emerald' })"
                @error="(msg) => toast.add({ title: msg, color: 'red' })"
              />
            </div>
          </div>
        </div>

        <DynamicFieldsPanel />

        <MembersRolesPanel />
      </div>
    </div>

    <ImportModal
      v-model="showImportModal"
      :namespace="nsSlug"
    />
  </div>
</template>
