// Client-page identities edit mode: draft phone/email/telegram/whatsapp lists,
// sync against the server, and save. Consumed by ContactIdentities.vue.
import { ref, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { createIdentity, deleteIdentity, setPrimaryIdentity, updateIdentity, type ClientIdentity } from '@/api/contacts/identities';
import type { ClientRow } from '@/api/contacts/listClients';

export interface UseClientIdentitiesEditDeps {
  client: Ref<ClientRow | null>;
  identities: Ref<ClientIdentity[]>;
  token: Ref<string | null | undefined>;
  selectedNS: Ref<string | undefined>;
  markLocalMutation: () => void;
  loadClient: () => Promise<void>;
}

export function useClientIdentitiesEdit(deps: UseClientIdentitiesEditDeps) {
  const { t } = useI18n();
  const toast = useToast();

  const editMode = ref(false);
  const backupIdentities = ref<ClientIdentity[]>([]);

  const editingPhones = ref<string[]>([]);
  const editingEmails = ref<string[]>([]);
  const editingTelegrams = ref<string[]>([]);
  const editingWhatsapps = ref<string[]>([]);

  function startEditIdentities() {
    backupIdentities.value = JSON.parse(JSON.stringify(deps.identities.value));

    editingPhones.value = deps.identities.value
      .filter(id => id.type === 'phone')
      .map(id => id.value)
      .slice(0, 5);
    if (editingPhones.value.length === 0) {
      editingPhones.value = [''];
    }

    editingEmails.value = deps.identities.value
      .filter(id => id.type === 'email')
      .map(id => id.value)
      .slice(0, 5);
    if (editingEmails.value.length === 0) {
      editingEmails.value = [''];
    }

    editingTelegrams.value = deps.identities.value
      .filter(id => id.type === 'telegram')
      .map(id => id.value)
      .slice(0, 5);
    if (editingTelegrams.value.length === 0) {
      editingTelegrams.value = [''];
    }

    editingWhatsapps.value = deps.identities.value
      .filter(id => id.type === 'whatsapp')
      .map(id => id.value)
      .slice(0, 5);
    if (editingWhatsapps.value.length === 0) {
      editingWhatsapps.value = [''];
    }

    editMode.value = true;
  }

  function cancelEditIdentities() {
    editMode.value = false;
    backupIdentities.value = [];
  }

  async function syncIdentityType(
    contactsToken: string,
    namespace: string,
    clientIdValue: string,
    type: 'phone' | 'email' | 'telegram' | 'whatsapp',
    desiredValues: string[],
    existingItems: ClientIdentity[],
  ) {
    const normalizedDesired = desiredValues.map(value => value.trim()).filter(Boolean);
    const resultingIds: string[] = [];
    const maxLength = Math.max(normalizedDesired.length, existingItems.length);

    for (let index = 0; index < maxLength; index += 1) {
      const desiredValue = normalizedDesired[index];
      const existingItem = existingItems[index];

      if (existingItem && desiredValue) {
        if (existingItem.value !== desiredValue) {
          const result = await updateIdentity(contactsToken, namespace, existingItem.id, desiredValue);
          resultingIds.push(result.updateIdentity.id);
        } else {
          resultingIds.push(existingItem.id);
        }
        continue;
      }

      if (existingItem && !desiredValue) {
        await deleteIdentity(contactsToken, namespace, existingItem.id);
        continue;
      }

      if (!existingItem && desiredValue) {
        const result = await createIdentity(contactsToken, namespace, clientIdValue, type, desiredValue, resultingIds.length === 0);
        resultingIds.push(result.createIdentity.id);
      }
    }

    if (resultingIds.length > 0) {
      await setPrimaryIdentity(contactsToken, namespace, resultingIds[0]);
    }
  }

  async function saveIdentities() {
    if (!deps.client.value) return;
    if (!deps.token.value || !deps.selectedNS.value) return;

    try {
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(deps.selectedNS.value, deps.token.value);
      if (!contactsToken) return;

      const clientIdValue = deps.client.value.client.id;
      await syncIdentityType(
        contactsToken,
        deps.selectedNS.value,
        clientIdValue,
        'phone',
        editingPhones.value,
        deps.identities.value.filter(id => id.type === 'phone'),
      );
      await syncIdentityType(
        contactsToken,
        deps.selectedNS.value,
        clientIdValue,
        'email',
        editingEmails.value,
        deps.identities.value.filter(id => id.type === 'email'),
      );
      await syncIdentityType(
        contactsToken,
        deps.selectedNS.value,
        clientIdValue,
        'telegram',
        editingTelegrams.value,
        deps.identities.value.filter(id => id.type === 'telegram'),
      );
      await syncIdentityType(
        contactsToken,
        deps.selectedNS.value,
        clientIdValue,
        'whatsapp',
        editingWhatsapps.value,
        deps.identities.value.filter(id => id.type === 'whatsapp'),
      );

      editMode.value = false;
      deps.markLocalMutation();
      await deps.loadClient();
      toast.add({
        title: t('common.success'),
        description: t('contacts.contactDataUpdated'),
        color: 'emerald',
      });
    } catch (error) {
      logError('Failed to save identities:', error);
      toast.add({
        title: t('common.error'),
        description: t('contacts.updateError'),
        color: 'red',
      });
    }
  }

  function addPhoneField() {
    if (editingPhones.value.length < 5) {
      editingPhones.value.push('');
    }
  }

  function removePhoneField(index: number) {
    if (editingPhones.value.length > 1) {
      editingPhones.value.splice(index, 1);
    }
  }

  function addEmailField() {
    if (editingEmails.value.length < 5) {
      editingEmails.value.push('');
    }
  }

  function removeEmailField(index: number) {
    if (editingEmails.value.length > 1) {
      editingEmails.value.splice(index, 1);
    }
  }

  function addTelegramField() {
    if (editingTelegrams.value.length < 5) {
      editingTelegrams.value.push('');
    }
  }

  function removeTelegramField(index: number) {
    if (editingTelegrams.value.length > 1) {
      editingTelegrams.value.splice(index, 1);
    }
  }

  function addWhatsappField() {
    if (editingWhatsapps.value.length < 5) {
      editingWhatsapps.value.push('');
    }
  }

  function removeWhatsappField(index: number) {
    if (editingWhatsapps.value.length > 1) {
      editingWhatsapps.value.splice(index, 1);
    }
  }

  return {
    editMode,
    editingPhones,
    editingEmails,
    editingTelegrams,
    editingWhatsapps,
    startEditIdentities,
    cancelEditIdentities,
    saveIdentities,
    addPhoneField,
    removePhoneField,
    addEmailField,
    removeEmailField,
    addTelegramField,
    removeTelegramField,
    addWhatsappField,
    removeWhatsappField,
  };
}
