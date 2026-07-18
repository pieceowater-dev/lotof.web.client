// Client-page core data: orchestrates loadClient() and owns the primary
// client/identities/tags/loyalty refs. Delegates events, dynamic fields and
// identity-display loading to sibling composables via injected hooks so each
// concern keeps a single owner while loadClient stays the one place that
// sequences them.
import { ref, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { getClientPageData } from '@/api/contacts/clientPage';
import { listTags, type Tag } from '@/api/contacts/tags';
import { getClientStampProgressBatch, type BonusBalance, type StampCard, type ClientStampProgress } from '@/api/contacts/loyalty';
import type { ClientRow } from '@/api/contacts/listClients';
import type { ClientIdentity } from '@/api/contacts/identities';
import type { ClientEvent } from '@/api/contacts/events';

export interface UseClientPageDeps {
  token: Ref<string | null | undefined>;
  selectedNS: Ref<string | undefined>;
  clientId: Ref<string>;
  router: Router;
}

export interface UseClientPageLoadHooks {
  loadIdentityDisplay: () => Promise<void>;
  loadEvents: (contactsToken: string, fullClientId: string, fallbackEvents: ClientEvent[]) => Promise<void>;
  loadDynamicFields: (contactsToken: string, namespace: string, entityId: string) => Promise<void>;
  resetDynamicFields: () => void;
}

export function useClientPage(deps: UseClientPageDeps) {
  const { t } = useI18n();
  const toast = useToast();

  const client = ref<ClientRow | null>(null);
  const identities = ref<ClientIdentity[]>([]);
  const tags = ref<Tag[]>([]);
  const tagNameById = ref<Record<string, string>>({});
  const bonusBalance = ref<BonusBalance | null>(null);
  const stampCards = ref<StampCard[]>([]);
  const stampProgress = ref<ClientStampProgress[]>([]);
  const contactsAppToken = ref('');
  const loading = ref(true);

  async function loadClient(hooks: UseClientPageLoadHooks) {
    if (!deps.token.value || !deps.selectedNS.value) {
      loading.value = false;
      return;
    }

    try {
      loading.value = true;
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(deps.selectedNS.value, deps.token.value);
      if (!contactsToken) return;
      contactsAppToken.value = contactsToken;

      let stampCardsList: StampCard[] = [];
      let fullClientId = '';

      try {
        // Aggregated GraphQL call for most client-page data.
        const pageData = await getClientPageData(contactsToken, deps.selectedNS.value, deps.clientId.value);
        if (!pageData.client) {
          toast.add({
            title: t('common.error'),
            description: t('contacts.loadError'),
            color: 'red',
          });
          deps.router.push(`/${deps.selectedNS.value}/contacts`);
          return;
        }

        client.value = pageData.client;
        fullClientId = pageData.client.client.id;
        identities.value = pageData.identities;
        tags.value = pageData.tags;
        tagNameById.value = {};

        try {
          const allTagsData = await listTags(contactsToken, deps.selectedNS.value);
          const nextTagNameById: Record<string, string> = {};
          for (const tag of (allTagsData?.tags?.rows || [])) {
            if (tag.id && tag.name) {
              nextTagNameById[tag.id] = tag.name;
            }
          }
          for (const tag of (pageData.tags || [])) {
            if (tag.id && tag.name) {
              nextTagNameById[tag.id] = tag.name;
            }
          }
          tagNameById.value = nextTagNameById;
        } catch (tagsError) {
          logError('Failed to load tags for timeline tag-name mapping:', tagsError);
        }

        bonusBalance.value = pageData.bonusBalance;
        stampCardsList = pageData.stampCards || [];
        stampCards.value = stampCardsList;

        await hooks.loadIdentityDisplay();

        // Always load timeline by full UUID to ensure all related client events are returned.
        await hooks.loadEvents(contactsToken, fullClientId, pageData.events || []);
      } catch (aggregatedError) {
        logError('Failed to load client page data:', aggregatedError);
        toast.add({
          title: t('common.error'),
          description: t('contacts.loadError'),
          color: 'red',
        });
        deps.router.push(`/${deps.selectedNS.value}/contacts`);
        return;
      }

      // Fetch stamp progress for all cards in one batched request
      if (stampCardsList.length > 0 && fullClientId) {
        try {
          stampProgress.value = await getClientStampProgressBatch(
            contactsToken,
            fullClientId,
            stampCardsList.map((c) => c.id),
          );
        } catch (error) {
          logError('Failed to load stamp progress:', error);
          stampProgress.value = [];
        }
      } else {
        stampProgress.value = [];
      }

      if (fullClientId) {
        await hooks.loadDynamicFields(contactsToken, deps.selectedNS.value, fullClientId);
      } else {
        hooks.resetDynamicFields();
      }
    } catch (error) {
      logError('Failed to load client:', error);
      toast.add({
        title: t('common.error'),
        description: t('contacts.loadError'),
        color: 'red',
      });
    } finally {
      loading.value = false;
    }
  }

  return {
    client,
    identities,
    tags,
    tagNameById,
    bonusBalance,
    stampCards,
    stampProgress,
    contactsAppToken,
    loading,
    loadClient,
  };
}
