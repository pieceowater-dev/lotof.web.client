<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { copyToClipboard } from '@/utils/contacts/contactActions';
import { logError } from '@/utils/logger';
import { makeCall, listCalls, type Call } from '@/api/contacts/telephony';
import type { ClientAddress } from '@/api/contacts/addresses';

interface Identity { id: string; type: string; value: string; isPrimary: boolean }

const props = defineProps<{
  clientId?: string;
  displayName: string;
  identities: Identity[];
  addresses: ClientAddress[];
}>();

const { t } = useI18n();
const toast = useToast();
const { ctx } = useCrmAuth();

const phones = computed(() => props.identities.filter(i => i.type === 'phone'));
const emails = computed(() => props.identities.filter(i => i.type === 'email'));
const primaryPhone = computed(() => phones.value.find(p => p.isPrimary) || phones.value[0]);
const calling = ref(false);
const lastCall = ref<Call | null>(null);

async function loadLastCall() {
  if (!props.clientId) return;
  const c = await ctx();
  if (!c) return;
  try {
    const res = await listCalls(c.token, c.ns, { clientId: props.clientId, pagination: { page: 1, length: 'TEN' } });
    lastCall.value = res.rows[0] || null;
  } catch (e) {
    logError('Failed to load last call:', e);
  }
}

onMounted(loadLastCall);
watch(() => props.clientId, loadLastCall);

async function call(phone: string) {
  calling.value = true;
  try {
    const c = await ctx();
    if (c) {
      const res = await makeCall(c.token, c.ns, phone, props.clientId);
      if (res.supported) {
        toast.add({ title: t('contacts.quickCallStarted'), color: 'emerald' });
        return;
      }
    }
    // The provider cannot place calls (or none is configured): plain tel: link.
    window.location.href = `tel:${phone}`;
  } catch (e) {
    logError('Call failed:', e);
    toast.add({ title: t('common.error'), description: t('contacts.quickCallError'), color: 'red' });
    window.location.href = `tel:${phone}`;
  } finally {
    calling.value = false;
  }
}

function summary(): string {
  const lines = [props.displayName];
  for (const p of phones.value) lines.push(`${t('contacts.quickPhone')}: ${p.value}`);
  for (const e of emails.value) lines.push(`${t('contacts.quickEmail')}: ${e.value}`);
  for (const a of props.addresses) lines.push(`${a.label ? a.label + ': ' : ''}${a.address}`);
  return lines.filter(Boolean).join('\n');
}

const copy = (text: string) => copyToClipboard(text, toast, t);

const lastCallText = computed(() => {
  const c = lastCall.value;
  if (!c) return '';
  const dir = c.direction === 'OUT' ? t('contacts.callOut') : t('contacts.callIn');
  const st = c.inProgress && !c.status ? t('contacts.callStatus_IN_PROGRESS') : t(`contacts.callStatus_${c.status || 'UNKNOWN'}`);
  return `${dir} · ${st} · ${new Date(c.startedAt).toLocaleString()}`;
});
</script>

<template>
  <div v-if="primaryPhone || phones.length" class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3 sm:px-5 sm:py-4 space-y-2">
    <!-- Hot path: one big call button; copy actions are quiet icon buttons beside it. -->
    <div class="flex items-center gap-2">
      <UButton
        v-if="primaryPhone"
        size="md"
        color="primary" variant="soft"
        icon="lucide:phone"
        :loading="calling"
        class="min-w-0 flex-1 justify-center"
        @click="call(primaryPhone.value)"
      >
        <span class="truncate">{{ t('contacts.quickCall') }} {{ primaryPhone.value }}</span>
      </UButton>
      <UButton v-if="primaryPhone" size="md" color="gray" variant="soft" icon="lucide:copy" class="flex-shrink-0" :aria-label="t('contacts.quickCopyPhone')" :title="t('contacts.quickCopyPhone')" @click="copy(primaryPhone.value)" />
      <UButton size="md" color="gray" variant="soft" icon="lucide:clipboard-list" class="flex-shrink-0" :aria-label="t('contacts.quickCopySummary')" :title="t('contacts.quickCopySummary')" @click="copy(summary())" />
    </div>
    <div v-if="phones.length > 1" class="flex flex-wrap items-center gap-2">
      <UButton
        v-for="p in phones.filter(x => x.id !== primaryPhone?.id)"
        :key="p.id"
        size="sm"
        color="gray"
        variant="soft"
        icon="lucide:phone"
        @click="call(p.value)"
      >
        {{ p.value }}
      </UButton>
    </div>
    <p v-if="lastCallText" class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('contacts.quickLastCall') }}: {{ lastCallText }}
    </p>
  </div>
</template>
