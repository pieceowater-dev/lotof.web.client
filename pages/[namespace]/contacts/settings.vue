<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getContactsPlanLimits } from '@/api/contacts/plans/getLimits';
import { hubNamespaceBySlug } from '@/api/hub/namespaces/get';
import { hubMembersList } from '@/api/hub/members/list';
import BonusPinManager from '@/components/contacts/BonusPinManager.vue';
import ImportModal from '@/components/contacts/ImportModal.vue';
import DynamicFieldPreviewControl from '@/components/contacts/DynamicFieldPreviewControl.vue';
import DynamicFieldOptionsEditor from '@/components/contacts/DynamicFieldOptionsEditor.vue';
import {
  createStampCard,
  deleteStampCard,
  getStampCards,
  updateStampCard,
  type StampCard,
  type UpdateStampCardInput,
} from '@/api/contacts/loyalty';
import {
  listDynamicFields,
  createDynamicField,
  updateDynamicField,
  deleteDynamicField,
  restoreDynamicField,
  type DynamicField,
  type DynamicFieldDataType,
  type DynamicFieldClientScope,
} from '@/api/contacts/dynamicFields';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { selected: selectedNS, titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');

type StaticAccessRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

type NamespaceMember = {
  id: string;
  userId: string;
  username: string;
  email: string;
};

type DynamicFieldPreviewValue = string | number | boolean | string[];

// State
const loading = ref(true);
const error = ref<string | null>(null);
const contactsToken = ref<string | null>(null);
const planLimits = ref<{ max_clients?: number; max_custom_fields?: number; max_loyalty_programs?: number } | null>(null);
const planName = ref<string>('');
const planLimitsLoading = ref(false);
const namespaceMembers = ref<NamespaceMember[]>([]);
const memberRoles = ref<Record<string, StaticAccessRole>>({});
const rolesLoading = ref(false);
const roleSavingMemberId = ref<string | null>(null);
const rolesPage = ref(1);
const rolesPageSize = ref(10);
const showRolesLegend = ref(false);
const showRoleModal = ref(false);
const roleModalMemberId = ref<string | null>(null);
const roleModalValue = ref<StaticAccessRole>('VIEWER');
const stampCards = ref<StampCard[]>([]);
const stampCardsLoading = ref(false);
const stampCardsError = ref<string | null>(null);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteConfirmModal = ref(false);
const showDeleteDynamicFieldConfirmModal = ref(false);
const showImportModal = ref(false);
const createFormLoading = ref(false);
const editFormLoading = ref(false);
const createFormError = ref<string | null>(null);
const editFormError = ref<string | null>(null);
const dynamicFields = ref<DynamicField[]>([]);
const dynamicFieldsLoading = ref(false);
const dynamicFieldsError = ref<string | null>(null);
const showCreateDynamicFieldModal = ref(false);
const showEditDynamicFieldModal = ref(false);
const createDynamicFieldLoading = ref(false);
const editDynamicFieldLoading = ref(false);
const deleteDynamicFieldLoading = ref(false);
const createDynamicFieldError = ref<string | null>(null);
const editDynamicFieldError = ref<string | null>(null);
const pendingDeleteDynamicFieldId = ref<string | null>(null);
const includeDeletedDynamicFields = ref(false);
const createDynamicFieldForm = ref({
  key: '',
  label: '',
  dataType: 'STRING' as DynamicFieldDataType,
  clientTypeScope: 'ALL' as DynamicFieldClientScope,
  isRequired: false,
  searchable: false,
});
const createDynamicFieldOptions = ref<string[]>(['']);
const createPreviewValue = ref<DynamicFieldPreviewValue>('');
const editDynamicFieldForm = ref({
  id: '',
  key: '',
  label: '',
  viewOrder: 0,
  dataType: 'STRING' as DynamicFieldDataType,
  clientTypeScope: 'ALL' as DynamicFieldClientScope,
  isRequired: false,
  searchable: false,
  deletedAt: '' as string | null,
});
const editDynamicFieldOptions = ref<string[]>(['']);
const editPreviewValue = ref<DynamicFieldPreviewValue>('');
const showStampPin = ref(false);
const showConfirmStampPin = ref(false);
const showEditStampPin = ref(false);
const showEditConfirmStampPin = ref(false);
const selectedStampCardId = ref<string | null>(null);
const pendingDeleteStampCardId = ref<string | null>(null);
const staticRoleOptions: Array<{ label: string; value: StaticAccessRole }> = [
  { label: 'Админ', value: 'ADMIN' },
  { label: 'Оператор', value: 'OPERATOR' },
  { label: 'Наблюдатель', value: 'VIEWER' },
];
const rolesPageSizeOptions = [10, 20, 50];
const dynamicFieldDataTypeOptions: Array<{ label: string; value: DynamicFieldDataType }> = [
  { label: 'Строка', value: 'STRING' },
  { label: 'Число', value: 'NUMBER' },
  { label: 'Да/Нет', value: 'BOOLEAN' },
  { label: 'Дата', value: 'DATE' },
  { label: 'Список', value: 'SELECT' },
  { label: 'Множественный список', value: 'MULTI_SELECT' },
];
const dynamicFieldScopeOptions: Array<{ label: string; value: DynamicFieldClientScope }> = [
  { label: 'Все клиенты', value: 'ALL' },
  { label: 'Только физлица', value: 'INDIVIDUAL' },
  { label: 'Только юрлица', value: 'LEGAL' },
];
const staticRolesStorageKey = computed(() => `contacts:roles:${nsSlug.value}`);
const createFormData = ref({
  name: '',
  description: '',
  totalStamps: 10,
  rewardDescription: '',
  stampPin: '',
  confirmStampPin: '',
  validFrom: '',
  validUntil: '',
});

const editFormData = ref({
  id: '',
  name: '',
  description: '',
  rewardDescription: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  validUntil: '',
  stampPin: '',
  confirmStampPin: '',
});

const rewardPlaceholder = computed(() => t('app.reward') || 'Reward');
const paginatedMembers = computed(() => {
  const start = (rolesPage.value - 1) * rolesPageSize.value;
  return namespaceMembers.value.slice(start, start + rolesPageSize.value);
});
const rolesFrom = computed(() => {
  if (namespaceMembers.value.length === 0) return 0;
  return (rolesPage.value - 1) * rolesPageSize.value + 1;
});
const rolesTo = computed(() => {
  return Math.min(rolesPage.value * rolesPageSize.value, namespaceMembers.value.length);
});

function normalizeRole(raw?: string | null): StaticAccessRole {
  if (raw === 'OWNER' || raw === 'ADMIN' || raw === 'OPERATOR' || raw === 'VIEWER') return raw;
  // Backward compatibility for old saved role.
  if (raw === 'EDITOR') return 'OPERATOR';
  return 'VIEWER';
}

function roleTone(role: StaticAccessRole): string {
  if (role === 'OWNER') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (role === 'ADMIN') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (role === 'OPERATOR') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function roleLabel(role: StaticAccessRole): string {
  if (role === 'OWNER') return 'Владелец';
  if (role === 'ADMIN') return 'Админ';
  if (role === 'OPERATOR') return 'Оператор';
  return 'Наблюдатель';
}

function planLimitLabel(key: 'max_clients' | 'max_custom_fields' | 'max_loyalty_programs'): string {
  if (key === 'max_clients') {
    return t('app.limitActiveUsers') || 'Активные клиенты';
  }
  if (key === 'max_custom_fields') {
    return t('app.limitCustomFields') || 'Пользовательские поля';
  }
  return t('app.limitLoyaltyPrograms') || 'Программы лояльности';
}

const roleModalMember = computed(() => {
  if (!roleModalMemberId.value) return null;
  return namespaceMembers.value.find((member) => member.id === roleModalMemberId.value) || null;
});
const isCreateFormValid = computed(() => {
  const data = createFormData.value;
  const hasRequired =
    !!data.name.trim() &&
    !!data.rewardDescription.trim() &&
    Number.isFinite(data.totalStamps) &&
    data.totalStamps > 0;

  const pinValid = /^\d{4}$/.test(data.stampPin);
  const pinMatches = data.stampPin === data.confirmStampPin;

  const dateRangeValid =
    !data.validFrom ||
    !data.validUntil ||
    new Date(data.validFrom).getTime() <= new Date(data.validUntil).getTime();

  return hasRequired && pinValid && pinMatches && dateRangeValid;
});

const isEditFormValid = computed(() => {
  const data = editFormData.value;
  const hasRequired = !!data.id && !!data.name.trim() && !!data.rewardDescription.trim();
  const pinEmpty = !data.stampPin && !data.confirmStampPin;
  const pinValid = /^\d{4}$/.test(data.stampPin) && data.stampPin === data.confirmStampPin;
  return hasRequired && (pinEmpty || pinValid);
});

const isCreateDynamicFieldValid = computed(() => {
  const data = createDynamicFieldForm.value;
  if (!data.label.trim()) return false;

  if (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT') {
    return createDynamicFieldOptions.value.some((option) => !!option.trim());
  }

  return true;
});

const createDynamicFieldOptionChoices = computed(() => {
  return createDynamicFieldOptions.value
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({ label: option, value: option }));
});

const editDynamicFieldOptionChoices = computed(() => {
  return editDynamicFieldOptions.value
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({ label: option, value: option }));
});

const filteredDynamicFields = computed(() => {
  return dynamicFields.value
    .slice()
    .sort((a, b) => a.viewOrder - b.viewOrder);
});

const isEditDynamicFieldValid = computed(() => {
  return !!editDynamicFieldForm.value.id && !!editDynamicFieldForm.value.label.trim();
});

function dynamicFieldTypeLabel(type: DynamicFieldDataType): string {
  return dynamicFieldDataTypeOptions.find((option) => option.value === type)?.label || type;
}

function dynamicFieldScopeLabel(scope: DynamicFieldClientScope): string {
  return dynamicFieldScopeOptions.find((option) => option.value === scope)?.label || scope;
}

function defaultPreviewValue(dataType: DynamicFieldDataType): DynamicFieldPreviewValue {
  if (dataType === 'BOOLEAN') return false;
  if (dataType === 'MULTI_SELECT') return [];
  return '';
}

const resetCreateDynamicFieldForm = () => {
  createDynamicFieldForm.value = {
    key: '',
    label: '',
    dataType: 'STRING',
    clientTypeScope: 'ALL',
    isRequired: false,
    searchable: false,
  };
  createDynamicFieldOptions.value = [''];
  createPreviewValue.value = defaultPreviewValue(createDynamicFieldForm.value.dataType);
  createDynamicFieldError.value = null;
};

function onCreateDynamicFieldDataTypeChange(value: DynamicFieldDataType) {
  createDynamicFieldForm.value.dataType = value;
  createPreviewValue.value = defaultPreviewValue(value);
  if (value === 'BOOLEAN') {
    createDynamicFieldForm.value.isRequired = false;
  }
  if (value !== 'SELECT' && value !== 'MULTI_SELECT') {
    createDynamicFieldOptions.value = [''];
  }
}

const openCreateDynamicFieldModal = () => {
  resetCreateDynamicFieldForm();
  showCreateDynamicFieldModal.value = true;
};

const closeCreateDynamicFieldModal = () => {
  showCreateDynamicFieldModal.value = false;
  createDynamicFieldError.value = null;
};

const openEditDynamicFieldModal = (field: DynamicField) => {
  editDynamicFieldForm.value = {
    id: field.id,
    key: field.key,
    label: field.label,
    viewOrder: field.viewOrder,
    dataType: field.dataType,
    clientTypeScope: field.clientTypeScope,
    isRequired: field.dataType === 'BOOLEAN' ? false : field.isRequired,
    searchable: field.searchable,
    deletedAt: field.deletedAt || null,
  };
  editDynamicFieldOptions.value =
    field.dataType === 'SELECT' || field.dataType === 'MULTI_SELECT'
      ? ((field.options && field.options.length > 0 ? field.options : ['']).map((option) => String(option)))
      : [''];
  editPreviewValue.value = defaultPreviewValue(field.dataType);
  editDynamicFieldError.value = null;
  showEditDynamicFieldModal.value = true;
};

const closeEditDynamicFieldModal = () => {
  showEditDynamicFieldModal.value = false;
  editDynamicFieldError.value = null;
  editDynamicFieldOptions.value = [''];
  editPreviewValue.value = defaultPreviewValue(editDynamicFieldForm.value.dataType);
};

const openDeleteDynamicFieldModal = (id: string) => {
  pendingDeleteDynamicFieldId.value = id;
  showDeleteDynamicFieldConfirmModal.value = true;
};

const closeDeleteDynamicFieldModal = () => {
  showDeleteDynamicFieldConfirmModal.value = false;
  pendingDeleteDynamicFieldId.value = null;
};

async function loadDynamicFieldsData(token: string) {
  dynamicFieldsLoading.value = true;
  dynamicFieldsError.value = null;
  try {
    const response = await listDynamicFields(token, nsSlug.value, {
      includeDeleted: includeDeletedDynamicFields.value,
    });
    dynamicFields.value = response.dynamicFields?.rows || [];
  } catch (e) {
    if (isDynamicFieldsEmptyStateError(e)) {
      dynamicFields.value = [];
      dynamicFieldsError.value = null;
      return;
    }

    logError('Failed to load dynamic fields:', e);
    dynamicFieldsError.value = t('common.errorDetails.loadFailed') || 'Failed to load dynamic fields';
  } finally {
    dynamicFieldsLoading.value = false;
  }
}

function isDynamicFieldsEmptyStateError(error: unknown): boolean {
  const graphQLErrorMessages = Array.isArray((error as any)?.response?.errors)
    ? (error as any).response.errors.map((item: any) => String(item?.message || '')).join(' | ')
    : '';

  const message = String(
    graphQLErrorMessages
    || (error as any)?.response?.errors?.[0]?.message
    || (error as any)?.message
    || error
    || '',
  ).toLowerCase();

  const mentionsDynamicFields =
    message.includes('dynamic field')
    || message.includes('dynamicfield')
    || message.includes('listdynamicfields')
    || message.includes('contactsdynamicfieldservice');

  const isGenericEmptyState =
    message.includes('record not found')
    || message.includes('not found')
    || message.includes('no rows')
    || message.includes('no data');

  return message.includes('no dynamic fields')
    || message.includes('no dynamic field values')
    || (mentionsDynamicFields && isGenericEmptyState)
    || isGenericEmptyState;
}

async function handleCreateDynamicField() {
  if (!contactsToken.value) {
    createDynamicFieldError.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  const data = createDynamicFieldForm.value;
  if (!data.label.trim()) {
    createDynamicFieldError.value = t('common.error') || 'Required fields are missing';
    return;
  }

  try {
    createDynamicFieldLoading.value = true;
    createDynamicFieldError.value = null;
    await createDynamicField(contactsToken.value, nsSlug.value, {
      key: '',
      label: data.label.trim(),
      options: (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT')
        ? createDynamicFieldOptions.value.map((option) => option.trim()).filter(Boolean)
        : undefined,
      dataType: data.dataType,
      clientTypeScope: data.clientTypeScope,
      isRequired: data.dataType === 'BOOLEAN' ? false : data.isRequired,
      searchable: data.searchable,
    });
    closeCreateDynamicFieldModal();
    await loadDynamicFieldsData(contactsToken.value);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.create') || 'Created',
      color: 'green',
    });
  } catch (e) {
    logError('Failed to create dynamic field:', e);
    createDynamicFieldError.value = t('common.error') || 'Failed to create dynamic field';
  } finally {
    createDynamicFieldLoading.value = false;
  }
}

async function handleEditDynamicField() {
  if (!contactsToken.value) {
    editDynamicFieldError.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  const data = editDynamicFieldForm.value;
  if (!data.id || !data.label.trim()) {
    editDynamicFieldError.value = t('common.error') || 'Required fields are missing';
    return;
  }

  try {
    editDynamicFieldLoading.value = true;
    editDynamicFieldError.value = null;
    await updateDynamicField(contactsToken.value, nsSlug.value, {
      id: data.id,
      label: data.label.trim(),
      viewOrder: data.viewOrder,
      options: (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT')
        ? editDynamicFieldOptions.value.map((option) => option.trim()).filter(Boolean)
        : undefined,
      isRequired: data.dataType === 'BOOLEAN' ? false : data.isRequired,
      searchable: data.searchable,
    });
    closeEditDynamicFieldModal();
    await loadDynamicFieldsData(contactsToken.value);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.save') || 'Saved',
      color: 'green',
    });
  } catch (e) {
    logError('Failed to update dynamic field:', e);
    editDynamicFieldError.value = t('common.error') || 'Failed to update dynamic field';
  } finally {
    editDynamicFieldLoading.value = false;
  }
}

async function moveDynamicField(field: DynamicField, direction: 'up' | 'down') {
  if (!contactsToken.value) return;

  const movable = filteredDynamicFields.value
    .filter((item) => !item.deletedAt)
    .slice()
    .sort((a, b) => a.viewOrder - b.viewOrder);

  const index = movable.findIndex((item) => item.id === field.id);
  if (index < 0) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= movable.length) return;

  const current = movable[index];
  const target = movable[targetIndex];

  try {
    editDynamicFieldLoading.value = true;

    await Promise.all([
      updateDynamicField(contactsToken.value, nsSlug.value, {
        id: current.id,
        label: current.label,
        viewOrder: target.viewOrder,
        isRequired: current.isRequired,
        searchable: current.searchable,
      }),
      updateDynamicField(contactsToken.value, nsSlug.value, {
        id: target.id,
        label: target.label,
        viewOrder: current.viewOrder,
        isRequired: target.isRequired,
        searchable: target.searchable,
      }),
    ]);

    await loadDynamicFieldsData(contactsToken.value);
  } catch (e) {
    logError('Failed to reorder dynamic fields:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Reorder failed',
      color: 'red',
    });
  } finally {
    editDynamicFieldLoading.value = false;
  }
}

async function confirmDeleteDynamicField() {
  if (!contactsToken.value || !pendingDeleteDynamicFieldId.value) return;
  const id = pendingDeleteDynamicFieldId.value;
  closeDeleteDynamicFieldModal();

  try {
    deleteDynamicFieldLoading.value = true;
    await deleteDynamicField(contactsToken.value, nsSlug.value, id);
    await loadDynamicFieldsData(contactsToken.value);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.delete') || 'Deleted',
      color: 'green',
    });
  } catch (e) {
    logError('Failed to delete dynamic field:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Delete failed',
      color: 'red',
    });
  } finally {
    deleteDynamicFieldLoading.value = false;
  }
}

async function handleRestoreDynamicField(id: string) {
  if (!contactsToken.value) return;
  try {
    deleteDynamicFieldLoading.value = true;
    await restoreDynamicField(contactsToken.value, nsSlug.value, id);
    await loadDynamicFieldsData(contactsToken.value);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.restore') || 'Restored',
      color: 'green',
    });
  } catch (e) {
    logError('Failed to restore dynamic field:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Restore failed',
      color: 'red',
    });
  } finally {
    deleteDynamicFieldLoading.value = false;
  }
}

const allowedPinControlKeys = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
]);

function sanitizePinValue(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function onPinKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (allowedPinControlKeys.has(event.key)) return;
  if (!/^\d$/.test(event.key)) {
    event.preventDefault();
  }
}

function onStampPinInput(event: Event) {
  const target = event.target as HTMLInputElement;
  createFormData.value.stampPin = sanitizePinValue(target.value);
}

function onConfirmStampPinInput(event: Event) {
  const target = event.target as HTMLInputElement;
  createFormData.value.confirmStampPin = sanitizePinValue(target.value);
}

function onEditStampPinInput(event: Event) {
  const target = event.target as HTMLInputElement;
  editFormData.value.stampPin = sanitizePinValue(target.value);
}

function onEditConfirmStampPinInput(event: Event) {
  const target = event.target as HTMLInputElement;
  editFormData.value.confirmStampPin = sanitizePinValue(target.value);
}

function onStampPinPaste(event: ClipboardEvent, field: 'stampPin' | 'confirmStampPin') {
  event.preventDefault();
  const pasted = event.clipboardData?.getData('text') || '';
  const nextValue = sanitizePinValue(pasted);
  if (field === 'stampPin') {
    createFormData.value.stampPin = nextValue;
    return;
  }
  createFormData.value.confirmStampPin = nextValue;
}

function onEditStampPinPaste(event: ClipboardEvent, field: 'stampPin' | 'confirmStampPin') {
  event.preventDefault();
  const pasted = event.clipboardData?.getData('text') || '';
  const nextValue = sanitizePinValue(pasted);
  if (field === 'stampPin') {
    editFormData.value.stampPin = nextValue;
    return;
  }
  editFormData.value.confirmStampPin = nextValue;
}

const resetCreateForm = () => {
  createFormData.value = {
    name: '',
    description: '',
    totalStamps: 10,
    rewardDescription: '',
    stampPin: '',
    confirmStampPin: '',
    validFrom: '',
    validUntil: '',
  };
  createFormError.value = null;
  showStampPin.value = false;
  showConfirmStampPin.value = false;
};

const openCreateModal = () => {
  resetCreateForm();
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  createFormError.value = null;
};

const openEditModal = (card: StampCard) => {
  selectedStampCardId.value = card.id;
  editFormData.value = {
    id: card.id,
    name: card.name,
    description: card.description || '',
    rewardDescription: card.rewardDescription,
    status: (card.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') || 'ACTIVE',
    validUntil: card.validUntil ? card.validUntil.slice(0, 10) : '',
    stampPin: '',
    confirmStampPin: '',
  };
  editFormError.value = null;
  showEditStampPin.value = false;
  showEditConfirmStampPin.value = false;
  showEditModal.value = true;
};

const closeEditModal = () => {
  editFormData.value.stampPin = '';
  editFormData.value.confirmStampPin = '';
  showEditStampPin.value = false;
  showEditConfirmStampPin.value = false;
  showEditModal.value = false;
  selectedStampCardId.value = null;
  editFormError.value = null;
};

const handleUpdateStampCard = async () => {
  const data = editFormData.value;
  if (!contactsToken.value) {
    editFormError.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  if (!data.name.trim()) {
    editFormError.value = t('common.name') || 'Name is required';
    return;
  }

  if (!data.rewardDescription.trim()) {
    editFormError.value = t('app.reward') || 'Reward is required';
    return;
  }

  if ((data.stampPin || data.confirmStampPin) && !/^\d{4}$/.test(data.stampPin || '')) {
    editFormError.value = t('contacts.loyalty.pinFormat') || 'PIN must be exactly 4 digits';
    return;
  }

  if (data.stampPin !== data.confirmStampPin) {
    editFormError.value = t('common.error.pinsMustMatch') || 'PIN codes do not match';
    return;
  }

  try {
    editFormLoading.value = true;
    editFormError.value = null;

    const input: UpdateStampCardInput = {
      id: data.id,
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      rewardDescription: data.rewardDescription.trim(),
      status: data.status,
      validUntil: data.validUntil || undefined,
    };

    if (data.stampPin) {
      input.pin = data.stampPin;
    }

    const updated = await updateStampCard(contactsToken.value, input);
    if (!updated) {
      editFormError.value = t('common.error') || 'Failed to update stamp card';
      return;
    }

    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.save') || 'Saved',
      color: 'green',
    });
    closeEditModal();
    await loadLoyaltyData(contactsToken.value);
  } catch (e) {
    logError('Failed to update stamp card:', e);
    editFormError.value = t('common.error') || 'Failed to update stamp card';
  } finally {
    editFormLoading.value = false;
  }
};

const handleDeleteStampCard = async (id: string) => {
  if (!contactsToken.value) return;

  try {
    stampCardsLoading.value = true;
    const ok = await deleteStampCard(contactsToken.value, id);
    if (!ok) {
      toast.add({
        title: t('common.error') || 'Error',
        description: t('common.delete') || 'Delete failed',
        color: 'red',
      });
      return;
    }

    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.delete') || 'Deleted',
      color: 'green',
    });
    await loadLoyaltyData(contactsToken.value);
  } finally {
    stampCardsLoading.value = false;
  }
};

const openDeleteConfirmModal = (id: string) => {
  pendingDeleteStampCardId.value = id;
  showDeleteConfirmModal.value = true;
};

const closeDeleteConfirmModal = () => {
  showDeleteConfirmModal.value = false;
  pendingDeleteStampCardId.value = null;
};

const confirmDeleteStampCard = async () => {
  if (!pendingDeleteStampCardId.value) return;
  const id = pendingDeleteStampCardId.value;
  closeDeleteConfirmModal();
  await handleDeleteStampCard(id);
};

const handleCreateStampCard = async () => {
  const data = createFormData.value;

  if (!data.name.trim()) {
    createFormError.value = t('common.name') || 'Name is required';
    return;
  }

  if (data.totalStamps <= 0) {
    createFormError.value = t('app.totalStamps') || 'Total stamps must be greater than 0';
    return;
  }

  if (!data.rewardDescription.trim()) {
    createFormError.value = t('app.reward') || 'Reward is required';
    return;
  }

  if (!/^\d{4}$/.test(data.stampPin)) {
    createFormError.value = t('contacts.loyalty.pinFormat') || 'PIN must be exactly 4 digits';
    return;
  }

  if (data.stampPin !== data.confirmStampPin) {
    createFormError.value = t('common.error.pinsMustMatch') || 'PIN codes do not match';
    return;
  }

  if (data.validFrom && data.validUntil && new Date(data.validFrom).getTime() > new Date(data.validUntil).getTime()) {
    createFormError.value = t('common.error') || 'Start date must be before end date';
    return;
  }

  try {
    createFormLoading.value = true;
    createFormError.value = null;

    if (!contactsToken.value) {
      createFormError.value = t('common.notAuthenticated') || 'Not authenticated';
      return;
    }

    const created = await createStampCard(contactsToken.value, {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      type: 'CUSTOM',
      totalStamps: data.totalStamps,
      rewardDescription: data.rewardDescription.trim(),
      pin: data.stampPin,
      validFrom: data.validFrom || undefined,
      validUntil: data.validUntil || undefined,
    });

    if (!created) {
      createFormError.value = t('common.error') || 'Failed to create stamp card';
      return;
    }

    toast.add({ 
      title: t('common.success') || 'Success',
      description: t('common.create') || 'Created',
      color: 'green' 
    });
    closeCreateModal();

    await loadLoyaltyData(contactsToken.value);
  } catch (e) {
    logError('Failed to create stamp card:', e);
    createFormError.value = t('common.error') || 'Failed to create stamp card';
    toast.add({ 
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Failed to create stamp card',
      color: 'red' 
    });
  } finally {
    createFormLoading.value = false;
  }
};

const goBack = () => {
  if (process.client) {
    window.history.back();
    return;
  }
  router.back();
};

function parseLimitsJson(raw?: string | null): { max_clients?: number; max_custom_fields?: number; max_loyalty_programs?: number } {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data?.features)) {
      const limits: { max_clients?: number; max_custom_fields?: number; max_loyalty_programs?: number } = {};
      for (const feature of data.features) {
        if (feature?.key === 'max_clients') limits.max_clients = Number(feature.value);
        if (feature?.key === 'max_custom_fields') limits.max_custom_fields = Number(feature.value);
        if (feature?.key === 'max_loyalty_programs') limits.max_loyalty_programs = Number(feature.value);
      }
      return limits;
    }
  } catch {
    return {};
  }
  return {};
}

async function loadPlanLimits() {
  planLimitsLoading.value = true;
  try {
    const res = await getContactsPlanLimits(nsSlug.value, 'pieceowater.contacts', hubToken.value);
    planName.value = res?.planName || '';
    planLimits.value = parseLimitsJson(res?.limitsJson);
  } catch (e) {
    logError('Failed to load contacts plan limits:', e);
    planLimits.value = null;
  } finally {
    planLimitsLoading.value = false;
  }
}

function loadPersistedRoles(): Record<string, StaticAccessRole> {
  if (!process.client) return {};
  try {
    const raw = localStorage.getItem(staticRolesStorageKey.value);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalized: Record<string, StaticAccessRole> = {};
    for (const [memberId, role] of Object.entries(parsed || {})) {
      normalized[memberId] = normalizeRole(role);
    }
    return normalized;
  } catch {
    return {};
  }
}

function persistRoles(next: Record<string, StaticAccessRole>) {
  if (!process.client) return;
  localStorage.setItem(staticRolesStorageKey.value, JSON.stringify(next));
}

async function loadMembersAndRoles() {
  if (!hubToken.value || !nsSlug.value) return;
  rolesLoading.value = true;
  try {
    const namespace = await hubNamespaceBySlug(hubToken.value, nsSlug.value);
    if (!namespace?.id) {
      namespaceMembers.value = [];
      memberRoles.value = {};
      return;
    }

    const members: NamespaceMember[] = [];
    let page = 1;
    let batch: NamespaceMember[];
    do {
      batch = await hubMembersList(hubToken.value, namespace.id, page, 'FIFTY');
      members.push(...batch);
      page += 1;
    } while (batch.length >= 50);

    namespaceMembers.value = members;
    rolesPage.value = 1;

    const persisted = loadPersistedRoles();
    const nextRoles: Record<string, StaticAccessRole> = {};
    for (const member of members) {
      nextRoles[member.id] = normalizeRole(persisted[member.id]);
    }
    const ownerMember = members.find((member) => member.userId === namespace.owner);
    if (ownerMember) {
      nextRoles[ownerMember.id] = 'OWNER';
    }

    memberRoles.value = nextRoles;
    persistRoles(nextRoles);
  } catch (e) {
    logError('Failed to load members/roles in contacts settings:', e);
  } finally {
    rolesLoading.value = false;
  }
}

async function assignStaticRole(memberId: string, role: StaticAccessRole) {
  try {
    roleSavingMemberId.value = memberId;
    const next = { ...memberRoles.value, [memberId]: role };
    memberRoles.value = next;
    persistRoles(next);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.saved') || 'Saved',
      color: 'green',
    });
  } finally {
    roleSavingMemberId.value = null;
  }
}

function openRoleModal(memberId: string) {
  roleModalMemberId.value = memberId;
  roleModalValue.value = memberRoles.value[memberId] || 'VIEWER';
  showRoleModal.value = true;
}

function closeRoleModal() {
  showRoleModal.value = false;
  roleModalMemberId.value = null;
}

async function confirmRoleModal() {
  if (!roleModalMemberId.value) return;
  await assignStaticRole(roleModalMemberId.value, roleModalValue.value);
  closeRoleModal();
}

async function loadSettings() {
  try {
    loading.value = true;
    error.value = null;
    
    if (!hubToken.value || !nsSlug.value) {
      error.value = t('common.error.missingCredentials');
      return;
    }

    const token = await ensure(nsSlug.value, hubToken.value);
    if (!token) return;
    
    contactsToken.value = token;

    await Promise.all([
      loadLoyaltyData(token),
      loadDynamicFieldsData(token),
      loadPlanLimits(),
      loadMembersAndRoles(),
    ]);
  } catch (e) {
    logError('Failed to load settings:', e);
    error.value = t('common.errorDetails.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function loadLoyaltyData(token: string) {
  stampCardsLoading.value = true;
  stampCardsError.value = null;

  try {
    const cards = await getStampCards(token);
    stampCards.value = cards;
  } catch (e) {
    logError('Failed to load stamp cards for settings:', e);
    stampCardsError.value = t('common.errorDetails.loadFailed');
  } finally {
    stampCardsLoading.value = false;
  }
}


onMounted(async () => {
  await loadSettings();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('common.settings.title') }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ nsTitle }}
        </span>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="lucide:star"
          size="xs"
          color="amber"
          variant="soft"
          :to="`/${nsSlug}/contacts/plans`"
        >
          {{ t('app.upgradePlan') || 'Upgrade Plan' }}
        </UButton>
        <UButton
          icon="lucide:arrow-left"
          size="xs"
          color="primary"
          variant="soft"
          class="self-start min-w-fit whitespace-nowrap gap-2"
          @click="goBack"
        >
          <span class="hidden sm:inline">{{ t('app.back') }}</span>
        </UButton>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-if="error && !loading"
      class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center flex-1"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <!-- Settings Content -->
    <div
      v-else
      class="flex-1 flex flex-col min-h-0"
    >
      <div class="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto">
        <!-- Current Plan -->
        <div
          v-if="planLimits !== null && !planLimitsLoading"
          class="rounded-lg border border-blue-200 dark:border-gray-700 bg-blue-50/50 dark:bg-gray-900/40 p-4"
        >
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                {{ t('app.subscriptionPlans') || 'Plan' }}: {{ planName || '—' }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('app.contactsSubtitle') || 'Manage your clients and partners.' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
              <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
                {{ planLimitLabel('max_clients') }}:
                <strong>{{ planLimits.max_clients ?? '∞' }}</strong>
              </span>
              <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
                {{ planLimitLabel('max_custom_fields') }}:
                <strong>{{ planLimits.max_custom_fields ?? '∞' }}</strong>
              </span>
              <span class="px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
                {{ planLimitLabel('max_loyalty_programs') }}:
                <strong>{{ planLimits.max_loyalty_programs ?? '∞' }}</strong>
              </span>
            </div>
          </div>
        </div>



        <!-- Stamp Cards, Import, and Bonus PIN Management (Grid Layout) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Stamp Cards (50%) -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('app.stampCards') || 'Stamp Cards' }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ t('contacts.loyalty.stampCardsDescription') || 'Active stamp cards for your clients' }}
                </p>
              </div>
              <UButton
                icon="lucide:plus"
                size="sm"
                color="primary"
                variant="soft"
                :disabled="stampCardsLoading"
                class="flex-shrink-0"
                @click="openCreateModal"
              >
                {{ t('common.add') || t('app.add') || 'Add' }}
              </UButton>
            </div>
            
            <div
              v-if="stampCardsLoading"
              class="flex items-center justify-center py-8"
            >
              <UIcon
                name="lucide:loader-2"
                class="w-5 h-5 animate-spin text-gray-400"
              />
            </div>
            
            <div
              v-else-if="stampCardsError"
              class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
            >
              {{ stampCardsError }}
            </div>

            <div
              v-else-if="stampCards.length === 0"
              class="text-center py-8 text-gray-500 dark:text-gray-400"
            >
              <UIcon
                name="lucide:inbox"
                class="w-8 h-8 mx-auto mb-2 opacity-50"
              />
              <p>{{ t('common.noData') || 'No stamp cards found' }}</p>
            </div>

            <div
              v-else
              class="grid gap-3"
            >
              <div 
                v-for="card in stampCards"
                :key="card.id"
                class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
              >
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-gray-100">
                      {{ card.name }}
                    </h4>
                    <p
                      v-if="card.description"
                      class="text-sm text-gray-600 dark:text-gray-400 mt-1"
                    >
                      {{ card.description }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span 
                      :class="[
                        'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                        card.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        card.status === 'INACTIVE' ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      ]"
                    >
                      {{ card.status }}
                    </span>
                    <UButton
                      icon="lucide:pencil"
                      size="xs"
                      color="gray"
                      variant="ghost"
                      :disabled="stampCardsLoading"
                      @click="openEditModal(card)"
                    />
                    <UButton
                      icon="lucide:trash-2"
                      size="xs"
                      color="red"
                      variant="ghost"
                      :disabled="stampCardsLoading"
                      @click="openDeleteConfirmModal(card.id)"
                    />
                  </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">{{ t('app.totalStamps') || 'Total Stamps' }}</span>
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ card.totalStamps }}
                    </p>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">{{ t('app.reward') || 'Reward' }}</span>
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ card.rewardDescription }}
                    </p>
                  </div>
                  <div
                    v-if="card.validFrom"
                    class="text-xs text-gray-500 dark:text-gray-500"
                  >
                    {{ t('app.from') || 'From' }}: {{ new Date(card.validFrom).toLocaleDateString() }}
                  </div>
                  <div
                    v-if="card.validUntil"
                    class="text-xs text-gray-500 dark:text-gray-500"
                  >
                    {{ t('app.until') || 'Until' }}: {{ new Date(card.validUntil).toLocaleDateString() }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Import and Bonus PIN Management -->
          <div class="flex flex-col gap-4">
            <!-- Import -->
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                    Импорт клиентов
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Загрузите список клиентов из Excel-файла
                  </p>
                </div>
                <UButton
                  icon="lucide:upload"
                  size="sm"
                  color="primary"
                  variant="soft"
                  @click="showImportModal = true"
                >
                  Импорт
                </UButton>
              </div>
            </div>

            <!-- Bonus PIN Management -->
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <BonusPinManager 
                :token="contactsToken || ''"
                @success="(msg) => toast.add({ title: msg, color: 'green' })"
                @error="(msg) => toast.add({ title: msg, color: 'red' })"
              />
            </div>
          </div>
        </div>

        <!-- Dynamic Fields -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                {{ t('contacts.dynamicFields.title') || 'Пользовательские поля' }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ t('contacts.dynamicFields.description') || 'Дополнительные поля для карточки клиента.' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                icon="lucide:plus"
                size="sm"
                color="primary"
                variant="soft"
                :disabled="dynamicFieldsLoading"
                @click="openCreateDynamicFieldModal"
              >
                {{ t('common.add') || 'Add' }}
              </UButton>
            </div>
          </div>

          <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span class="px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {{ t('common.showing') || 'Показано' }}: <strong>{{ filteredDynamicFields.length }}</strong>
            </span>
            <div class="inline-flex items-center gap-2">
              <UToggle
                v-model="includeDeletedDynamicFields"
                @update:model-value="contactsToken && loadDynamicFieldsData(contactsToken)"
              />
              <span class="text-gray-600 dark:text-gray-400">{{ t('common.showDeleted') || 'Показывать удаленные' }}</span>
            </div>
          </div>

          <div
            v-if="dynamicFieldsLoading"
            class="flex items-center justify-center py-8"
          >
            <UIcon
              name="lucide:loader-2"
              class="w-5 h-5 animate-spin text-gray-400"
            />
          </div>

          <div
            v-else-if="dynamicFieldsError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ dynamicFieldsError }}
          </div>

          <div
            v-else-if="filteredDynamicFields.length === 0"
            class="text-center py-8 text-gray-500 dark:text-gray-400"
          >
            <UIcon
              name="lucide:table-properties"
              class="w-8 h-8 mx-auto mb-2 opacity-50"
            />
            <p>{{ t('common.noData') || 'Нет данных' }}</p>
          </div>

          <div
            v-else
            class="grid gap-3"
          >
            <div
              v-for="(field, index) in filteredDynamicFields"
              :key="field.id"
              class="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              :class="field.deletedAt ? 'opacity-70 bg-gray-50 dark:bg-gray-900/30' : ''"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="font-medium text-gray-900 dark:text-gray-100">
                      {{ field.label }}
                    </h4>
                    <UBadge
                      color="gray"
                      variant="soft"
                    >
                      {{ dynamicFieldTypeLabel(field.dataType) }}
                    </UBadge>
                    <UBadge
                      color="gray"
                      variant="soft"
                    >
                      {{ dynamicFieldScopeLabel(field.clientTypeScope) }}
                    </UBadge>
                    <UBadge
                      v-if="field.searchable"
                      color="gray"
                      variant="soft"
                    >
                      {{ t('common.search') || 'Поиск' }}
                    </UBadge>
                    <UBadge
                      v-if="field.deletedAt"
                      color="gray"
                      variant="soft"
                    >
                      {{ t('common.deleted') || 'Удалено' }}
                    </UBadge>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {{ t('common.createdAt') || 'Создано' }}: {{ new Date(field.createdAt).toLocaleString() }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <UButton
                    v-if="field.deletedAt"
                    icon="lucide:rotate-ccw"
                    size="xs"
                    color="primary"
                    variant="soft"
                    :disabled="deleteDynamicFieldLoading"
                    @click="handleRestoreDynamicField(field.id)"
                  >
                    {{ t('common.restore') || 'Восстановить' }}
                  </UButton>
                  <template v-else>
                    <UButton
                      icon="lucide:arrow-up"
                      size="xs"
                      color="gray"
                      variant="ghost"
                      :disabled="editDynamicFieldLoading || index === 0"
                      @click="moveDynamicField(field, 'up')"
                    />
                    <UButton
                      icon="lucide:arrow-down"
                      size="xs"
                      color="gray"
                      variant="ghost"
                      :disabled="editDynamicFieldLoading || index === filteredDynamicFields.length - 1"
                      @click="moveDynamicField(field, 'down')"
                    />
                    <UButton
                      icon="lucide:pencil"
                      size="xs"
                      color="gray"
                      variant="ghost"
                      :disabled="editDynamicFieldLoading"
                      @click="openEditDynamicFieldModal(field)"
                    />
                    <UButton
                      icon="lucide:trash-2"
                      size="xs"
                      color="red"
                      variant="ghost"
                      :disabled="deleteDynamicFieldLoading"
                      @click="openDeleteDynamicFieldModal(field.id)"
                    />
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Members Roles -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 shadow-sm">
          <div class="flex flex-col gap-3 mb-4">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                Роли участников
              </h3>
              <UButton
                size="xs"
                color="gray"
                variant="soft"
                icon="lucide:circle-help"
                @click="showRolesLegend = !showRolesLegend"
              >
                {{ showRolesLegend ? 'Скрыть подсказку по ролям' : 'Подсказка по ролям' }}
              </UButton>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Управление ролями участников неймспейса.
            </p>
            <div
              v-if="showRolesLegend"
              class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
            >
              <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-900/10 p-3">
                <div class="text-sm font-semibold text-red-700 dark:text-red-300">
                  Владелец
                </div>
                <p class="text-xs text-red-600/80 dark:text-red-200/80 mt-1">
                  Полный контроль над неймспейсом и приложением.
                </p>
              </div>
              <div class="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10 p-3">
                <div class="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Админ
                </div>
                <p class="text-xs text-amber-600/80 dark:text-amber-200/80 mt-1">
                  Расширенные полномочия: больше прав, чем у оператора.
                </p>
              </div>
              <div class="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-900/10 p-3">
                <div class="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Оператор
                </div>
                <p class="text-xs text-blue-600/80 dark:text-blue-200/80 mt-1">
                  Операционная работа с клиентами и кампаниями.
                </p>
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-3">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Наблюдатель
                </div>
                <p class="text-xs text-gray-600/80 dark:text-gray-300/80 mt-1">
                  Доступ на просмотр без изменений.
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="rolesLoading"
            class="py-8 flex justify-center"
          >
            <UIcon
              name="lucide:loader-2"
              class="w-5 h-5 animate-spin text-gray-400"
            />
          </div>

          <div
            v-else-if="namespaceMembers.length === 0"
            class="text-sm text-gray-500 dark:text-gray-400 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700"
          >
            Участники не найдены в текущем неймспейсе.
          </div>

          <div
            v-else
            class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                      Участник
                    </th>
                    <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                      Email
                    </th>
                    <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                      Текущая роль
                    </th>
                    <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200 w-56">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="member in paginatedMembers"
                    :key="member.id"
                    class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td class="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {{ member.username }}
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {{ member.email }}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                        :class="roleTone(memberRoles[member.id] || 'VIEWER')"
                      >
                        {{ roleLabel(memberRoles[member.id] || 'VIEWER') }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <UButton
                        size="xs"
                        variant="soft"
                        color="primary"
                        icon="lucide:shield-check"
                        :disabled="roleSavingMemberId === member.id"
                        @click="openRoleModal(member.id)"
                      >
                        Изменить роль
                      </UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex flex-wrap justify-between items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-700">
              <div class="text-xs text-gray-600 dark:text-gray-400">
                Показаны {{ rolesFrom }}-{{ rolesTo }} из {{ namespaceMembers.length }} участников
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 dark:text-gray-400">Строк на странице</span>
                <USelect
                  :model-value="rolesPageSize"
                  :options="rolesPageSizeOptions"
                  class="w-20"
                  size="xs"
                  @update:model-value="(value) => { rolesPageSize = Number(value); rolesPage = 1; }"
                />
                <UPagination
                  v-model="rolesPage"
                  :page-count="rolesPageSize"
                  :total="namespaceMembers.length"
                  size="xs"
                  :ui="{ wrapper: 'flex items-center gap-0.5', rounded: 'min-w-[28px] justify-center text-xs', default: { activeButton: { variant: 'outline' } } }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ImportModal
      v-model="showImportModal"
      :namespace="nsSlug"
    />

    <UModal
      v-model="showRoleModal"
      @close="closeRoleModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Назначение роли
              </h3>
              <p
                v-if="roleModalMember"
                class="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                {{ roleModalMember.username }} · {{ roleModalMember.email }}
              </p>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeRoleModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Роль">
            <USelect
              v-model="roleModalValue"
              :options="staticRoleOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              @click="closeRoleModal"
            >
              Отмена
            </UButton>
            <UButton
              color="primary"
              :loading="!!roleSavingMemberId"
              @click="confirmRoleModal"
            >
              Сохранить
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal
      v-model="showCreateDynamicFieldModal"
      @close="closeCreateDynamicFieldModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Создать поле
              </h3>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeCreateDynamicFieldModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="createDynamicFieldError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ createDynamicFieldError }}
          </div>

          <div class="grid grid-cols-1 gap-4">
            <UFormGroup
              label="Название"
              required
            >
              <UInput
                v-model="createDynamicFieldForm.label"
                placeholder="День рождения"
                :disabled="createDynamicFieldLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              label="Тип данных"
              required
            >
              <USelectMenu
                :model-value="createDynamicFieldForm.dataType"
                :options="dynamicFieldDataTypeOptions"
                value-attribute="value"
                option-attribute="label"
                :disabled="createDynamicFieldLoading"
                @update:model-value="(value) => onCreateDynamicFieldDataTypeChange(value as DynamicFieldDataType)"
              />
            </UFormGroup>
            <UFormGroup
              label="Область применения"
              required
            >
              <USelectMenu
                v-model="createDynamicFieldForm.clientTypeScope"
                :options="dynamicFieldScopeOptions"
                value-attribute="value"
                option-attribute="label"
                :disabled="createDynamicFieldLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span class="text-sm text-gray-700 dark:text-gray-300">Показывать звездочку</span>
              <UToggle
                v-model="createDynamicFieldForm.isRequired"
                :disabled="createDynamicFieldLoading || createDynamicFieldForm.dataType === 'BOOLEAN'"
              />
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span class="text-sm text-gray-700 dark:text-gray-300">Участвует в поиске</span>
              <UToggle
                v-model="createDynamicFieldForm.searchable"
                :disabled="createDynamicFieldLoading"
              />
            </div>
          </div>

          <div
            v-if="createDynamicFieldForm.dataType === 'SELECT' || createDynamicFieldForm.dataType === 'MULTI_SELECT'"
            class="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3"
          >
            <DynamicFieldOptionsEditor
              v-model="createDynamicFieldOptions"
              :disabled="createDynamicFieldLoading"
            />
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Превью поля
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-800 dark:text-slate-200">
                {{ createDynamicFieldForm.label.trim() || 'Название поля' }}
                <span
                  v-if="createDynamicFieldForm.isRequired"
                  class="text-red-500"
                >*</span>
              </label>

              <DynamicFieldPreviewControl
                v-model="createPreviewValue"
                :data-type="createDynamicFieldForm.dataType"
                :options="createDynamicFieldOptionChoices"
                :disabled="createDynamicFieldLoading"
                string-placeholder="Текстовое значение"
                number-placeholder="0"
                select-placeholder="Выберите вариант"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              :disabled="createDynamicFieldLoading"
              @click="closeCreateDynamicFieldModal"
            >
              {{ t('common.cancel') || 'Отмена' }}
            </UButton>
            <UButton
              color="primary"
              :loading="createDynamicFieldLoading"
              :disabled="!isCreateDynamicFieldValid"
              @click="handleCreateDynamicField"
            >
              {{ t('common.create') || 'Создать' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal
      v-model="showEditDynamicFieldModal"
      @close="closeEditDynamicFieldModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Редактирование поля
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Обновите название, параметры и варианты выбора
              </p>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeEditDynamicFieldModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="editDynamicFieldError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ editDynamicFieldError }}
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Основное
            </div>
            <div class="grid grid-cols-1 gap-4">
              <UFormGroup
                label="Название"
                required
              >
                <UInput
                  v-model="editDynamicFieldForm.label"
                  :disabled="editDynamicFieldLoading"
                />
              </UFormGroup>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup label="Тип данных">
              <UInput
                :model-value="dynamicFieldTypeLabel(editDynamicFieldForm.dataType)"
                disabled
              />
            </UFormGroup>
            <UFormGroup label="Область применения">
              <UInput
                :model-value="dynamicFieldScopeLabel(editDynamicFieldForm.clientTypeScope)"
                disabled
              />
            </UFormGroup>
          </div>

          <div class="flex flex-wrap gap-4">
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-1 min-w-[220px]">
              <span class="text-sm text-gray-700 dark:text-gray-300">Показывать звездочку</span>
              <UToggle
                v-model="editDynamicFieldForm.isRequired"
                :disabled="editDynamicFieldLoading || editDynamicFieldForm.dataType === 'BOOLEAN'"
              />
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-1 min-w-[220px]">
              <span class="text-sm text-gray-700 dark:text-gray-300">Участвует в поиске</span>
              <UToggle
                v-model="editDynamicFieldForm.searchable"
                :disabled="editDynamicFieldLoading"
              />
            </div>
          </div>

          <div
            v-if="editDynamicFieldForm.dataType === 'SELECT' || editDynamicFieldForm.dataType === 'MULTI_SELECT'"
            class="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3"
          >
            <DynamicFieldOptionsEditor
              v-model="editDynamicFieldOptions"
              :disabled="editDynamicFieldLoading"
            />

            <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
              <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Превью выбора
              </div>
              <DynamicFieldPreviewControl
                v-model="editPreviewValue"
                :data-type="editDynamicFieldForm.dataType"
                :options="editDynamicFieldOptionChoices"
                :disabled="editDynamicFieldLoading"
                select-placeholder="Выберите вариант"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              :disabled="editDynamicFieldLoading"
              @click="closeEditDynamicFieldModal"
            >
              {{ t('common.cancel') || 'Отмена' }}
            </UButton>
            <UButton
              color="primary"
              :loading="editDynamicFieldLoading"
              :disabled="!isEditDynamicFieldValid"
              @click="handleEditDynamicField"
            >
              {{ t('common.save') || 'Сохранить' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal
      v-model="showDeleteDynamicFieldConfirmModal"
      @close="closeDeleteDynamicFieldModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Удалить поле
            </h3>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeDeleteDynamicFieldModal"
            />
          </div>
        </template>

        <p class="text-sm text-gray-600 dark:text-gray-300">
          Поле будет скрыто, но его можно восстановить позже.
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              @click="closeDeleteDynamicFieldModal"
            >
              {{ t('common.cancel') || 'Отмена' }}
            </UButton>
            <UButton
              color="red"
              :loading="deleteDynamicFieldLoading"
              @click="confirmDeleteDynamicField"
            >
              {{ t('common.delete') || 'Удалить' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Create Stamp Card Modal -->
    <UModal
      v-model="showCreateModal"
      @close="closeCreateModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <UIcon
                  name="lucide:ticket"
                  class="w-5 h-5"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('common.create') || 'Create' }} {{ t('common.stampCards') || t('app.stampCards') || 'Stamp Cards' }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('contacts.loyalty.stampCardsDescription') || 'Configure stamp card details and PIN protection' }}
                </p>
              </div>
            </div>

            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeCreateModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="createFormError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ createFormError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.name') || 'Name'"
              required
            >
              <UInput
                v-model="createFormData.name"
                :placeholder="t('common.name') || 'Card name'"
                icon="lucide:type"
                :disabled="createFormLoading"
              />
            </UFormGroup>

            <UFormGroup
              :label="t('app.totalStamps') || 'Total stamps'"
              required
            >
              <UInput
                v-model.number="createFormData.totalStamps"
                type="number"
                min="1"
                max="1000"
                icon="lucide:hash"
                :disabled="createFormLoading"
              />
            </UFormGroup>
          </div>

          <UFormGroup :label="t('common.description') || 'Description'">
            <UTextarea
              v-model="createFormData.description"
              :placeholder="t('common.description') || 'Description'"
              :disabled="createFormLoading"
              :rows="3"
            />
          </UFormGroup>

          <UFormGroup
            :label="t('app.reward') || 'Reward'"
            required
          >
            <UInput
              v-model="createFormData.rewardDescription"
              :placeholder="rewardPlaceholder"
              icon="lucide:gift"
              :disabled="createFormLoading"
            />
          </UFormGroup>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('common.from') || t('app.from') || 'From'">
              <UInput
                v-model="createFormData.validFrom"
                type="date"
                :disabled="createFormLoading"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.until') || t('app.until') || 'Until'">
              <UInput
                v-model="createFormData.validUntil"
                type="date"
                :disabled="createFormLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.newPin') || 'PIN'"
              required
            >
              <div class="relative">
                <input
                  :value="createFormData.stampPin"
                  :type="showStampPin ? 'text' : 'password'"
                  name="contacts-stamp-pin-new"
                  autocomplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="0000"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :disabled="createFormLoading"
                  @keydown="onPinKeydown"
                  @keydown.enter.prevent="handleCreateStampCard"
                  @input="onStampPinInput"
                  @paste="(e) => onStampPinPaste(e, 'stampPin')"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  :disabled="createFormLoading"
                  @click="showStampPin = !showStampPin"
                >
                  <UIcon
                    :name="showStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                    class="w-4 h-4"
                  />
                </button>
              </div>
            </UFormGroup>

            <UFormGroup
              :label="t('common.confirmPin') || 'Confirm PIN'"
              required
            >
              <div class="relative">
                <input
                  :value="createFormData.confirmStampPin"
                  :type="showConfirmStampPin ? 'text' : 'password'"
                  name="contacts-stamp-pin-confirm"
                  autocomplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="0000"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :disabled="createFormLoading"
                  @keydown="onPinKeydown"
                  @keydown.enter.prevent="handleCreateStampCard"
                  @input="onConfirmStampPinInput"
                  @paste="(e) => onStampPinPaste(e, 'confirmStampPin')"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  :disabled="createFormLoading"
                  @click="showConfirmStampPin = !showConfirmStampPin"
                >
                  <UIcon
                    :name="showConfirmStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                    class="w-4 h-4"
                  />
                </button>
              </div>
            </UFormGroup>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <UButton
              type="button"
              color="gray"
              variant="outline"
              icon="lucide:x"
              :disabled="createFormLoading"
              @click="closeCreateModal"
            >
              {{ t('common.cancel') || 'Cancel' }}
            </UButton>

            <UButton
              type="submit"
              color="primary"
              icon="lucide:check"
              :loading="createFormLoading"
              :disabled="!isCreateFormValid"
              @click="handleCreateStampCard"
            >
              {{ t('common.create') || 'Create' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal
      v-model="showEditModal"
      @close="closeEditModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('contacts.editStampCard') || 'Редактировать карту штампов' }}
            </h3>
            <UButton
              type="button"
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeEditModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="editFormError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ editFormError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.name') || 'Name'"
              required
            >
              <UInput
                v-model="editFormData.name"
                :disabled="editFormLoading"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.status') || 'Status'">
              <USelectMenu
                v-model="editFormData.status"
                :options="[
                  { value: 'ACTIVE', label: t('contacts.active') || 'Active' },
                  { value: 'INACTIVE', label: t('contacts.blocked') || 'Inactive' },
                  { value: 'ARCHIVED', label: t('contacts.archived') || 'Archived' },
                ]"
                value-attribute="value"
                option-attribute="label"
                :disabled="editFormLoading"
              />
            </UFormGroup>
          </div>

          <UFormGroup :label="t('common.description') || 'Description'">
            <UTextarea
              v-model="editFormData.description"
              :rows="3"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <UFormGroup
            :label="t('app.reward') || 'Reward'"
            required
          >
            <UInput
              v-model="editFormData.rewardDescription"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <UFormGroup :label="t('common.until') || t('app.until') || 'Until'">
            <UInput
              v-model="editFormData.validUntil"
              type="date"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
              {{ t('contacts.loyalty.bonusPin') || 'Bonus PIN' }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormGroup :label="t('common.newPin') || 'PIN'">
                <div class="relative">
                  <input
                    :value="editFormData.stampPin"
                    :type="showEditStampPin ? 'text' : 'password'"
                    readonly
                    name="contacts-stamp-pin-edit"
                    autocomplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    maxlength="4"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="0000"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    :disabled="editFormLoading"
                    @focus="($event.target as HTMLInputElement).removeAttribute('readonly')"
                    @keydown="onPinKeydown"
                    @keydown.enter.prevent="handleUpdateStampCard"
                    @input="onEditStampPinInput"
                    @paste="(e) => onEditStampPinPaste(e, 'stampPin')"
                  >
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    :disabled="editFormLoading"
                    @click="showEditStampPin = !showEditStampPin"
                  >
                    <UIcon
                      :name="showEditStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                      class="w-4 h-4"
                    />
                  </button>
                </div>
              </UFormGroup>

              <UFormGroup :label="t('common.confirmPin') || 'Confirm PIN'">
                <div class="relative">
                  <input
                    :value="editFormData.confirmStampPin"
                    :type="showEditConfirmStampPin ? 'text' : 'password'"
                    readonly
                    name="contacts-stamp-pin-edit-confirm"
                    autocomplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    maxlength="4"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="0000"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    :disabled="editFormLoading"
                    @focus="($event.target as HTMLInputElement).removeAttribute('readonly')"
                    @keydown="onPinKeydown"
                    @keydown.enter.prevent="handleUpdateStampCard"
                    @input="onEditConfirmStampPinInput"
                    @paste="(e) => onEditStampPinPaste(e, 'confirmStampPin')"
                  >
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    :disabled="editFormLoading"
                    @click="showEditConfirmStampPin = !showEditConfirmStampPin"
                  >
                    <UIcon
                      :name="showEditConfirmStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                      class="w-4 h-4"
                    />
                  </button>
                </div>
              </UFormGroup>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <UButton
              type="button"
              color="gray"
              variant="outline"
              icon="lucide:x"
              :disabled="editFormLoading"
              @click="closeEditModal"
            >
              {{ t('common.cancel') || 'Cancel' }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              icon="lucide:check"
              :loading="editFormLoading"
              :disabled="!isEditFormValid"
              @click="handleUpdateStampCard"
            >
              {{ t('common.save') || 'Save' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal
      v-model="showDeleteConfirmModal"
      @close="closeDeleteConfirmModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('common.confirmDelete') || 'Confirm deletion' }}
            </h3>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeDeleteConfirmModal"
            />
          </div>
        </template>

        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('common.confirmDelete') || 'Are you sure you want to delete this item?' }}
        </p>

        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <UButton
              color="gray"
              variant="outline"
              icon="lucide:x"
              @click="closeDeleteConfirmModal"
            >
              {{ t('common.cancel') || 'Cancel' }}
            </UButton>
            <UButton
              color="red"
              icon="lucide:trash-2"
              :loading="stampCardsLoading"
              @click="confirmDeleteStampCard"
            >
              {{ t('common.delete') || 'Delete' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
</style>
