<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

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
import IntegrationsSummary from '@/components/contacts/settings/IntegrationsSummary.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');

useHead(() => ({
  title: nsTitle.value ? `Настройки — Contacts — ${nsTitle.value}` : 'Настройки — Contacts',
}));

type SettingsTab = 'general' | 'loyalty' | 'fields' | 'access' | 'integrations';
const tabs: Array<{ key: SettingsTab; label: string; icon: string }> = [
  { key: 'general', label: 'contacts.settingsTabGeneral', icon: 'lucide:sliders-horizontal' },
  { key: 'loyalty', label: 'contacts.settingsTabLoyalty', icon: 'lucide:gift' },
  { key: 'fields', label: 'contacts.settingsTabFields', icon: 'lucide:list-plus' },
  { key: 'access', label: 'contacts.settingsTabAccess', icon: 'lucide:users' },
  { key: 'integrations', label: 'contacts.settingsTabIntegrations', icon: 'lucide:plug-zap' },
];
// The active tab lives in the URL (?tab=...) so it survives reloads and can be linked.
const activeTab = computed<SettingsTab>(() => {
  const q = route.query.tab;
  return tabs.some(x => x.key === q) ? (q as SettingsTab) : 'general';
});
function setTab(key: SettingsTab) {
  router.replace({ query: { ...route.query, tab: key === 'general' ? undefined : key } });
}

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
      error.value = t('common.errorDetails.missingCredentials');
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
  <div class="at-scope ct-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
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
          :to="`/${nsSlug}/contacts/plans?manage=1`"
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
      class="at-notice at-notice--err"
    >
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 min-h-0 overflow-hidden"><AppSkeleton variant="panel" :rows="2" /></div>

    <!-- Settings Content -->
    <div
      v-else
      class="flex-1 flex flex-col min-h-0 gap-4"
    >
      <!-- Tabs -->
      <div class="flex-shrink-0 -mx-1 px-1 overflow-x-auto">
        <div class="inline-flex gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70" role="tablist">
          <button
            v-for="tb in tabs"
            :key="tb.key"
            role="tab"
            :aria-selected="activeTab === tb.key"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
            :class="activeTab === tb.key
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
            @click="setTab(tb.key)"
          >
            <UIcon :name="tb.icon" class="w-4 h-4" />
            {{ t(tb.label) }}
          </button>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto space-y-4">
        <!-- General -->
        <template v-if="activeTab === 'general'">
          <PlanLimitsBanner />
          <div class="at-panel">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-gray-100">Импорт клиентов</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Загрузите список клиентов из Excel-файла</p>
              </div>
              <UButton icon="lucide:upload" size="sm" color="emerald" variant="soft" @click="showImportModal = true">Импорт</UButton>
            </div>
          </div>
        </template>

        <!-- Loyalty -->
        <div v-else-if="activeTab === 'loyalty'" class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <StampCardsPanel />
          <div class="at-panel">
            <BonusPinManager
              :token="contactsToken || ''"
              :ns-slug="nsSlug"
              @success="(msg) => toast.add({ title: msg, color: 'emerald' })"
              @error="(msg) => toast.add({ title: msg, color: 'red' })"
            />
          </div>
        </div>

        <!-- Client fields -->
        <DynamicFieldsPanel v-else-if="activeTab === 'fields'" />

        <!-- Access -->
        <MembersRolesPanel v-else-if="activeTab === 'access'" />

        <!-- Integrations -->
        <IntegrationsSummary v-else-if="activeTab === 'integrations'" />
      </div>
    </div>

    <ImportModal
      v-model="showImportModal"
      :namespace="nsSlug"
    />
  </div>
</template>
