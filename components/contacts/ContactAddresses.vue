<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { copyToClipboard } from '@/utils/contacts/contactActions';
import { logError } from '@/utils/logger';
import {
  listClientAddresses, createClientAddress, updateClientAddress, deleteClientAddress, mapLinkFor,
  type ClientAddress,
} from '@/api/contacts/addresses';

const props = defineProps<{ clientId?: string }>();
const emit = defineEmits<{ (e: 'changed', addresses: ClientAddress[]): void }>();

const { t } = useI18n();
const toast = useToast();
const { ctx } = useCrmAuth();

const addresses = ref<ClientAddress[]>([]);
const loading = ref(false);
const editing = ref<string | 'new' | null>(null);
const form = ref({ label: '', address: '', isPrimary: false, isDelivery: false });
const saving = ref(false);

async function load() {
  if (!props.clientId) return;
  const c = await ctx();
  if (!c) return;
  loading.value = true;
  try {
    addresses.value = await listClientAddresses(c.token, c.ns, props.clientId);
    emit('changed', addresses.value);
  } catch (e) {
    logError('Failed to load addresses:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.clientId, load);

function startNew() {
  form.value = { label: '', address: '', isPrimary: false, isDelivery: false };
  editing.value = 'new';
}

function startEdit(a: ClientAddress) {
  form.value = { label: a.label, address: a.address, isPrimary: a.isPrimary, isDelivery: a.isDelivery };
  editing.value = a.id;
}

async function save() {
  if (!props.clientId || !form.value.address.trim()) return;
  const c = await ctx();
  if (!c) return;
  saving.value = true;
  try {
    const input = { ...form.value, address: form.value.address.trim() };
    if (editing.value === 'new') await createClientAddress(c.token, c.ns, props.clientId, input);
    else await updateClientAddress(c.token, c.ns, editing.value!, input);
    editing.value = null;
    await load();
  } catch (e) {
    logError('Failed to save address:', e);
    toast.add({ title: t('common.error'), description: t('contacts.addressError'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function remove(a: ClientAddress) {
  const c = await ctx();
  if (!c) return;
  try {
    await deleteClientAddress(c.token, c.ns, a.id);
    await load();
  } catch (e) {
    logError('Failed to delete address:', e);
    toast.add({ title: t('common.error'), description: t('contacts.addressError'), color: 'red' });
  }
}

const copy = (text: string) => copyToClipboard(text, toast, t);
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <UIcon name="lucide:map-pin" class="w-5 h-5 text-sky-500" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex-1">{{ t('contacts.addressesTitle') }}</h2>
      <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="startNew">{{ t('contacts.addressesAdd') }}</UButton>
    </div>

    <div class="px-5 py-4 space-y-2">
      <div v-if="!loading && !addresses.length && editing !== 'new'" class="text-sm text-gray-400">{{ t('contacts.addressEmpty') }}</div>

      <div
        v-for="a in addresses"
        :key="a.id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
      >
        <template v-if="editing === a.id" />
        <template v-else>
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="a.label" class="font-medium">{{ a.label }}</span>
                <span v-if="a.isPrimary" class="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">{{ t('contacts.addressPrimaryBadge') }}</span>
                <span v-if="a.isDelivery" class="text-[11px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">{{ t('contacts.addressDeliveryBadge') }}</span>
              </div>
              <div class="text-gray-700 dark:text-gray-200 break-words">{{ a.address }}</div>
            </div>
            <div class="flex items-center gap-1.5 text-gray-500">
              <a :href="mapLinkFor(a)" target="_blank" rel="noopener" :title="t('contacts.addressMap')" class="hover:text-gray-900 dark:hover:text-white">
                <UIcon name="lucide:map" class="w-4 h-4" />
              </a>
              <button :title="t('contacts.addressCopy')" class="hover:text-gray-900 dark:hover:text-white" @click="copy(a.address)">
                <UIcon name="lucide:copy" class="w-4 h-4" />
              </button>
              <button :title="t('contacts.notesEdit')" class="hover:text-gray-900 dark:hover:text-white" @click="startEdit(a)">
                <UIcon name="lucide:pencil" class="w-4 h-4" />
              </button>
              <button :title="t('contacts.addressDelete')" class="hover:text-red-600" @click="remove(a)">
                <UIcon name="lucide:trash-2" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </template>
      </div>

      <div v-if="editing" class="rounded-lg border border-emerald-300 dark:border-emerald-800 px-3 py-3 space-y-2">
        <UInput v-model="form.label" size="sm" :placeholder="t('contacts.addressLabel')" />
        <UTextarea v-model="form.address" :rows="2" autoresize :placeholder="t('contacts.addressText')" />
        <div class="flex items-center gap-4 text-sm flex-wrap">
          <label class="flex items-center gap-1 cursor-pointer"><input v-model="form.isPrimary" type="checkbox"> {{ t('contacts.addressPrimary') }}</label>
          <label class="flex items-center gap-1 cursor-pointer"><input v-model="form.isDelivery" type="checkbox"> {{ t('contacts.addressDelivery') }}</label>
          <span class="flex-1" />
          <UButton size="xs" color="gray" variant="soft" @click="editing = null">{{ t('common.cancel') }}</UButton>
          <UButton size="xs" :loading="saving" :disabled="!form.address.trim()" @click="save">{{ t('contacts.notesSave') }}</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
