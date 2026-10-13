<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { metaFor, timeAgo } from '@/config/telephonyProviders';
import { logError } from '@/utils/logger';
import IntegrationModal from '@/components/contacts/integrations/IntegrationModal.vue';
import {
  getTelephonySettings, saveTelephonyProvider, listCommentTemplates, createCommentTemplate, deleteCommentTemplate,
  type TelephonyAdapter, type TelephonyProviderConfig, type CallCommentTemplate,
} from '@/api/contacts/telephony';

definePageMeta({ layout: 'workspace' });

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { ctx } = useCrmAuth();
const { titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
useHead(() => ({ title: `${t('contacts.integrationsTitle')} — Contacts — ${nsTitle.value}` }));

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
  if (!i.enabled) return { text: t('contacts.integrationStatusOff'), tone: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  if (!i.lastEventAt) return { text: t('contacts.integrationStatusWaiting'), tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' };
  return { text: t('contacts.integrationStatusOk'), tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' };
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

const goBack = () => router.push(`/${nsSlug.value}/contacts/settings`);
</script>

<template>
  <div class="at-scope ct-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-5 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">{{ t('contacts.integrationsTitle') }}</h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ nsTitle }}</span>
      </div>
      <div class="flex gap-2">
        <UButton icon="lucide:plus" size="sm" color="primary" variant="soft" :disabled="loading || error" @click="connect">{{ t('contacts.integrationConnect') }}</UButton>
        <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" @click="goBack">{{ t('app.back') }}</UButton>
      </div>
    </div>

    <div v-if="loading" class="flex-1 min-h-0"><AppSkeleton variant="panel" :rows="2" /></div>
    <div v-else-if="error" class="at-notice at-notice--err">{{ t('contacts.callsLoadError') }}</div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto space-y-6">
      <!-- Telephony -->
      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">{{ t('contacts.telephonyTitle') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('contacts.telephonyHint') }}</p>
        </div>

        <div v-if="!integrations.length" class="at-panel flex flex-col items-center text-center gap-3 py-10">
          <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <UIcon name="lucide:phone-incoming" class="w-7 h-7" />
          </div>
          <h3 class="text-lg font-semibold">{{ t('contacts.integrationEmptyTitle') }}</h3>
          <p class="text-sm text-gray-500 max-w-md">{{ t('contacts.integrationEmptyText') }}</p>
          <UButton color="primary" variant="soft" icon="lucide:plus" @click="connect">{{ t('contacts.integrationConnect') }}</UButton>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="i in integrations"
            :key="i.id"
            class="at-panel !p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md transition"
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
              <label class="inline-flex items-center cursor-pointer" :title="t('contacts.integrationEnabledLabel')" @click.stop>
                <input type="checkbox" class="sr-only peer" :checked="i.enabled" @change="toggle(i)">
                <span class="w-9 h-5 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-emerald-500 relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition peer-checked:after:translate-x-4" />
              </label>
            </div>
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span class="px-2 py-0.5 rounded-full font-medium" :class="statusOf(i).tone">{{ statusOf(i).text }}</span>
              <span v-if="i.lastEventAt" class="text-gray-500">{{ t('contacts.integrationLastEvent') }}: {{ timeAgo(i.lastEventAt, locale) }}</span>
            </div>
          </div>

          <button
            class="rounded-[2rem] border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[8.5rem] flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-emerald-600 hover:border-emerald-400 transition"
            @click="connect"
          >
            <UIcon name="lucide:plus" class="w-6 h-6" />
            <span class="text-sm font-medium">{{ t('contacts.integrationConnect') }}</span>
          </button>
        </div>
      </section>

      <!-- Comment templates -->
      <section class="at-panel space-y-3">
        <div>
          <h2 class="text-lg font-semibold">{{ t('contacts.telephonyTemplates') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('contacts.integrationTemplatesHint') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span v-for="tpl in templates" :key="tpl.id" class="inline-flex items-center gap-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1.5">
            {{ tpl.text }}
            <button class="text-gray-400 hover:text-red-600" @click="removeTemplate(tpl.id)"><UIcon name="lucide:x" class="w-3.5 h-3.5" /></button>
          </span>
          <span v-if="!templates.length" class="text-sm text-gray-400">{{ t('contacts.integrationNoTemplates') }}</span>
        </div>
        <div class="flex gap-2 max-w-xl">
          <UInput v-model="newTemplate" class="flex-1" :placeholder="t('contacts.telephonyTemplatePlaceholder')" @keyup.enter="addTemplate" />
          <UButton icon="lucide:plus" :disabled="!newTemplate.trim()" @click="addTemplate">{{ t('contacts.addressesAdd') }}</UButton>
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
