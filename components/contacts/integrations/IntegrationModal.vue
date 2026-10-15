<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { atModalUi } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { useNamespaceStaticRoles } from '@/composables/useNamespaceStaticRoles';
import { useAuth } from '@/composables/useAuth';
import { memberDisplayName } from '@/utils/memberDisplayName';
import { copyToClipboard } from '@/utils/contacts/contactActions';
import { metaFor } from '@/config/telephonyProviders';
import { logError } from '@/utils/logger';
import {
  saveTelephonyProvider, deleteTelephonyIntegration, listCallOperators, upsertCallOperator, deleteCallOperator, webhookUrl,
  type TelephonyAdapter, type TelephonyProviderConfig, type CallOperator,
} from '@/api/contacts/telephony';

// One modal for both flows: "connect" (pick a provider, then fill it in) and
// "edit" (an existing integration: connection, staff mapping, removal).
const props = defineProps<{
  isOpen: boolean;
  adapters: TelephonyAdapter[];
  /** null = connect a new integration */
  integration: TelephonyProviderConfig | null;
  namespace: string;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', cfg: TelephonyProviderConfig): void; (e: 'deleted', id: string): void }>();

const { t } = useI18n();
const toast = useToast();
const { ctx } = useCrmAuth();
const { token: hubToken } = useAuth();
const { namespaceMembers, loadMembersAndRoles } = useNamespaceStaticRoles();

const step = ref<'pick' | 'form'>('pick');
const tab = ref<'connection' | 'staff'>('connection');
const provider = ref('');
const name = ref('');
const enabled = ref(true);
const fields = ref({ apiKey: '', apiSecret: '', baseUrl: '' });
const saving = ref(false);
const current = ref<TelephonyProviderConfig | null>(null);
const operators = ref<CallOperator[]>([]);
const opForm = ref({ extension: '', userId: '' });
const confirmDelete = ref(false);

const adapter = computed(() => props.adapters.find(a => a.code === provider.value));
const meta = computed(() => metaFor(provider.value));
const origin = computed(() => (process.client ? window.location.origin : ''));
const url = computed(() => (current.value ? webhookUrl(origin.value, current.value.provider, props.namespace, current.value.webhookToken) : ''));
const steps = computed(() => t(`contacts.integrationSteps_${provider.value}`).split('\n').filter(Boolean));

watch(() => props.isOpen, async (open) => {
  if (!open) return;
  confirmDelete.value = false;
  tab.value = 'connection';
  fields.value = { apiKey: '', apiSecret: '', baseUrl: props.integration?.baseUrl || '' };
  if (props.integration) {
    current.value = props.integration;
    provider.value = props.integration.provider;
    name.value = props.integration.name;
    enabled.value = props.integration.enabled;
    step.value = 'form';
    const c = await ctx();
    if (c) operators.value = await listCallOperators(c.token, c.ns, props.integration.id).catch(() => []);
    loadMembersAndRoles(props.namespace, hubToken.value);
  } else {
    current.value = null;
    provider.value = '';
    name.value = '';
    enabled.value = true;
    operators.value = [];
    step.value = 'pick';
  }
});

function pick(code: string) {
  provider.value = code;
  step.value = 'form';
}

const missingRequired = computed(() =>
  meta.value.fields.some(f => f.required && f.key !== 'baseUrl' && !fields.value[f.key].trim()
    && !(f.key === 'apiKey' ? current.value?.hasApiKey : current.value?.hasApiSecret)),
);

async function save(rotateToken = false) {
  const c = await ctx();
  if (!c) return;
  saving.value = true;
  try {
    const saved = await saveTelephonyProvider(c.token, c.ns, {
      id: current.value?.id, provider: provider.value, name: name.value.trim() || undefined, enabled: enabled.value,
      apiKey: fields.value.apiKey || undefined, apiSecret: fields.value.apiSecret || undefined,
      baseUrl: fields.value.baseUrl.trim(), rotateToken,
    });
    current.value = saved;
    name.value = saved.name;
    fields.value.apiKey = '';
    fields.value.apiSecret = '';
    emit('saved', saved);
    toast.add({ title: t('contacts.telephonySaved'), color: 'emerald' });
  } catch (e) {
    logError('Failed to save integration:', e);
    toast.add({ title: t('common.error'), description: t('contacts.telephonySaveError'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

function rotate() {
  if (window.confirm(t('contacts.telephonyRotateConfirm'))) save(true);
}

async function remove() {
  if (!current.value) return;
  const c = await ctx();
  if (!c) return;
  try {
    await deleteTelephonyIntegration(c.token, c.ns, current.value.id);
    emit('deleted', current.value.id);
    emit('close');
  } catch (e) {
    logError('Failed to delete integration:', e);
    toast.add({ title: t('common.error'), color: 'red' });
  }
}

const copy = (text: string) => copyToClipboard(text, toast, t);

async function addOperator() {
  const f = opForm.value;
  if (!current.value || !f.extension.trim() || !f.userId) return;
  const c = await ctx();
  if (!c) return;
  try {
    await upsertCallOperator(c.token, c.ns, current.value.id, f.extension.trim(), f.userId);
    operators.value = await listCallOperators(c.token, c.ns, current.value.id);
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

const memberOptions = computed(() => namespaceMembers.value.map((m: any) => ({ value: m.id, label: memberDisplayName(m) })));

function userName(id: string) {
  const m = namespaceMembers.value.find((x: any) => x.id === id);
  return m ? memberDisplayName(m) : id.slice(0, 8);
}
</script>

<template>
  <UModal class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-3xl' }" :model-value="isOpen" @update:model-value="emit('close')">
    <div class="p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-5">
      <div class="flex items-start gap-3">
        <div v-if="provider" class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" :class="meta.tile">
          <UIcon :name="meta.icon" class="w-6 h-6" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-semibold truncate">
            {{ step === 'pick' ? t('contacts.integrationConnectTitle') : (current?.name || adapter?.title) }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ step === 'pick' ? t('contacts.integrationPickHint') : t(`contacts.integrationDesc_${provider}`) }}
          </p>
        </div>
        <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="emit('close')" />
      </div>

      <!-- Step 1: provider tiles -->
      <div v-if="step === 'pick'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          v-for="a in adapters"
          :key="a.code"
          class="at-row !p-4 text-left transition hover:shadow-md hover:ring-2 hover:ring-blue-400/40"
          @click="pick(a.code)"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="metaFor(a.code).tile">
              <UIcon :name="metaFor(a.code).icon" class="w-5 h-5" />
            </div>
            <div class="font-semibold">{{ a.title }}</div>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t(`contacts.integrationDesc_${a.code}`) }}</p>
          <div class="flex gap-1.5 mt-3 flex-wrap">
            <span class="at-chip">{{ t('contacts.integrationCapIncoming') }}</span>
            <span v-if="a.canMakeCall" class="text-[11px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-blue-300">{{ t('contacts.integrationCapOutgoing') }}</span>
            <span v-if="a.canProvideRecording" class="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">{{ t('contacts.integrationCapRecording') }}</span>
          </div>
        </button>
      </div>

      <!-- Step 2 / edit -->
      <template v-else>
        <div v-scroll-fade v-if="current" class="overflow-x-auto no-scrollbar">
          <div class="at-seg" role="tablist">
            <button type="button" role="tab" class="at-seg__btn" :class="tab === 'connection' ? 'at-seg__btn--on' : ''" @click="tab = 'connection'">
              <Icon name="lucide:plug" class="w-4 h-4" /><span>{{ t('contacts.integrationTabConnection') }}</span>
            </button>
            <button type="button" role="tab" class="at-seg__btn" :class="tab === 'staff' ? 'at-seg__btn--on' : ''" @click="tab = 'staff'">
              <Icon name="lucide:users" class="w-4 h-4" /><span>{{ t('contacts.integrationTabStaff') }}</span>
              <span v-if="operators.length" class="rounded-full bg-blue-500/15 px-1.5 text-[11px] font-bold leading-5 text-blue-700 dark:text-blue-300">{{ operators.length }}</span>
            </button>
          </div>
        </div>

        <div v-if="tab === 'connection'" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block space-y-1">
              <span class="text-sm font-medium">{{ t('contacts.integrationName') }}</span>
              <UInput v-model="name" :placeholder="adapter?.title" />
            </label>
            <div class="at-switch sm:self-end">
              <UToggle v-model="enabled" />
              <span class="text-sm font-semibold">{{ t('contacts.integrationEnabledLabel') }}</span>
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">{{ t('contacts.integrationCredentials') }}</h3>
            <label v-for="f in meta.fields" :key="f.key" class="block space-y-1">
              <span class="text-sm font-medium">
                {{ t(f.labelKey) }}<span v-if="f.required" class="text-red-500"> *</span>
              </span>
              <UInput
                v-model="fields[f.key]"
                :type="f.secret ? 'password' : 'text'"
                autocomplete="off"
                :placeholder="f.key === 'apiKey' && current?.hasApiKey ? `${current.apiKeyHint} — ${t('contacts.telephonySecretKeep')}`
                  : f.key === 'apiSecret' && current?.hasApiSecret ? `${current.apiSecretHint} — ${t('contacts.telephonySecretKeep')}`
                    : f.key === 'baseUrl' ? 'https://' : ''"
              />
            </label>
            <p v-if="!meta.fields.length" class="text-sm text-gray-500">{{ t('contacts.integrationNoCredentials') }}</p>
          </div>

          <div v-if="current" class="space-y-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">{{ t('contacts.integrationWebhook') }}</h3>
            <div class="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-900 px-3 py-2">
              <code class="text-xs break-all flex-1">{{ url }}</code>
              <button type="button" class="at-btn at-btn--blue" @click="copy(url)"><Icon name="lucide:copy" class="w-4 h-4" />{{ t('contacts.integrationCopy') }}</button>
            </div>
            <ol class="list-decimal pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li v-for="(s, i) in steps" :key="i">{{ s }}</li>
            </ol>
            <button class="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1" @click="rotate">
              <UIcon name="lucide:refresh-cw" class="w-3.5 h-3.5" />{{ t('contacts.telephonyRotate') }}
            </button>
          </div>
          <p v-else class="text-sm text-gray-500">{{ t('contacts.integrationWebhookAfterSave') }}</p>

          <div class="flex items-center gap-2 pt-1 flex-wrap">
            <template v-if="current">
              <button v-if="!confirmDelete" type="button" class="at-btn hover:!bg-rose-500/10 hover:!text-rose-600" @click="confirmDelete = true"><Icon name="lucide:trash-2" class="w-4 h-4" />{{ t('contacts.integrationDelete') }}</button>
              <template v-else>
                <span class="text-sm text-red-600">{{ t('contacts.integrationDeleteConfirm') }}</span>
                <button type="button" class="at-btn at-btn--danger" @click="remove">{{ t('contacts.integrationDeleteYes') }}</button>
                <button type="button" class="at-btn" @click="confirmDelete = false">{{ t('common.cancel') }}</button>
              </template>
            </template>
            <span class="flex-1" />
            <button v-if="!current" type="button" class="at-btn" @click="step = 'pick'">{{ t('app.back') }}</button>
            <button type="button" class="at-btn at-btn--primary disabled:opacity-50" :disabled="missingRequired || saving" @click="save()">
              <Icon v-if="saving" name="lucide:loader-2" class="w-4 h-4 animate-spin" />
              {{ current ? t('contacts.notesSave') : t('contacts.integrationConnect') }}
            </button>
          </div>
        </div>

        <!-- Staff mapping of this integration -->
        <div v-else class="space-y-3">
          <p class="text-sm text-gray-500">{{ t('contacts.telephonyOperatorsHint') }}</p>
          <div v-for="o in operators" :key="o.id" class="at-row flex items-center gap-3 text-sm">
            <span class="font-mono w-20">{{ o.extension }}</span>
            <UIcon name="lucide:arrow-right" class="w-4 h-4 text-gray-400" />
            <span class="flex-1 truncate">{{ userName(o.userId) }}</span>
            <button class="text-gray-400 hover:text-red-600" @click="removeOperator(o.id)"><UIcon name="lucide:trash-2" class="w-4 h-4" /></button>
          </div>
          <p v-if="!operators.length" class="text-sm text-gray-400">{{ t('contacts.integrationNoStaff') }}</p>
          <div class="flex gap-2 flex-wrap items-center pt-1">
            <UInput v-model="opForm.extension" class="w-36" :placeholder="t('contacts.telephonyExtension')" />
            <USelect
              v-model="opForm.userId"
              class="flex-1 min-w-44"
              :options="memberOptions"
              option-attribute="label"
              value-attribute="value"
              :placeholder="t('contacts.telephonyUser')"
            />
            <button type="button" class="pill-outline" :disabled="!opForm.extension.trim() || !opForm.userId" @click="addOperator"><Icon name="lucide:plus" class="w-4 h-4" />{{ t('contacts.addressesAdd') }}</button>
          </div>
        </div>
      </template>
    </div>
  </UModal>
</template>
