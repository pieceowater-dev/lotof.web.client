<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import ContactsClientLinkField from '@/components/goods/ContactsClientLinkField.vue';
import type { GoodsSupplier } from '@/api/goods/supplier';
import type { GoodsGood } from '@/api/goods/good';
import type { SupplierPriceHistoryEntry } from '@/api/goods/goodsreceipt';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { confirm } = useConfirm();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.suppliers')} — ${titleBySlug(nsSlug.value)}` : t('goods.suppliers'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const loading = ref(true);
const suppliers = ref<GoodsSupplier[]>([]);
const goods = ref<GoodsGood[]>([]);
const contactsIntegrationEnabled = ref(false);
const supplierById = computed(() => new Map(suppliers.value.map((s) => [s.id, s])));
const searchQuery = ref('');
const filteredSuppliers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return suppliers.value;
  return suppliers.value.filter((s) => s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q));
});

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ suppliers: s }, { goods: g }, settings] = await Promise.all([
      (await import('@/api/goods/supplier')).goodsListSuppliers(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/settings')).goodsGetSettings(token, nsSlug.value),
    ]);
    suppliers.value = s;
    goods.value = g;
    contactsIntegrationEnabled.value = settings.contactsIntegrationEnabled;
  } catch (e) {
    logError('[goods/suppliers] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load suppliers', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const columns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'phone', label: t('goods.phone') },
  { key: 'contactPerson', label: t('goods.contactPerson') },
  { key: 'actions', label: '' },
];

// --- Add / edit ---
const showForm = ref(false);
const saving = ref(false);
const editingSupplier = ref<GoodsSupplier | null>(null);
const deletingId = ref<string | null>(null);
const form = reactive({ name: '', phone: '', contactPerson: '', identity: '', contactsClientId: '' });

function openAdd() {
  editingSupplier.value = null;
  form.name = ''; form.phone = ''; form.contactPerson = ''; form.identity = ''; form.contactsClientId = '';
  showForm.value = true;
}
function openEdit(s: GoodsSupplier) {
  editingSupplier.value = s;
  form.name = s.name; form.phone = s.phone; form.contactPerson = s.contactPerson;
  form.identity = s.identity; form.contactsClientId = s.contactsClientId || '';
  showForm.value = true;
}

async function submitForm() {
  if (!form.name.trim()) return;
  saving.value = true;
  try {
    const token = await getToken();
    if (editingSupplier.value) {
      const { goodsUpdateSupplier } = await import('@/api/goods/supplier');
      await goodsUpdateSupplier(token, nsSlug.value, {
        ...editingSupplier.value,
        name: form.name.trim(), phone: form.phone.trim(), contactPerson: form.contactPerson.trim(),
        identity: form.identity.trim(), contactsClientId: form.contactsClientId.trim() || undefined,
      });
    } else {
      const { goodsCreateSupplier } = await import('@/api/goods/supplier');
      await goodsCreateSupplier(token, nsSlug.value, {
        name: form.name.trim(), phone: form.phone.trim(), contactPerson: form.contactPerson.trim(),
        identity: form.identity.trim(), contactsClientId: form.contactsClientId.trim() || undefined,
      });
    }
    showForm.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/suppliers] submitForm failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save supplier', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function deleteSupplier(s: GoodsSupplier) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${s.name}"` }))) return;
  deletingId.value = s.id;
  try {
    const token = await getToken();
    const { goodsDeleteSupplier } = await import('@/api/goods/supplier');
    await goodsDeleteSupplier(token, nsSlug.value, s.id);
    await loadAll();
  } catch (e) {
    logError('[goods/suppliers] deleteSupplier failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete supplier', color: 'red' });
  } finally {
    deletingId.value = null;
  }
}

// --- Contacts client summary (resolved on demand, plan §14) ---
const contactsSummaryCache = ref<Record<string, { name?: string | null; phone?: string | null; isVip: boolean } | null>>({});

async function resolveContactsSummary(supplier: GoodsSupplier) {
  if (!supplier.contactsClientId || contactsSummaryCache.value[supplier.id] !== undefined) return;
  try {
    const token = await getToken();
    const { goodsClient } = await import('@/api/clients');
    const { getDeviceHeaders } = await import('@/utils/device');
    const { goodsRequestWithRefresh } = await import('@/api/goods/goodsRequestWithRefresh');
    const devHeaders = await getDeviceHeaders();
    const Document = /* GraphQL */ `
      query ContactsClientSummary($clientId: ID!) { contactsClientSummary(clientId: $clientId) { clientId name phone isVip } }
    `;
    const res = await goodsRequestWithRefresh(async () => goodsClient.request<{ contactsClientSummary: { name?: string; phone?: string; isVip: boolean } | null }>(
      Document, { clientId: supplier.contactsClientId }, { headers: { GoodsAuthorization: `Bearer ${token}`, Namespace: nsSlug.value, ...devHeaders } }
    ), nsSlug.value);
    contactsSummaryCache.value[supplier.id] = res.contactsClientSummary || null;
  } catch {
    contactsSummaryCache.value[supplier.id] = null;
  }
}

// --- Price history ---
const showHistory = ref(false);
const historyGoodQuery = ref('');
const visibleHistoryGoods = computed(() => {
  const q = historyGoodQuery.value.trim().toLowerCase();
  if (!q) return goods.value;
  return goods.value.filter((g) => g.name.toLowerCase().includes(q));
});
const historyGoodId = ref('');
const history = ref<SupplierPriceHistoryEntry[]>([]);
const loadingHistory = ref(false);

async function openHistory(goodId: string) {
  historyGoodId.value = goodId;
  showHistory.value = true;
  loadingHistory.value = true;
  try {
    const token = await getToken();
    const { goodsSupplierPriceHistory } = await import('@/api/goods/goodsreceipt');
    history.value = await goodsSupplierPriceHistory(token, nsSlug.value, goodId);
  } catch (e) {
    logError('[goods/suppliers] openHistory failed', e);
  } finally {
    loadingHistory.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center justify-between flex-shrink-0">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.suppliers') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.suppliersSubtitle') }}</p>
      </div>
      <UButton color="primary" icon="lucide:plus" @click="openAdd">{{ t('goods.addSupplier') }}</UButton>
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs>
        <template #search>
          <UInput v-model="searchQuery" icon="lucide:search" size="sm" class="max-w-xs" :placeholder="t('common.search')" />
        </template>
      </GoodsNavTabs>
    </div>

    <div class="flex-1 min-h-0 mt-3 flex flex-col gap-3">
      <div class="flex-1 min-h-0">
        <AppTable :rows="filteredSuppliers" :columns="columns" :loading="loading" empty-icon="lucide:truck">
          <template #name-data="{ row }">
            <div class="flex items-center gap-2" @mouseenter="resolveContactsSummary(row)">
              <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openEdit(supplierById.get(row.id)!)">
                {{ row.name }}
              </button>
              <UBadge v-if="row.contactsClientId && contactsSummaryCache[row.id]" color="primary" variant="soft" size="xs">
                {{ contactsSummaryCache[row.id]?.name || t('goods.unknownContact') }}
              </UBadge>
            </div>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" :loading="deletingId === row.id" @click="deleteSupplier(supplierById.get(row.id)!)" />
            </div>
          </template>
        </AppTable>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2 flex-shrink-0 max-h-52 overflow-y-auto">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('goods.priceHistory') }}</h3>
        <UInput v-model="historyGoodQuery" size="xs" icon="lucide:search" :placeholder="t('common.search')" class="max-w-xs" />
        <div class="flex flex-wrap gap-1.5">
          <UButton v-for="g in visibleHistoryGoods" :key="g.id" size="2xs" color="gray" variant="soft" @click="openHistory(g.id)">{{ g.name }}</UButton>
        </div>
      </div>
    </div>

    <UModal v-model="showForm">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ editingSupplier ? t('goods.editSupplier') : t('goods.addSupplier') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required><UInput v-model="form.name" autofocus @keyup.enter="submitForm" /></UFormGroup>
          <UFormGroup :label="t('goods.phone')"><UInput v-model="form.phone" @keyup.enter="submitForm" /></UFormGroup>
          <UFormGroup :label="t('goods.contactPerson')"><UInput v-model="form.contactPerson" @keyup.enter="submitForm" /></UFormGroup>
          <UFormGroup :label="t('goods.identity')"><UInput v-model="form.identity" @keyup.enter="submitForm" /></UFormGroup>
          <UFormGroup :label="t('goods.linkToContacts')">
            <ContactsClientLinkField
              v-model="form.contactsClientId"
              :ns-slug="nsSlug"
              :contacts-integration-enabled="contactsIntegrationEnabled"
            />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showForm = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!form.name.trim()" @click="submitForm">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showHistory">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ t('goods.priceHistory') }}</h3></template>
        <div v-if="loadingHistory" class="text-center py-6 text-gray-400"><Icon name="lucide:loader" class="w-5 h-5 animate-spin mx-auto" /></div>
        <div v-else-if="!history.length" class="text-center py-6 text-sm text-gray-400">{{ t('goods.priceHistoryEmpty') }}</div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="(h, idx) in history" :key="idx" class="flex items-center justify-between text-sm py-2">
            <div>
              <div class="font-medium">{{ h.supplierName || t('goods.noSupplier') }}</div>
              <div class="text-xs text-gray-400">{{ new Date(h.receivedAt).toLocaleDateString() }}</div>
            </div>
            <span class="tabular-nums">{{ (h.costPriceCents / 100).toFixed(2) }} × {{ h.quantity }}</span>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
