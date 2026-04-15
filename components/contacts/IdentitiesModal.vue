<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { useToast } from '#imports';
import type { ClientIdentity } from '@/api/contacts/identities';
import { 
  getClientIdentities,
  createIdentity,
  deleteIdentity,
  verifyIdentity,
  setPrimaryIdentity
} from '@/api/contacts/identities';

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { ensure } = useContactsToken();
const { selected: selectedNS } = useNamespace();

const props = defineProps<{
  isOpen: boolean;
  clientId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'identityCreated', identity: ClientIdentity): void;
}>();

const identities = ref<ClientIdentity[]>([]);
const loading = ref(false);
const isCreating = ref(false);
const newType = ref('email');
const newValue = ref('');

const identityTypes = ['email', 'phone', 'telegram', 'whatsapp'];

async function loadIdentities() {
  if (!token.value || !selectedNS.value) return;
  try {
    loading.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    const response = await getClientIdentities(contactsToken, props.clientId, selectedNS.value);
    identities.value = response.clientIdentities?.rows || [];
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to load identities',
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function handleCreateIdentity() {
  if (!newValue.value.trim() || !token.value || !selectedNS.value) return;
  
  try {
    isCreating.value = true;
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    const newIdentity = await createIdentity(
      contactsToken,
      selectedNS.value,
      props.clientId,
      newType.value,
      newValue.value.trim()
    );
    identities.value.push(newIdentity.createIdentity);
    newValue.value = '';
    emit('identityCreated', newIdentity.createIdentity);
    toast.add({
      title: t('common.success'),
      description: 'Contact added successfully',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to add contact',
      color: 'red',
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleDeleteIdentity(id: string) {
  if (!token.value || !selectedNS.value) return;
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    await deleteIdentity(contactsToken, selectedNS.value, id);
    identities.value = identities.value.filter(i => i.id !== id);
    toast.add({
      title: t('common.success'),
      description: 'Contact deleted successfully',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to delete contact',
      color: 'red',
    });
  }
}

async function handleVerifyIdentity(id: string) {
  if (!token.value || !selectedNS.value) return;
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    await verifyIdentity(contactsToken, selectedNS.value, id);
    const identity = identities.value.find(i => i.id === id);
    if (identity) {
      identity.verifiedAt = new Date().toISOString();
    }
    toast.add({
      title: t('common.success'),
      description: 'Contact verified',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to verify contact',
      color: 'red',
    });
  }
}

async function handleSetPrimary(id: string) {
  if (!token.value || !selectedNS.value) return;
  try {
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    await setPrimaryIdentity(contactsToken, selectedNS.value, id);
    identities.value.forEach(i => {
      i.isPrimary = i.id === id;
    });
    toast.add({
      title: t('common.success'),
      description: 'Primary contact set',
      color: 'emerald',
    });
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: 'Failed to set primary contact',
      color: 'red',
    });
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadIdentities();
  }
});
</script>

<template>
  <UModal
    :model-value="isOpen"
    title="Manage Contact Information"
    @update:model-value="$emit('close')"
  >
    <div class="p-4 space-y-4">
      <!-- Add new identity -->
      <div class="flex gap-2">
        <USelect
          v-model="newType"
          :options="identityTypes"
          size="sm"
        />
        <UInput
          v-model="newValue"
          :placeholder="`Enter ${newType}...`"
          size="sm"
          @keyup.enter="handleCreateIdentity"
        />
        <UButton
          :loading="isCreating"
          size="sm"
          @click="handleCreateIdentity"
        >
          {{ t('common.add') }}
        </UButton>
      </div>

      <!-- Identities list -->
      <div
        v-if="loading"
        class="flex justify-center py-8"
      >
        <UIcon
          name="lucide:loader"
          class="w-6 h-6 animate-spin text-gray-400"
        />
      </div>

      <div
        v-else
        class="space-y-2 max-h-[400px] overflow-y-auto"
      >
        <div
          v-for="identity in identities"
          :key="identity.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <UIcon 
                :name="identity.type === 'email' ? 'lucide:mail' : 'lucide:phone'" 
                class="w-4 h-4"
              />
              <div>
                <div class="text-sm font-medium">
                  {{ identity.value }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ identity.type }}
                  <span
                    v-if="identity.isPrimary"
                    class="ml-2 text-emerald-600 dark:text-emerald-400"
                  >• Primary</span>
                  <span
                    v-if="identity.verifiedAt"
                    class="ml-2 text-emerald-600 dark:text-emerald-400"
                  >✓ Verified</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton
              v-if="!identity.isPrimary"
              size="xs"
              color="blue"
              variant="ghost"
              icon="lucide:star"
              title="Set as primary"
              @click="handleSetPrimary(identity.id)"
            />
            <UButton
              v-if="!identity.verifiedAt"
              size="xs"
              color="emerald"
              variant="ghost"
              icon="lucide:check-circle-2"
              title="Verify identity"
              @click="handleVerifyIdentity(identity.id)"
            />
            <UButton
              size="xs"
              color="red"
              variant="ghost"
              icon="lucide:trash-2"
              @click="handleDeleteIdentity(identity.id)"
            />
          </div>
        </div>

        <div
          v-if="!loading && identities.length === 0"
          class="text-center py-8 text-gray-500 text-sm"
        >
          No contact information yet. Add one to get started.
        </div>
      </div>
    </div>
  </UModal>
</template>
