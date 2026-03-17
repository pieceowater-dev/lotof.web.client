<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { contactsUpdateClientStatus, contactsUpdateIndividualClient, contactsUpdateLegalEntityClient } from '@/api/contacts/mutations';
import { contactsListClients, type ClientRow } from '@/api/contacts/listClients';
import { getClient } from '@/api/contacts/getClient';
import { createIdentity, deleteIdentity, getClientIdentities, setPrimaryIdentity, updateIdentity, type ClientIdentity } from '@/api/contacts/identities';
import { getClientTags } from '@/api/contacts/tags';
import { getClientEvents, type ClientEvent } from '@/api/contacts/events';
import { getBonusBalance, getStampCards, getClientStampProgress, type BonusBalance, type StampCard, type ClientStampProgress } from '@/api/contacts/loyalty';
import { getClientPageData } from '@/api/contacts/clientPage';
import { subscribeClientChanged } from '@/api/contacts/subscriptions';
import { useNamespace } from '@/composables/useNamespace';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import ContactHeader from '@/components/contacts/ContactHeader.vue';
import ContactPersonalInfo from '@/components/contacts/ContactPersonalInfo.vue';
import ContactIdentities from '@/components/contacts/ContactIdentities.vue';
import ContactLoyalty from '@/components/contacts/ContactLoyalty.vue';
import ContactTimeline from '@/components/contacts/ContactTimeline.vue';
import ContactTags from '@/components/contacts/ContactTags.vue';
import TagsModal from '@/components/contacts/TagsModal.vue';

definePageMeta({
  viewTransition: false,
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const { token, user } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();
const clientId = computed(() => route.params.id as string);
const contactsAppToken = ref('');
const createdByUserId = computed(() => user.value?.id || '00000000-0000-0000-0000-000000000000');

const client = ref<ClientRow | null>(null);
const identities = ref<ClientIdentity[]>([]);
const tags = ref<any[]>([]);
const events = ref<ClientEvent[]>([]);
const bonusBalance = ref<BonusBalance | null>(null);
const stampCards = ref<StampCard[]>([]);
const stampProgress = ref<ClientStampProgress[]>([]);
const loading = ref(true);
const statusChangeLoading = ref(false);
const isTagsModalOpen = ref(false);
const isClientDataStale = ref(false);

let stopClientSubscription: (() => void) | null = null;

// Mock data for preview
const useMockData = ref(false);

// Edit mode state
const editMode = ref({
  personalInfo: false,
  identities: false,
});

// Backup for canceling edits
const backupClient = ref<ClientRow | null>(null);
const backupIdentities = ref<ClientIdentity[]>([]);

// Edit form data - Personal Info
const editingFirstName = ref('');
const editingLastName = ref('');
const editingMiddleName = ref('');
const editingBirthDate = ref('');
const editingGender = ref<boolean | null>(null);
const editingLegalName = ref('');
const editingBrandName = ref('');
const editingBinIin = ref('');
const editingRegistrationCountry = ref('');
const editingRegistrationDate = ref('');
const editingAdditionalInfo = ref('');

// Edit form data - Identities
const editingPhones = ref<string[]>([]);
const editingEmails = ref<string[]>([]);
const editingTelegrams = ref<string[]>([]);
const editingWhatsapps = ref<string[]>([]);
const identityDisplayValues = ref<Record<string, string>>({});

function getPrimaryPhoneIdentity(): ClientIdentity | undefined {
  return identities.value.find((item) => item.type === 'phone' && item.isPrimary) || identities.value.find((item) => item.type === 'phone');
}

function getAdditionalInfoValue(): string {
  return getPrimaryPhoneIdentity()?.comments?.trim() || client.value?.additionalInfo?.trim() || '';
}

const displayName = computed(() => {
  if (!client.value) return '';
  const c = client.value;
  if (c.client.clientType === 'INDIVIDUAL' && c.individual) {
    const parts = [c.individual.lastName, c.individual.firstName, c.individual.middleName].filter(Boolean);
    return parts.join(' ');
  }
  return c.legalEntity?.legalName || '---';
});

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return displayName.value ? `${displayName.value} — ${nsTitle.value}` : t('common.loading');
});

function isUnimplementedError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '');
  return message.includes('Unimplemented') || message.includes('not implemented');
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getClientDisplayName(row: ClientRow | null | undefined): string {
  if (!row) return '';
  if (row.client.clientType === 'INDIVIDUAL' && row.individual) {
    return [row.individual.lastName, row.individual.firstName, row.individual.middleName]
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return row.legalEntity?.legalName || '';
}

async function tryEnrichClient(contactsToken: string, namespace: string) {
  if (!client.value) return;
  if (client.value.individual || client.value.legalEntity) return;

  try {
    const list = await contactsListClients(contactsToken, namespace, {
      search: client.value.client.id,
      pagination: { page: 1, length: 'TEN' },
    });
    const matched = (list.rows || []).find((row) => row.client.id === client.value?.client.id);
    if (!matched || !client.value) return;

    client.value = {
      ...client.value,
      individual: matched.individual,
      legalEntity: matched.legalEntity,
    };
  } catch (error) {
    logError('Failed to enrich client with list fallback:', error);
  }
}

async function resolveIdentityDisplayValues(contactsToken: string, namespace: string) {
  const displayMap: Record<string, string> = {};
  const identityRows = identities.value || [];

  const relatedUUIDs = Array.from(
    new Set(
      identityRows
        .filter((item) => (item.type === 'contact_person' || item.type === 'company') && isUUID(item.value))
        .map((item) => item.value),
    ),
  );

  const relatedNames: Record<string, string> = {};
  await Promise.all(relatedUUIDs.map(async (uuid) => {
    try {
      const related = await getClient(contactsToken, namespace, uuid);
      const relatedName = getClientDisplayName(related as ClientRow);
      if (relatedName) {
        relatedNames[uuid] = relatedName;
      }
    } catch {
      // ignore unresolved related clients
    }
  }));

  for (const item of identityRows) {
    if (item.type === 'company' || item.type === 'contact_person') {
      displayMap[item.id] = item.comments?.trim() || relatedNames[item.value] || t('contacts.relatedClient');
      continue;
    }
    if (item.type === 'phone' || item.type === 'whatsapp') {
      displayMap[item.id] = formatDisplayPhoneUniversal(item.value);
      continue;
    }
    displayMap[item.id] = item.value;
  }

  identityDisplayValues.value = displayMap;
}

useHead(() => ({
  title: pageTitle.value,
}));

onMounted(async () => {
  await loadClient();
  await initClientSubscription();
});

onBeforeUnmount(() => {
  if (stopClientSubscription) {
    stopClientSubscription();
    stopClientSubscription = null;
  }
});

watch([() => token.value, () => selectedNS.value, () => client.value?.client.id], async () => {
  await initClientSubscription();
});

function markLocalMutation() {
  isClientDataStale.value = false;
}

async function initClientSubscription() {
  if (!token.value || !selectedNS.value || !client.value?.client.id) return;

  const { ensure } = useContactsToken();
  const contactsToken = await ensure(selectedNS.value, token.value);
  if (!contactsToken) return;

  if (stopClientSubscription) {
    stopClientSubscription();
    stopClientSubscription = null;
  }

  stopClientSubscription = subscribeClientChanged(
    contactsToken,
    selectedNS.value,
    (event) => {
      // Only handle events for this specific client
      if (event.clientId !== client.value?.client.id) return;
      
      // Don't show stale banner for our own changes
      const currentUserId = user.value?.id || '';
      if (event.changedBy === currentUserId) return;
      
      isClientDataStale.value = true;
    },
    () => {
      // Fallback is manual reload; no hard failure for the page.
    },
  );
}

async function refreshStaleClientData() {
  await loadClient();
  isClientDataStale.value = false;
}

async function loadClient() {
  // Use mock data for preview
  if (useMockData.value) {
    loading.value = true;
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock client data
    client.value = {
      client: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortId: 'a9B2mX7q',
        clientType: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-03-01T14:22:00Z',
      },
      individual: {
        firstName: 'Александр',
        lastName: 'Петров',
        middleName: 'Иванович',
        birthDate: '1990-05-15',
        gender: true,
      },
      tags: [],
    };

    const mockClientId = client.value.client.id;
    
    // Mock identities
    identities.value = [
      {
        id: '1',
        clientId: mockClientId,
        type: 'phone',
        value: '+7 (777) 123-45-67',
        isPrimary: true,
        verifiedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        clientId: mockClientId,
        type: 'email',
        value: 'a.petrov@example.com',
        isPrimary: true,
        verifiedAt: '2024-01-16T11:20:00Z',
      },
      {
        id: '3',
        clientId: mockClientId,
        type: 'telegram',
        value: '@apetrov',
        isPrimary: false,
      },
    ];
    
    // Mock tags
    tags.value = [
      { id: '1', name: 'VIP' },
      { id: '2', name: 'Постоянный клиент' },
      { id: '3', name: 'Оптовик' },
    ];
    
    // Mock events
    events.value = [
      {
        id: '1',
        clientId: mockClientId,
        eventType: 'CLIENT_CREATED',
        payload: '{}',
        createdAt: '2024-01-15T10:30:00Z',
        createdBy: 'system',
      },
      {
        id: '2',
        clientId: mockClientId,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'phone', value: '+7 (777) 123-45-67' }),
        createdAt: '2024-01-15T10:31:00Z',
        createdBy: 'system',
      },
      {
        id: '3',
        clientId: mockClientId,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'email', value: 'a.petrov@example.com' }),
        createdAt: '2024-01-16T11:20:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '4',
        clientId: mockClientId,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'VIP' }),
        createdAt: '2024-01-20T09:15:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '5',
        clientId: mockClientId,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'Постоянный клиент' }),
        createdAt: '2024-01-22T14:30:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '6',
        clientId: mockClientId,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 1500, reason: 'REGISTRATION' }),
        createdAt: '2024-02-01T08:00:00Z',
        createdBy: 'system',
      },
      {
        id: '7',
        clientId: mockClientId,
        eventType: 'BONUS_SPENT',
        payload: JSON.stringify({ amount: 500, description: 'Скидка 10% на покупку' }),
        createdAt: '2024-02-05T16:45:00Z',
        createdBy: 'system',
      },
      {
        id: '8',
        clientId: mockClientId,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'Оптовик' }),
        createdAt: '2024-02-08T10:20:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '9',
        clientId: mockClientId,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'telegram', value: '@apetrov' }),
        createdAt: '2024-02-10T12:00:00Z',
        createdBy: 'user',
      },
      {
        id: '10',
        clientId: mockClientId,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 2500, reason: 'PURCHASE' }),
        createdAt: '2024-02-15T09:30:00Z',
        createdBy: 'system',
      },
      {
        id: '11',
        clientId: mockClientId,
        eventType: 'TIER_UPGRADED',
        payload: JSON.stringify({ from: 'SILVER', to: 'GOLD' }),
        createdAt: '2024-02-20T13:22:00Z',
        createdBy: 'system',
      },
      {
        id: '12',
        clientId: mockClientId,
        eventType: 'BONUS_SPENT',
        payload: JSON.stringify({ amount: 1200, description: 'Скидка 20% на покупку' }),
        createdAt: '2024-02-22T11:15:00Z',
        createdBy: 'system',
      },
      {
        id: '13',
        clientId: mockClientId,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 3000, reason: 'TIER_BONUS' }),
        createdAt: '2024-02-25T08:00:00Z',
        createdBy: 'system',
      },
      {
        id: '14',
        clientId: mockClientId,
        eventType: 'IDENTITY_VERIFIED',
        payload: JSON.stringify({ type: 'email', value: 'a.petrov@example.com' }),
        createdAt: '2024-02-26T15:45:00Z',
        createdBy: 'system',
      },
      {
        id: '15',
        clientId: mockClientId,
        eventType: 'COMMENT_ADDED',
        payload: JSON.stringify({ text: 'Звоним только с 10:00 до 12:00' }),
        createdAt: '2024-02-28T09:00:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '16',
        clientId: mockClientId,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 1800, reason: 'VISIT' }),
        createdAt: '2024-03-01T10:30:00Z',
        createdBy: 'system',
      },
      {
        id: '17',
        clientId: mockClientId,
        eventType: 'STATUS_CHANGED',
        payload: JSON.stringify({ from: 'ACTIVE', to: 'ACTIVE' }),
        createdAt: '2024-03-01T14:22:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '18',
        clientId: mockClientId,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'whatsapp', value: '+7 777 123-45-67' }),
        createdAt: '2024-03-02T10:15:00Z',
        createdBy: 'user',
      },
      {
        id: '19',
        clientId: mockClientId,
        eventType: 'RECORD_UPDATED',
        payload: JSON.stringify({ field: 'birthDate', oldValue: '1990-05-15', newValue: '1990-05-15' }),
        createdAt: '2024-03-02T11:00:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '20',
        clientId: mockClientId,
        eventType: 'BONUS_EXPIRED',
        payload: JSON.stringify({ amount: 520 }),
        createdAt: '2024-03-02T23:59:00Z',
        createdBy: 'system',
      },
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Mock bonus balance
    bonusBalance.value = {
      clientId: mockClientId,
      totalBonuses: 15420,
      availableBonuses: 12850,
      expiringSoon: 2570,
      updatedAt: '2024-03-01T14:22:00Z',
    };
    
    // Mock stamp cards and progress
    stampCards.value = [
      {
        id: 'stamp-1',
        name: 'Кофейная карта',
        description: 'Каждый 10-й кофе бесплатно',
        type: 'COFFEE',
        status: 'ACTIVE',
        totalStamps: 10,
        rewardDescription: 'Бесплатный кофе любого размера',
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: '2024-12-31T23:59:59Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'stamp-2',
        name: 'Обеды',
        description: 'Соберите 15 штампов за обеды',
        type: 'MEAL',
        status: 'ACTIVE',
        totalStamps: 15,
        rewardDescription: 'Скидка 50% на следующий обед',
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    
    stampProgress.value = [
      {
        id: 'progress-1',
        clientId: mockClientId,
        stampCardId: 'stamp-1',
        currentStamps: 7,
        completedRounds: 3,
        lastStampAt: '2024-02-28T12:30:00Z',
        stampCard: stampCards.value[0],
      },
      {
        id: 'progress-2',
        clientId: mockClientId,
        stampCardId: 'stamp-2',
        currentStamps: 11,
        completedRounds: 0,
        lastStampAt: '2024-02-27T13:15:00Z',
        stampCard: stampCards.value[1],
      },
    ];
    
    loading.value = false;
    return;
  }
  
  // Real data loading
  if (!token.value || !selectedNS.value) {
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;
    contactsAppToken.value = contactsToken;

    let stampCardsList: StampCard[] = [];
    let fullClientId = '';

    try {
      // Aggregated GraphQL call for most client-page data.
      const pageData = await getClientPageData(contactsToken, selectedNS.value, clientId.value);
      if (!pageData.client) {
        toast.add({
          title: t('common.error'),
          description: t('contacts.loadError'),
          color: 'red',
        });
        router.push(`/${selectedNS.value}/contacts`);
        return;
      }

      client.value = pageData.client;
      fullClientId = pageData.client.client.id;
      identities.value = pageData.identities;
      tags.value = pageData.tags;
      events.value = (pageData.events || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      bonusBalance.value = pageData.bonusBalance;
      stampCardsList = pageData.stampCards || [];
      stampCards.value = stampCardsList;

      await tryEnrichClient(contactsToken, selectedNS.value);
      await resolveIdentityDisplayValues(contactsToken, selectedNS.value);
    } catch (aggregatedError) {
      logError('Failed to load aggregated client page data, falling back:', aggregatedError);

      const clientData = await getClient(contactsToken, selectedNS.value, clientId.value);
      if (!clientData) {
        toast.add({
          title: t('common.error'),
          description: t('contacts.loadError'),
          color: 'red',
        });
        router.push(`/${selectedNS.value}/contacts`);
        return;
      }

      client.value = clientData;
      await tryEnrichClient(contactsToken, selectedNS.value);

      fullClientId = client.value.client.id;

      const [identitiesResult, tagsResult, eventsResult, bonusBalanceResult, stampCardsResult] =
        await Promise.allSettled([
          getClientIdentities(contactsToken, fullClientId, selectedNS.value),
          getClientTags(contactsToken, selectedNS.value, fullClientId),
          getClientEvents(contactsToken, fullClientId),
          getBonusBalance(contactsToken, fullClientId),
          getStampCards(contactsToken),
        ]);

      if (identitiesResult.status === 'fulfilled') {
        try {
          identities.value = identitiesResult.value.clientIdentities.rows;
          await resolveIdentityDisplayValues(contactsToken, selectedNS.value);
        } catch (error) {
          logError('Failed to process identities:', error);
          identities.value = [];
          identityDisplayValues.value = {};
        }
      } else {
        if (!isUnimplementedError(identitiesResult.reason)) {
          logError('Failed to load identities:', identitiesResult.reason);
        }
        identities.value = [];
        identityDisplayValues.value = {};
      }

      if (tagsResult.status === 'fulfilled') {
        tags.value = tagsResult.value.clientTags?.tags || (tagsResult.value as any).tags || [];
      } else {
        if (!isUnimplementedError(tagsResult.reason)) {
          logError('Failed to load tags:', tagsResult.reason);
        }
        tags.value = [];
      }

      if (eventsResult.status === 'fulfilled') {
        events.value = eventsResult.value.rows.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } else {
        if (!isUnimplementedError(eventsResult.reason)) {
          logError('Failed to load events:', eventsResult.reason);
        }
        events.value = [];
      }

      if (bonusBalanceResult.status === 'fulfilled') {
        bonusBalance.value = bonusBalanceResult.value;
      } else {
        if (!isUnimplementedError(bonusBalanceResult.reason)) {
          logError('Failed to load bonus balance:', bonusBalanceResult.reason);
        }
        bonusBalance.value = null;
      }

      if (stampCardsResult.status === 'fulfilled' && stampCardsResult.value) {
        stampCardsList = stampCardsResult.value;
        stampCards.value = stampCardsList;
      } else {
        if (stampCardsResult.status === 'rejected' && !isUnimplementedError(stampCardsResult.reason)) {
          logError('Failed to load stamp cards:', stampCardsResult.reason);
        }
        stampCardsList = [];
        stampCards.value = [];
      }
    }

    // Process stamp cards and progress (separate round-trip per card is still required by API)
    if (stampCardsList.length > 0 && fullClientId) {
      try {
        const progressPromises = stampCardsList.map(card =>
          getClientStampProgress(contactsToken, fullClientId, card.id),
        );
        const progressResults = await Promise.all(progressPromises);
        stampProgress.value = progressResults.filter(p => p !== null) as ClientStampProgress[];
      } catch (error) {
        logError('Failed to load stamp progress:', error);
        stampProgress.value = [];
      }
    } else {
      stampProgress.value = [];
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

async function updateStatus(newStatus: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED') {
  if (!token.value || !selectedNS.value || !client.value) return;

  try {
    statusChangeLoading.value = true;
    await contactsUpdateClientStatus(token.value, selectedNS.value, clientId.value, newStatus);
    client.value.client.status = newStatus;
    markLocalMutation();
    toast.add({
      title: t('common.success'),
      description: t('contacts.statusUpdated'),
      color: 'green',
    });
  } catch (error) {
    logError('Failed to update client status:', error);
    toast.add({
      title: t('common.error'),
      description: t('contacts.updateError'),
      color: 'red',
    });
  } finally {
    statusChangeLoading.value = false;
  }
}

async function copyToClipboard(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
    toast.add({
      title: t('contacts.copied'),
      icon: 'i-heroicons-clipboard-document-check',
      color: 'green',
    });
  } catch (err) {
    logError('Failed to copy to clipboard', err);
    toast.add({
      title: t('contacts.copyFailed'),
      color: 'red',
    });
  }
}

function handlePhoneAction(phone: string) {
  window.location.href = `tel:${phone}`;
}

function handleEmailAction(email: string) {
  window.location.href = `mailto:${email}`;
}

function handleTelegramAction(telegram: string) {
  const handle = telegram.replace(/^@/, '');
  window.open(`https://t.me/${handle}`, '_blank');
}

function handleWhatsappAction(phone: string) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}`, '_blank');
}

function handleBack() {
  const nsSlug = route.params.namespace as string;
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push(`/${nsSlug}/contacts/all/1-20`);
  }
}

// Edit mode functions
function startEditPersonalInfo() {
  if (!client.value) return;
  
  backupClient.value = JSON.parse(JSON.stringify(client.value));
  
  if (client.value.individual) {
    editingFirstName.value = client.value.individual.firstName;
    editingLastName.value = client.value.individual.lastName;
    editingMiddleName.value = client.value.individual.middleName || '';
    editingBirthDate.value = client.value.individual.birthDate ? new Date(client.value.individual.birthDate).toISOString().split('T')[0] : '';
    editingGender.value = client.value.individual.gender !== undefined ? client.value.individual.gender : null;
  } else if (client.value.legalEntity) {
    editingLegalName.value = client.value.legalEntity.legalName;
    editingBrandName.value = client.value.legalEntity.brandName || '';
    editingBinIin.value = client.value.legalEntity.binIin || '';
    editingRegistrationCountry.value = client.value.legalEntity.registrationCountry || '';
    editingRegistrationDate.value = client.value.legalEntity.registrationDate ? new Date(client.value.legalEntity.registrationDate).toISOString().split('T')[0] : '';
  }
  editingAdditionalInfo.value = getAdditionalInfoValue();
  
  editMode.value.personalInfo = true;
}

function cancelEditPersonalInfo() {
  editMode.value.personalInfo = false;
  backupClient.value = null;
}

async function savePersonalInfo() {
  if (!client.value) return;

  if (useMockData.value) {
    if (client.value.individual) {
      client.value.individual.firstName = editingFirstName.value;
      client.value.individual.lastName = editingLastName.value;
      client.value.individual.middleName = editingMiddleName.value;
      client.value.individual.birthDate = editingBirthDate.value ? editingBirthDate.value : undefined;
      client.value.individual.gender = editingGender.value;
    } else if (client.value.legalEntity) {
      client.value.legalEntity.legalName = editingLegalName.value;
      client.value.legalEntity.brandName = editingBrandName.value;
      client.value.legalEntity.binIin = editingBinIin.value;
      client.value.legalEntity.registrationCountry = editingRegistrationCountry.value;
      client.value.legalEntity.registrationDate = editingRegistrationDate.value ? editingRegistrationDate.value : undefined;
    }

    editMode.value.personalInfo = false;
    toast.add({
      title: t('common.success'),
      description: t('contacts.clientDataUpdated'),
      color: 'green',
    });
    return;
  }

  if (!token.value || !selectedNS.value) return;

  try {
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    if (client.value.individual) {
      await contactsUpdateIndividualClient(contactsToken, selectedNS.value, client.value.client.id, {
        firstName: editingFirstName.value.trim(),
        lastName: editingLastName.value.trim(),
        middleName: editingMiddleName.value.trim() || undefined,
        birthDate: editingBirthDate.value || undefined,
        gender: editingGender.value,
      });
    } else if (client.value.legalEntity) {
      await contactsUpdateLegalEntityClient(contactsToken, selectedNS.value, client.value.client.id, {
        legalName: editingLegalName.value.trim(),
        brandName: editingBrandName.value.trim() || undefined,
        binIin: editingBinIin.value.trim() || undefined,
        registrationCountry: editingRegistrationCountry.value.trim() || undefined,
        registrationDate: editingRegistrationDate.value || undefined,
      });
    }

    const additionalInfo = editingAdditionalInfo.value.trim();
    const primaryPhone = getPrimaryPhoneIdentity();
    if (primaryPhone) {
      const currentComments = primaryPhone.comments?.trim() || '';
      if (currentComments !== additionalInfo) {
        await updateIdentity(
          contactsToken,
          selectedNS.value,
          primaryPhone.id,
          primaryPhone.value,
          additionalInfo || undefined,
        );
      }
    }

    editMode.value.personalInfo = false;
    markLocalMutation();
    await loadClient();
    toast.add({
      title: t('common.success'),
      description: t('contacts.clientDataUpdated'),
      color: 'green',
    });
  } catch (error) {
    logError('Failed to save personal info:', error);
    toast.add({
      title: t('common.error'),
      description: t('contacts.updateError'),
      color: 'red',
    });
  }
}

function startEditIdentities() {
  backupIdentities.value = JSON.parse(JSON.stringify(identities.value));
  
  editingPhones.value = identities.value
    .filter(id => id.type === 'phone')
    .map(id => id.value)
    .slice(0, 5);
  if (editingPhones.value.length === 0) {
    editingPhones.value = [''];
  }
  
  editingEmails.value = identities.value
    .filter(id => id.type === 'email')
    .map(id => id.value)
    .slice(0, 5);
  if (editingEmails.value.length === 0) {
    editingEmails.value = [''];
  }

  editingTelegrams.value = identities.value
    .filter(id => id.type === 'telegram')
    .map(id => id.value)
    .slice(0, 5);
  if (editingTelegrams.value.length === 0) {
    editingTelegrams.value = [''];
  }

  editingWhatsapps.value = identities.value
    .filter(id => id.type === 'whatsapp')
    .map(id => id.value)
    .slice(0, 5);
  if (editingWhatsapps.value.length === 0) {
    editingWhatsapps.value = [''];
  }
  
  editMode.value.identities = true;
}

function cancelEditIdentities() {
  editMode.value.identities = false;
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
  if (!client.value) return;

  if (useMockData.value) {
    identities.value = [
      ...editingPhones.value
        .filter(p => p.trim())
        .map((value, idx) => ({
          id: `phone-${idx}`,
          clientId: client.value!.client.id,
          type: 'phone',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      ...editingEmails.value
        .filter(e => e.trim())
        .map((value, idx) => ({
          id: `email-${idx}`,
          clientId: client.value!.client.id,
          type: 'email',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      ...editingTelegrams.value
        .filter(v => v.trim())
        .map((value, idx) => ({
          id: `telegram-${idx}`,
          clientId: client.value!.client.id,
          type: 'telegram',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      ...editingWhatsapps.value
        .filter(v => v.trim())
        .map((value, idx) => ({
          id: `whatsapp-${idx}`,
          clientId: client.value!.client.id,
          type: 'whatsapp',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
    ];

    editMode.value.identities = false;
    toast.add({
      title: t('common.success'),
      description: t('contacts.contactDataUpdated'),
      color: 'green',
    });
    return;
  }

  if (!token.value || !selectedNS.value) return;

  try {
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const clientIdValue = client.value.client.id;
    await syncIdentityType(
      contactsToken,
      selectedNS.value,
      clientIdValue,
      'phone',
      editingPhones.value,
      identities.value.filter(id => id.type === 'phone'),
    );
    await syncIdentityType(
      contactsToken,
      selectedNS.value,
      clientIdValue,
      'email',
      editingEmails.value,
      identities.value.filter(id => id.type === 'email'),
    );
    await syncIdentityType(
      contactsToken,
      selectedNS.value,
      clientIdValue,
      'telegram',
      editingTelegrams.value,
      identities.value.filter(id => id.type === 'telegram'),
    );
    await syncIdentityType(
      contactsToken,
      selectedNS.value,
      clientIdValue,
      'whatsapp',
      editingWhatsapps.value,
      identities.value.filter(id => id.type === 'whatsapp'),
    );

    editMode.value.identities = false;
    markLocalMutation();
    await loadClient();
    toast.add({
      title: t('common.success'),
      description: t('contacts.contactDataUpdated'),
      color: 'green',
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Page Header -->
    <ContactHeader 
      :client="client" 
      :namespace="nsSlug"
      @back="handleBack"
    />

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="client" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div
        v-if="isClientDataStale"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-amber-900 dark:text-amber-200">
            {{ t('contacts.staleClientBanner') || 'Данные клиента изменились в другом окне.' }}
          </div>
          <UButton size="xs" color="amber" variant="soft" icon="lucide:refresh-cw" @click="refreshStaleClientData">
            {{ t('contacts.refreshUpdates') || 'Обновить' }}
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Personal Info Section -->
          <ContactPersonalInfo
            :client="client"
            :edit-mode="editMode.personalInfo"
            :editing-first-name="editingFirstName"
            :editing-last-name="editingLastName"
            :editing-middle-name="editingMiddleName"
            :editing-birth-date="editingBirthDate"
            :editing-gender="editingGender"
            :editing-legal-name="editingLegalName"
            :editing-brand-name="editingBrandName"
            :editing-bin-iin="editingBinIin"
            :editing-registration-country="editingRegistrationCountry"
            :editing-registration-date="editingRegistrationDate"
            :additional-info="getAdditionalInfoValue()"
            :editing-additional-info="editingAdditionalInfo"
            @start-edit="startEditPersonalInfo"
            @save-edit="savePersonalInfo"
            @cancel-edit="cancelEditPersonalInfo"
            @update-field="(field, value) => {
              if (field === 'firstName') editingFirstName = value as string;
              if (field === 'lastName') editingLastName = value as string;
              if (field === 'middleName') editingMiddleName = value as string;
              if (field === 'birthDate') editingBirthDate = value as string;
              if (field === 'gender') editingGender = value as (boolean | null);
              if (field === 'legalName') editingLegalName = value as string;
              if (field === 'brandName') editingBrandName = value as string;
              if (field === 'binIin') editingBinIin = value as string;
              if (field === 'registrationCountry') editingRegistrationCountry = value as string;
              if (field === 'registrationDate') editingRegistrationDate = value as string;
              if (field === 'additionalInfo') editingAdditionalInfo = value as string;
            }"
          />

          <!-- Identities Section -->
          <ContactIdentities
            :identities="identities"
            :identity-display-values="identityDisplayValues"
            :edit-mode="editMode.identities"
            :editing-phones="editingPhones"
            :editing-emails="editingEmails"
            :editing-telegrams="editingTelegrams"
            :editing-whatsapps="editingWhatsapps"
            @start-edit="startEditIdentities"
            @save-edit="saveIdentities"
            @cancel-edit="cancelEditIdentities"
            @add-phone="addPhoneField"
            @remove-phone="removePhoneField"
            @add-email="addEmailField"
            @remove-email="removeEmailField"
            @add-telegram="addTelegramField"
            @remove-telegram="removeTelegramField"
            @add-whatsapp="addWhatsappField"
            @remove-whatsapp="removeWhatsappField"
            @update-phone="(idx, val) => editingPhones[idx] = val"
            @update-email="(idx, val) => editingEmails[idx] = val"
            @update-telegram="(idx, val) => editingTelegrams[idx] = val"
            @update-whatsapp="(idx, val) => editingWhatsapps[idx] = val"
            @phone-action="handlePhoneAction"
            @email-action="handleEmailAction"
            @telegram-action="handleTelegramAction"
            @whatsapp-action="handleWhatsappAction"
            @copy-to-clipboard="copyToClipboard"
          />

          <!-- Loyalty Section -->
          <ContactLoyalty
            :bonus-balance="bonusBalance"
            :stamp-cards="stampCards"
            :stamp-progress="stampProgress"
            :contacts-token="contactsAppToken"
            :client-id="client?.client.id"
            :namespace="selectedNS || nsSlug"
            :created-by="createdByUserId"
            @bonus-earned="loadClient"
          />

          <!-- Tags Section -->
          <ContactTags 
            :tags="tags" 
            :client-id="client?.client.id"
            @open-tags-modal="isTagsModalOpen = true"
            @tag-added="loadClient"
            @tag-removed="loadClient"
          />
        </div>

        <!-- Right Column - Timeline -->
        <div class="lg:col-span-1">
          <ContactTimeline :events="events" />
        </div>
      </div>
    </div>

    <!-- Tags Modal -->
    <TagsModal
      :is-open="isTagsModalOpen"
      mode="select"
      :client-id="client?.client.id"
      @close="isTagsModalOpen = false"
      @tag-added="loadClient"
    />
  </div>
</template>
