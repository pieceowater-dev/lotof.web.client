<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { useNamespaceStaticRoles } from '@/composables/useNamespaceStaticRoles';
import { memberDisplayName } from '@/utils/memberDisplayName';
import { copyToClipboard } from '@/utils/contacts/contactActions';
import { logError } from '@/utils/logger';
import {
  getTelephonySettings, saveTelephonyProvider, listCallOperators, upsertCallOperator, deleteCallOperator,
  listCommentTemplates, createCommentTemplate, deleteCommentTemplate, webhookUrl,
  type TelephonyAdapter, type TelephonyProviderConfig, type CallOperator, type CallCommentTemplate,
} from '@/api/contacts/telephony';

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ctx } = useCrmAuth();
const { namespaceMembers, loadMembersAndRoles } = useNamespaceStaticRoles();

const nsSlug = computed(() => route.params.namespace as string);
const loading = ref(true);
const adapters = ref<TelephonyAdapter[]>([]);
const configs = ref<TelephonyProviderConfig[]>([]);
const operators = ref<CallOperator[]>([]);
const templates = ref<CallCommentTemplate[]>([]);
const savingProvider = ref<string | null>(null);

interface Draft { enabled: boolean; apiKey: string; apiSecret: string; baseUrl: string }
const drafts = ref<Record<string, Draft>>({});
const opForm = ref({ provider: '', extension: '', userId: '' });
const newTemplate = ref('');
const origin = computed(() => (process.client ? window.location.origin : ''));

function cfgOf(code: string) {
  return configs.value.find(c => c.provider === code);
}

function initDrafts() {
  for (const a of adapters.value) {
    const c = cfgOf(a.code);
    drafts.value[a.code] = { enabled: c?.enabled ?? false, apiKey: '', apiSecret: '', baseUrl: c?.baseUrl ?? '' };
  }
}

async function load() {
  const c = await ctx();
  if (!c) { loading.value = false; return; }
  try {
    const [settings, ops, tpls] = await Promise.all([
      getTelephonySettings(c.token, c.ns), listCallOperators(c.token, c.ns), listCommentTemplates(c.token, c.ns),
    ]);
    adapters.value = settings.adapters;
    configs.value = settings.configs;
    operators.value = ops;
    templates.value = tpls;
    initDrafts();
    if (!opForm.value.provider && adapters.value.length) opForm.value.provider = adapters.value[0].code;
  } catch (e) {
    logError('Failed to load telephony settings:', e);
    toast.add({ title: t('common.error'), description: t('contacts.callsLoadError'), color: 'red' });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([load(), loadMembersAndRoles(nsSlug.value, hubToken.value)]);
});

async function save(code: string, rotateToken = false) {
  const c = await ctx();
  if (!c) return;
  const d = drafts.value[code];
  savingProvider.value = code;
  try {
    const saved = await saveTelephonyProvider(c.token, c.ns, {
      provider: code, enabled: d.enabled,
      apiKey: d.apiKey || undefined, apiSecret: d.apiSecret || undefined,
      baseUrl: d.baseUrl, rotateToken,
    });
    const i = configs.value.findIndex(x => x.provider === code);
    if (i >= 0) configs.value[i] = saved; else configs.value.push(saved);
    d.apiKey = ''; d.apiSecret = '';
    toast.add({ title: t('contacts.telephonySaved'), color: 'emerald' });
  } catch (e) {
    logError('Failed to save provider:', e);
    toast.add({ title: t('common.error'), description: t('contacts.telephonySaveError'), color: 'red' });
  } finally {
    savingProvider.value = null;
  }
}

function rotate(code: string) {
  if (!window.confirm(t('contacts.telephonyRotateConfirm'))) return;
  save(code, true);
}

const copy = (text: string) => copyToClipboard(text, toast, t);

async function addOperator() {
  const f = opForm.value;
  if (!f.provider || !f.extension.trim() || !f.userId) return;
  const c = await ctx();
  if (!c) return;
  try {
    await upsertCallOperator(c.token, c.ns, f.provider, f.extension.trim(), f.userId);
    operators.value = await listCallOperators(c.token, c.ns);
    f.extension = '';
  } catch (e) {
    logError('Failed to save operator:', e);
    toast.add({ title: t('common.error'), description: t('contacts.telephonySaveError'), color: 'red' });
  }
}

async function removeOperator(id: string) {
  const c = await ctx();
  if (!c) return;
  await deleteCallOperator(c.token, c.ns, id);
  operators.value = operators.value.filter(o => o.id !== id);
}

function userName(id: string) {
  const m = namespaceMembers.value.find((x: any) => x.id === id);
  return m ? memberDisplayName(m) : id.slice(0, 8);
}

async function addTemplate() {
  const text = newTemplate.value.trim();
  if (!text) return;
  const c = await ctx();
  if (!c) return;
  templates.value.push(await createCommentTemplate(c.token, c.ns, text));
  newTemplate.value = '';
}

async function removeTemplate(id: string) {
  const c = await ctx();
  if (!c) return;
  await deleteCommentTemplate(c.token, c.ns, id);
  templates.value = templates.value.filter(x => x.id !== id);
}

const needsBaseUrl = (code: string) => ['kcell', 'gravitel', 'universal'].includes(code);
</script>

<template>
  <div class="at-panel space-y-4">
    <div>
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ t('contacts.telephonyTitle') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ t('contacts.telephonyHint') }}</p>
    </div>

    <AppSkeleton v-if="loading" variant="panel" :rows="2" />

    <template v-else>
      <!-- Providers -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div v-for="a in adapters" :key="a.code" class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div class="flex items-center gap-2">
            <h4 class="font-medium flex-1">{{ a.title }}</h4>
            <label class="text-sm flex items-center gap-1 cursor-pointer">
              <input v-model="drafts[a.code].enabled" type="checkbox"> {{ t('contacts.telephonyEnabled') }}
            </label>
          </div>
          <p class="text-xs text-gray-500">{{ t(`contacts.telephonyHelp_${a.code}`) }}</p>

          <div v-if="cfgOf(a.code)" class="space-y-1">
            <div class="text-xs text-gray-500">{{ t('contacts.telephonyWebhookUrl') }}</div>
            <div class="flex items-center gap-1">
              <code class="text-xs break-all flex-1 rounded bg-gray-100 dark:bg-gray-900 px-2 py-1">{{ webhookUrl(origin, a.code, nsSlug, cfgOf(a.code)!.webhookToken) }}</code>
              <button class="text-gray-500 hover:text-gray-900 dark:hover:text-white" @click="copy(webhookUrl(origin, a.code, nsSlug, cfgOf(a.code)!.webhookToken))">
                <UIcon name="lucide:copy" class="w-4 h-4" />
              </button>
              <button class="text-gray-500 hover:text-red-600" :title="t('contacts.telephonyRotate')" @click="rotate(a.code)">
                <UIcon name="lucide:refresh-cw" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <UInput
            v-model="drafts[a.code].apiKey"
            type="password"
            size="sm"
            autocomplete="off"
            :placeholder="cfgOf(a.code)?.hasApiKey ? `${t('contacts.telephonyApiKey')}: ${cfgOf(a.code)?.apiKeyHint} (${t('contacts.telephonySecretKeep')})` : t('contacts.telephonyApiKey')"
          />
          <UInput
            v-model="drafts[a.code].apiSecret"
            type="password"
            size="sm"
            autocomplete="off"
            :placeholder="cfgOf(a.code)?.hasApiSecret ? `${t('contacts.telephonyApiSecret')}: ${cfgOf(a.code)?.apiSecretHint} (${t('contacts.telephonySecretKeep')})` : t('contacts.telephonyApiSecret')"
          />
          <UInput v-if="needsBaseUrl(a.code)" v-model="drafts[a.code].baseUrl" size="sm" :placeholder="t('contacts.telephonyBaseUrl')" />

          <div class="flex items-center gap-2">
            <span class="text-[11px] text-gray-500">
              {{ a.canMakeCall ? t('contacts.telephonyCanCall') : '' }}
            </span>
            <UButton class="ml-auto" size="xs" :loading="savingProvider === a.code" @click="save(a.code)">{{ t('contacts.notesSave') }}</UButton>
          </div>
        </div>
      </div>

      <!-- Operators -->
      <div class="space-y-2">
        <h4 class="font-medium">{{ t('contacts.telephonyOperators') }}</h4>
        <p class="text-xs text-gray-500">{{ t('contacts.telephonyOperatorsHint') }}</p>
        <div v-for="o in operators" :key="o.id" class="flex items-center gap-2 text-sm">
          <span class="w-24 text-gray-500">{{ o.provider }}</span>
          <span class="w-20 font-mono">{{ o.extension }}</span>
          <span class="flex-1 truncate">{{ userName(o.userId) }}</span>
          <button class="text-gray-400 hover:text-red-600" @click="removeOperator(o.id)"><UIcon name="lucide:trash-2" class="w-4 h-4" /></button>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
          <select v-model="opForm.provider" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1">
            <option v-for="a in adapters" :key="a.code" :value="a.code">{{ a.title }}</option>
          </select>
          <UInput v-model="opForm.extension" size="sm" class="w-28" :placeholder="t('contacts.telephonyExtension')" />
          <select v-model="opForm.userId" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 min-w-40">
            <option value="">{{ t('contacts.telephonyUser') }}</option>
            <option v-for="m in namespaceMembers" :key="(m as any).id" :value="(m as any).id">{{ memberDisplayName(m) }}</option>
          </select>
          <UButton size="xs" icon="lucide:plus" :disabled="!opForm.extension.trim() || !opForm.userId" @click="addOperator">{{ t('contacts.addressesAdd') }}</UButton>
        </div>
      </div>

      <!-- Comment templates -->
      <div class="space-y-2">
        <h4 class="font-medium">{{ t('contacts.telephonyTemplates') }}</h4>
        <div class="flex flex-wrap gap-2">
          <span v-for="tpl in templates" :key="tpl.id" class="inline-flex items-center gap-1 text-sm rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1">
            {{ tpl.text }}
            <button class="text-gray-400 hover:text-red-600" @click="removeTemplate(tpl.id)"><UIcon name="lucide:x" class="w-3 h-3" /></button>
          </span>
        </div>
        <div class="flex gap-2">
          <UInput v-model="newTemplate" size="sm" class="flex-1" :placeholder="t('contacts.telephonyTemplatePlaceholder')" @keyup.enter="addTemplate" />
          <UButton size="xs" icon="lucide:plus" :disabled="!newTemplate.trim()" @click="addTemplate">{{ t('contacts.addressesAdd') }}</UButton>
        </div>
      </div>
    </template>
  </div>
</template>
