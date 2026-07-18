// Client-page identities: resolve display values for related-client identities
// (company / contact_person) and navigation to those related clients.
import { ref, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getClientsBatch } from '@/api/contacts/getClient';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import type { ClientIdentity } from '@/api/contacts/identities';

export interface UseClientIdentityDisplayDeps {
  identities: Ref<ClientIdentity[]>;
  contactsAppToken: Ref<string>;
  selectedNS: Ref<string | undefined>;
  nsSlug: Ref<string>;
  router: Router;
}

export function useClientIdentityDisplay(deps: UseClientIdentityDisplayDeps) {
  const { t } = useI18n();

  const identityDisplayValues = ref<Record<string, string>>({});
  const relatedClientTargets = ref<Record<string, string>>({});
  const relatedClientNames = ref<Record<string, string>>({});

  async function loadRelatedClientNames() {
    if (!deps.contactsAppToken.value || !deps.selectedNS.value) return;

    const identityRows = deps.identities.value || [];
    const relatedClientIds: string[] = [];

    for (const item of identityRows) {
      if ((item.type === 'company' || item.type === 'contact_person') && item.value?.trim()) {
        relatedClientIds.push(item.value.trim());
      }
    }

    if (relatedClientIds.length === 0) return;

    try {
      const clientsMap = await getClientsBatch(deps.contactsAppToken.value, deps.selectedNS.value, relatedClientIds);
      const namesMap: Record<string, string> = {};

      for (const id of relatedClientIds) {
        const clientData = clientsMap[id];
        if (!clientData) continue;

        let name = '';
        if (clientData.client.clientType === 'INDIVIDUAL' && clientData.individual) {
          const parts = [clientData.individual.lastName, clientData.individual.firstName].filter(Boolean);
          name = parts.join(' ');
        } else if (clientData.legalEntity?.legalName) {
          name = clientData.legalEntity.legalName;
        }

        if (name) {
          namesMap[id] = name;
        }
      }

      relatedClientNames.value = namesMap;
    } catch (error) {
      logError('Failed to load related client names:', error);
    }
  }

  async function resolveIdentityDisplayValues() {
    const displayMap: Record<string, string> = {};
    const targetMap: Record<string, string> = {};
    const identityRows = deps.identities.value || [];

    for (const item of identityRows) {
      const identityRef = item.value?.trim() || '';

      if (item.type === 'company' || item.type === 'contact_person') {
        // First try to use the loaded client name
        const clientName = relatedClientNames.value[identityRef];
        // Fall back to comments if it looks like a custom name (not a short ID)
        const comments = item.comments?.trim() || '';
        const customName = comments && !comments.match(/^[a-z0-9]{8}$/i) ? comments : '';
        // Use: clientName > customName > default text
        const name = clientName || customName || t('contacts.relatedClient');
        displayMap[item.id] = name;
        targetMap[item.id] = identityRef;
        continue;
      }

      if (item.type === 'phone' || item.type === 'whatsapp') {
        displayMap[item.id] = formatDisplayPhoneUniversal(item.value);
        continue;
      }

      displayMap[item.id] = item.value;
    }

    identityDisplayValues.value = displayMap;
    relatedClientTargets.value = targetMap;
  }

  function openRelatedClient(identity: ClientIdentity) {
    const target = relatedClientTargets.value[identity.id] || identity.value;
    deps.router.push(`/${deps.nsSlug.value}/contacts/${target}`);
  }

  return {
    identityDisplayValues,
    relatedClientTargets,
    relatedClientNames,
    loadRelatedClientNames,
    resolveIdentityDisplayValues,
    openRelatedClient,
  };
}
