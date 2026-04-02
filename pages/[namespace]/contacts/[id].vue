<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { contactsUpdateClientStatus, contactsUpdateIndividualClient, contactsUpdateLegalEntityClient } from '@/api/contacts/mutations';
import { type ClientRow } from '@/api/contacts/listClients';
import { createIdentity, deleteIdentity, setPrimaryIdentity, updateIdentity, type ClientIdentity } from '@/api/contacts/identities';
import { type ClientEvent } from '@/api/contacts/events';
import { getClientStampProgressBatch, type BonusBalance, type StampCard, type ClientStampProgress } from '@/api/contacts/loyalty';
import { getClientPageData } from '@/api/contacts/clientPage';
import {
  listDynamicFieldsWithValues,
  setDynamicFieldValue,
  deleteDynamicFieldValue,
  type DynamicField,
  type DynamicFieldValue,
} from '@/api/contacts/dynamicFields';
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
import DynamicFieldInput from '@/components/contacts/DynamicFieldInput.vue';

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
const dynamicFields = ref<DynamicField[]>([]);
const dynamicFieldValues = ref<Record<string, DynamicFieldValue>>({});
const dynamicFieldDrafts = ref<Record<string, string | number | boolean | string[]>>({});
const dynamicFieldsLoading = ref(false);
const dynamicFieldsError = ref<string | null>(null);
const dynamicFieldsSaving = ref(false);
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
const relatedClientTargets = ref<Record<string, string>>({});

const contactPersonIdentities = computed(() =>
  identities.value.filter((i) => i.type === 'contact_person'),
);

function getPreferredIdentityForAdditionalInfo(): ClientIdentity | undefined {
  return identities.value.find((item) => item.type === 'phone' && item.isPrimary)
    || identities.value.find((item) => item.type === 'phone')
    || identities.value.find((item) => item.isPrimary)
    || identities.value[0];
}

function getAdditionalInfoValue(): string {
  return getPreferredIdentityForAdditionalInfo()?.comments?.trim() || client.value?.additionalInfo?.trim() || '';
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

function applyDynamicFieldValueToDraft(field: DynamicField, value?: DynamicFieldValue) {
  if (!value) {
    if (field.dataType === 'BOOLEAN') {
      dynamicFieldDrafts.value[field.id] = false;
      return;
    }
    if (field.dataType === 'MULTI_SELECT') {
      dynamicFieldDrafts.value[field.id] = [];
      return;
    }
    dynamicFieldDrafts.value[field.id] = '';
    return;
  }

  if (field.dataType === 'NUMBER') {
    dynamicFieldDrafts.value[field.id] = value.valueNumber ?? '';
    return;
  }
  if (field.dataType === 'BOOLEAN') {
    dynamicFieldDrafts.value[field.id] = !!value.valueBool;
    return;
  }
  if (field.dataType === 'DATE') {
    dynamicFieldDrafts.value[field.id] = value.valueDate || '';
    return;
  }

  if (field.dataType === 'MULTI_SELECT') {
    if (value.valueJson) {
      try {
        const parsed = JSON.parse(value.valueJson);
        dynamicFieldDrafts.value[field.id] = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
      } catch {
        dynamicFieldDrafts.value[field.id] = [];
      }
      return;
    }
    dynamicFieldDrafts.value[field.id] = [];
    return;
  }

  dynamicFieldDrafts.value[field.id] = value.valueString || '';
}

function isDynamicFieldsEmptyStateError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const mentionsDynamicField = message.includes('dynamic field') || message.includes('dynamicfield');
  return (message.includes('not found') && mentionsDynamicField)
    || (message.includes('no rows') && mentionsDynamicField)
    || (message.includes('no data') && mentionsDynamicField)
    || message.includes('no dynamic fields')
    || message.includes('no dynamic field values');
}

async function loadDynamicFieldsForClient(contactsToken: string, namespace: string, entityId: string) {
  dynamicFieldsLoading.value = true;
  dynamicFieldsError.value = null;

  try {
    const { dynamicFields: fieldsResp, dynamicFieldValues: valuesResp } =
      await listDynamicFieldsWithValues(contactsToken, namespace, entityId, { includeDeleted: false });

    const rawFields = fieldsResp?.rows || [];
    const isIndividual = client.value?.client.clientType === 'INDIVIDUAL';

    const filteredFields = rawFields
      .filter((field) => {
        if (field.clientTypeScope === 'ALL') return true;
        if (field.clientTypeScope === 'INDIVIDUAL') return isIndividual;
        if (field.clientTypeScope === 'LEGAL') return !isIndividual;
        return true;
      })
      .slice()
      .sort((a, b) => a.viewOrder - b.viewOrder);

    dynamicFields.value = filteredFields;

    if (filteredFields.length === 0) {
      dynamicFieldValues.value = {};
      dynamicFieldDrafts.value = {};
      return;
    }

    const valueRows = valuesResp?.rows || [];
    const nextValues: Record<string, DynamicFieldValue> = {};
    for (const value of valueRows) {
      nextValues[value.fieldId] = value;
    }
    dynamicFieldValues.value = nextValues;

    const nextDrafts: Record<string, string | number | boolean | string[]> = {};
    for (const field of filteredFields) {
      const existingValue = nextValues[field.id];
      if (!existingValue) {
        if (field.dataType === 'BOOLEAN') {
          nextDrafts[field.id] = false;
        } else if (field.dataType === 'MULTI_SELECT') {
          nextDrafts[field.id] = [];
        } else {
          nextDrafts[field.id] = '';
        }
        continue;
      }

      if (field.dataType === 'NUMBER') {
        nextDrafts[field.id] = existingValue.valueNumber ?? '';
      } else if (field.dataType === 'BOOLEAN') {
        nextDrafts[field.id] = !!existingValue.valueBool;
      } else if (field.dataType === 'DATE') {
        nextDrafts[field.id] = existingValue.valueDate || '';
      } else if (field.dataType === 'MULTI_SELECT') {
        if (existingValue.valueJson) {
          try {
            const parsed = JSON.parse(existingValue.valueJson);
            nextDrafts[field.id] = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
          } catch {
            nextDrafts[field.id] = [];
          }
        } else {
          nextDrafts[field.id] = [];
        }
      } else {
        nextDrafts[field.id] = existingValue.valueString || '';
      }
    }
    dynamicFieldDrafts.value = nextDrafts;
  } catch (error) {
    if (isDynamicFieldsEmptyStateError(error)) {
      dynamicFields.value = [];
      dynamicFieldValues.value = {};
      dynamicFieldDrafts.value = {};
      dynamicFieldsError.value = null;
      return;
    }

    logError('Failed to load dynamic fields for client:', error);
    dynamicFieldsError.value = t('common.errorDetails.loadFailed') || 'Failed to load data';
  } finally {
    dynamicFieldsLoading.value = false;
  }
}

function hasDynamicFieldInputValue(field: DynamicField): boolean {
  const rawValue = dynamicFieldDrafts.value[field.id];

  if (field.dataType === 'MULTI_SELECT') {
    return Array.isArray(rawValue) && rawValue.length > 0;
  }

  if (field.dataType === 'BOOLEAN') {
    return typeof rawValue === 'boolean';
  }

  if (field.dataType === 'NUMBER') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return false;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed);
  }

  const text = String(rawValue ?? '').trim();
  return text.length > 0;
}

async function saveDynamicFields() {
  if (!contactsAppToken.value || !selectedNS.value || !client.value?.client.id) return;

  try {
    dynamicFieldsSaving.value = true;

    for (const field of dynamicFields.value) {
      const rawValue = dynamicFieldDrafts.value[field.id];
      const existing = dynamicFieldValues.value[field.id];
      const hasValue = hasDynamicFieldInputValue(field);

      if (!hasValue) {
        if (existing) {
          await deleteDynamicFieldValue(contactsAppToken.value, selectedNS.value, existing.id);
          delete dynamicFieldValues.value[field.id];
        }
        applyDynamicFieldValueToDraft(field, undefined);
        continue;
      }

      const input: {
        fieldId: string;
        entityId: string;
        valueString?: string;
        valueNumber?: number;
        valueBool?: boolean;
        valueDate?: string;
        valueJson?: string;
      } = {
        fieldId: field.id,
        entityId: client.value.client.id,
      };

      if (field.dataType === 'NUMBER') {
        input.valueNumber = Number(rawValue);
      } else if (field.dataType === 'BOOLEAN') {
        input.valueBool = !!rawValue;
      } else if (field.dataType === 'DATE') {
        input.valueDate = String(rawValue || '');
      } else if (field.dataType === 'MULTI_SELECT') {
        input.valueJson = JSON.stringify(Array.isArray(rawValue) ? rawValue : []);
      } else {
        input.valueString = String(rawValue || '');
      }

      const result = await setDynamicFieldValue(contactsAppToken.value, selectedNS.value, input);
      dynamicFieldValues.value[field.id] = result.setDynamicFieldValue;
      applyDynamicFieldValueToDraft(field, result.setDynamicFieldValue);
    }

    toast.add({ title: t('common.success') || 'Success', description: t('common.save') || 'Saved', color: 'green' });
  } catch (error) {
    logError('Failed to save dynamic field value:', error);
    toast.add({ title: t('common.error') || 'Error', description: t('contacts.updateError') || 'Update failed', color: 'red' });
  } finally {
    dynamicFieldsSaving.value = false;
  }
}

async function resolveIdentityDisplayValues() {
  const displayMap: Record<string, string> = {};
  const targetMap: Record<string, string> = {};
  const identityRows = identities.value || [];

  for (const item of identityRows) {
    const identityRef = item.value?.trim() || '';

    if (item.type === 'company' || item.type === 'contact_person') {
      const comments = item.comments?.trim() || '';
      const name = (comments && !comments.match(/^[a-z0-9]{8}$/i) ? comments : '')
        || t('contacts.relatedClient');
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
  router.push(`/${nsSlug.value}/contacts/${target}`);
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

    dynamicFields.value = [];
    dynamicFieldValues.value = {};
    dynamicFieldDrafts.value = {};
    
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

      await resolveIdentityDisplayValues();
    } catch (aggregatedError) {
      logError('Failed to load client page data:', aggregatedError);
      toast.add({
        title: t('common.error'),
        description: t('contacts.loadError'),
        color: 'red',
      });
      router.push(`/${selectedNS.value}/contacts`);
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
      await loadDynamicFieldsForClient(contactsToken, selectedNS.value, fullClientId);
    } else {
      dynamicFields.value = [];
      dynamicFieldValues.value = {};
      dynamicFieldDrafts.value = {};
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
    const identityForInfo = getPreferredIdentityForAdditionalInfo();
    if (identityForInfo) {
      const currentComments = identityForInfo.comments?.trim() || '';
      if (currentComments !== additionalInfo) {
        await updateIdentity(
          contactsToken,
          selectedNS.value,
          identityForInfo.id,
          identityForInfo.value,
          additionalInfo,
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
    <div
      v-if="loading"
      class="flex items-center justify-center py-20"
    >
      <div class="text-center">
        <UIcon
          name="lucide:loader"
          class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4"
        />
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('common.loading') }}
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div
      v-else-if="client"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <div
        v-if="isClientDataStale"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-amber-900 dark:text-amber-200">
            {{ t('contacts.staleClientBanner') || 'Данные клиента изменились в другом окне.' }}
          </div>
          <UButton
            size="xs"
            color="amber"
            variant="soft"
            icon="lucide:refresh-cw"
            @click="refreshStaleClientData"
          >
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
            :related-client-targets="relatedClientTargets"
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
            @navigate-related-client="openRelatedClient"
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

          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Дополнительные поля
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Значения динамических полей клиента
                  </p>
                </div>
                <UButton
                  color="primary"
                  size="xs"
                  :loading="dynamicFieldsSaving"
                  :disabled="dynamicFieldsLoading"
                  @click="saveDynamicFields"
                >
                  Сохранить все
                </UButton>
              </div>
            </template>

            <div
              v-if="dynamicFieldsLoading"
              class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('common.loading') }}
            </div>

            <div
              v-else-if="dynamicFieldsError"
              class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            >
              {{ dynamicFieldsError }}
            </div>

            <div
              v-else-if="dynamicFields.length === 0"
              class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              Поля не настроены
            </div>

            <div
              v-else
              class="space-y-3"
            >
              <div
                v-for="field in dynamicFields"
                :key="field.id"
                class="py-2"
              >
                <div class="mb-2 flex items-center justify-between gap-3">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ field.label }}
                    <span
                      v-if="field.isRequired"
                      class="text-red-500"
                    >*</span>
                  </div>
                </div>

                <DynamicFieldInput
                  v-model="dynamicFieldDrafts[field.id]"
                  :field="field"
                  :disabled="dynamicFieldsSaving"
                  :yes-label="t('contacts.yes') || 'Да'"
                  :no-label="t('contacts.no') || 'Нет'"
                  :none-selected-label="t('contacts.noneSelected') || 'Ничего не выбрано'"
                  :select-options-label="t('contacts.selectOptions') || 'Выберите варианты'"
                  :selected-count-suffix="t('contacts.selectedCountSuffix') || 'выбрано'"
                />
              </div>
            </div>
          </UCard>
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
