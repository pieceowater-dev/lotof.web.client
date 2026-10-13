<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { metaFor, timeAgo } from '@/config/telephonyProviders';
import { logError } from '@/utils/logger';
import IntegrationModal from '@/components/contacts/integrations/IntegrationModal.vue';
import {
  getTelephonySettings, saveTelephonyProvider, listCommentTemplates, createCommentTemplate, deleteCommentTemplate,
  type TelephonyAdapter, type TelephonyProviderConfig, type CallCommentTemplate,
} from '@/api/contacts/telephony';

const { t, locale } = useI18n();
const route = useRoute();
const toast = useToast();
const { ctx } = useCrmAuth();

const nsSlug = computed(() => route.params.namespace as string);

const loading = ref(true);
const error = ref(false);
const adapters = ref<TelephonyAdapter[]>([]);
const integrations = ref<TelephonyProviderConfig[]>([]);
const templates = ref<CallCommentTemplate[]>([]);
const newTemplate = ref('');
const modalOpen = ref(false);
const editing = ref<TelephonyProviderConfig | null>(null);

async function load() {
  const c = await ctx();
  if (!c) { loading.value = false; error.value = true; return; }
  try {
    const [settings, tpls] = await Promise.all([getTelephonySettings(c.token, c.ns), listCommentTemplates(c.token, c.ns)]);
    adapters.value = settings.adapters;
    integrations.value = settings.configs;
    templates.value = tpls;
  } catch (e) {
    logError('Failed to load integrations:', e);
    error.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function connect() {
  editing.value = null;
  modalOpen.value = true;
}

function edit(i: TelephonyProviderConfig) {
  editing.value = i;
  modalOpen.value = true;
}

function onSaved(cfg: TelephonyProviderConfig) {
  const idx = integrations.value.findIndex(x => x.id === cfg.id);
  if (idx >= 0) integrations.value[idx] = cfg;
  else integrations.value.push(cfg);
  editing.value = cfg; // a fresh integration stays open on its connection tab
}

function onDeleted(id: string) {
  integrations.value = integrations.value.filter(x => x.id !== id);
}

async function toggle(i: TelephonyProviderConfig) {
  const c = await ctx();
  if (!c) return;
  try {
    const saved = await saveTelephonyProvider(c.token, c.ns, { id: i.id, provider: i.provider, enabled: !i.enabled, baseUrl: i.baseUrl });
    onSaved(saved);
  } catch (e) {
    logError('Failed to toggle integration:', e);
    toast.add({ title: t('common.error'), description: t('contacts.telephonySaveError'), color: 'red' });
  }
}

function adapterTitle(code: string) {
  return adapters.value.find(a => a.code === code)?.title || code;
}

function statusOf(i: TelephonyProviderConfig): { text: string; tone: string } {
  if (!i.enabled) return { text: t('contacts.integrationStatusOff'), tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' };
  if (!i.lastEventAt) return { text: t('contacts.integrationStatusWaiting'), tone: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' };
  return { text: t('contacts.integrationStatusOk'), tone: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-blue-300' };
}

async function addTemplate() {
  const text = newTemplate.value.trim();
  const c = await ctx();
  if (!text || !c) return;
  templates.value.push(await createCommentTemplate(c.token, c.ns, text));
  newTemplate.value = '';
}

async function removeTemplate(id: string) {
  const c = await ctx();
  if (!c) return;
  await deleteCommentTemplate(c.token, c.ns, id);
  templates.value = templates.value.filter(x => x.id !== id);
}

</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ t('contacts.integrationsTitle') }}</h3>
      <button type="button" class="at-btn at-btn--primary" :disabled="loading || error" @click="connect"><Icon name="lucide:plus" class="w-4 h-4" />{{ t('contacts.integrationConnect') }}</button>
    </div>

    <div v-if="loading"><AppSkeleton variant="panel" :rows="2" /></div>
    <div v-else-if="error" class="at-notice at-notice--err">{{ t('contacts.callsLoadError') }}</div>

    <div v-else class="space-y-6">
      <!-- Telephony -->
      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">{{ t('contacts.telephonyTitle') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('contacts.telephonyHint') }}</p>
        </div>

        <div v-if="!integrations.length" class="at-empty-box">
          <div class="at-empty-ico"><Icon name="lucide:phone-incoming" class="w-5 h-5" /></div>
          <h3 class="at-h2">{{ t('contacts.integrationEmptyTitle') }}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md">{{ t('contacts.integrationEmptyText') }}</p>
          <button type="button" class="at-btn at-btn--primary" @click="connect"><Icon name="lucide:plus" class="w-4 h-4" />{{ t('contacts.integrationConnect') }}</button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="i in integrations"
            :key="i.id"
            class="at-panel !p-5 flex flex-col gap-4 cursor-pointer transition hover:ring-2 hover:ring-blue-400/30"
            @click="edit(i)"
          >
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" :class="metaFor(i.provider).tile">
                <UIcon :name="metaFor(i.provider).icon" class="w-6 h-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold truncate">{{ i.name }}</div>
                <div class="text-xs text-gray-500">{{ adapterTitle(i.provider) }}</div>
              </div>
              <span :title="t('contacts.integrationEnabledLabel')" @click.stop>
                <UToggle :model-value="i.enabled" @update:model-value="toggle(i)" />
              </span>
            </div>
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span class="px-2 py-0.5 rounded-full font-medium" :class="statusOf(i).tone">{{ statusOf(i).text }}</span>
              <span v-if="i.lastEventAt" class="text-gray-500">{{ t('contacts.integrationLastEvent') }}: {{ timeAgo(i.lastEventAt, locale) }}</span>
            </div>
          </div>

        </div>
      </section>

      <!-- Comment templates -->
      <section class="at-panel space-y-3">
        <div>
          <h2 class="text-lg font-semibold">{{ t('contacts.telephonyTemplates') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('contacts.integrationTemplatesHint') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span v-for="tpl in templates" :key="tpl.id" class="at-chip !py-1.5 !text-sm">
            {{ tpl.text }}
            <button class="text-gray-400 hover:text-red-600" @click="removeTemplate(tpl.id)"><UIcon name="lucide:x" class="w-3.5 h-3.5" /></button>
          </span>
          <span v-if="!templates.length" class="text-sm text-gray-400">{{ t('contacts.integrationNoTemplates') }}</span>
        </div>
        <div class="flex gap-2 max-w-xl">
          <UInput v-model="newTemplate" class="flex-1" :placeholder="t('contacts.telephonyTemplatePlaceholder')" @keyup.enter="addTemplate" />
          <button type="button" class="pill-outline" :disabled="!newTemplate.trim()" @click="addTemplate"><Icon name="lucide:plus" class="w-4 h-4" />{{ t('contacts.addressesAdd') }}</button>
        </div>
      </section>
    </div>

    <IntegrationModal
      :is-open="modalOpen"
      :adapters="adapters"
      :integration="editing"
      :namespace="nsSlug"
      @close="modalOpen = false"
      @saved="onSaved"
      @deleted="onDeleted"
    />
  </div>
</template>
