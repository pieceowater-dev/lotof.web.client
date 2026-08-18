<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsSupplier } from '@/api/goods/supplier';
import type { GoodsGood } from '@/api/goods/good';
import type { SupplierPriceHistoryEntry } from '@/api/goods/goodsreceipt';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.suppliers')} — ${titleBySlug(nsSlug.value)}` : t('goods.suppliers'),
}));

async function getToken(): Promise<string> {
  const { ensure, current } = useGoodsToken();
  const existing = current();
  if (existing) return existing;
  const { token: hubToken } = useAuth();
  if (!hubToken.value) throw new Error('No hub token');
  const token = await ensure(nsSlug.value, hubToken.value);
  if (!token) throw new Error('No goods token');
  return token;
}

const loading = ref(true);
const suppliers = ref<GoodsSupplier[]>([]);
const goods = ref<GoodsGood[]>([]);

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ suppliers: s }, { goods: g }] = await Promise.all([
      (await import('@/api/goods/supplier')).goodsListSuppliers(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
    ]);
    suppliers.value = s;
    goods.value = g;
  } catch (e) {
    logError('[goods/suppliers] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load suppliers', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const columns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'phone', label: 'Phone' },
  { key: 'contactPerson', label: t('goods.contactPerson') },
  { key: 'actions', label: '' },
];

// --- Add ---
const showAdd = ref(false);
const saving = ref(false);
const form = reactive({ name: '', phone: '', contactPerson: '', identity: '', contactsClientId: '' });

async function submitAdd() {
  if (!form.name.trim()) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { goodsCreateSupplier } = await import('@/api/goods/supplier');
    await goodsCreateSupplier(token, nsSlug.value, {
      name: form.name.trim(), phone: form.phone.trim(), contactPerson: form.contactPerson.trim(),
      identity: form.identity.trim(), contactsClientId: form.contactsClientId.trim() || undefined,
    });
    showAdd.value = false;
    form.name = ''; form.phone = ''; form.contactPerson = ''; form.identity = ''; form.contactsClientId = '';
    await loadAll();
  } catch (e) {
    logError('[goods/suppliers] submitAdd failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add supplier', color: 'red' });
  } finally {
    saving.value = false;
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
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.suppliers') }}</h1>
      <div class="flex gap-2">
        <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
        <UButton color="primary" icon="lucide:plus" @click="showAdd = true">{{ t('goods.addSupplier') }}</UButton>
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
      <div v-for="s in suppliers" :key="s.id" class="px-4 py-3 space-y-1" @mouseenter="resolveContactsSummary(s)">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-gray-900 dark:text-white">{{ s.name }}</div>
            <div class="text-xs text-gray-400">{{ s.phone }} · {{ s.contactPerson }}</div>
          </div>
          <UBadge v-if="s.contactsClientId && contactsSummaryCache[s.id]" color="primary" variant="soft">
            {{ t('goods.linkToContacts') }}: {{ contactsSummaryCache[s.id]?.name || s.contactsClientId }}
          </UBadge>
        </div>
      </div>
      <div v-if="!loading && !suppliers.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
      <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('goods.priceHistory') }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <UButton v-for="g in goods" :key="g.id" size="2xs" color="gray" variant="soft" @click="openHistory(g.id)">{{ g.name }}</UButton>
      </div>
    </div>

    <UModal v-model="showAdd">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.addSupplier') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required><UInput v-model="form.name" @keyup.enter="submitAdd" /></UFormGroup>
          <UFormGroup label="Phone"><UInput v-model="form.phone" @keyup.enter="submitAdd" /></UFormGroup>
          <UFormGroup :label="t('goods.contactPerson')"><UInput v-model="form.contactPerson" @keyup.enter="submitAdd" /></UFormGroup>
          <UFormGroup :label="t('goods.identity')"><UInput v-model="form.identity" @keyup.enter="submitAdd" /></UFormGroup>
          <UFormGroup :label="t('goods.linkToContacts')"><UInput v-model="form.contactsClientId" placeholder="Contacts client ID" @keyup.enter="submitAdd" /></UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAdd = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!form.name.trim()" @click="submitAdd">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showHistory">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.priceHistory') }}</h3></template>
        <div v-if="loadingHistory" class="text-center py-6 text-gray-400"><Icon name="lucide:loader" class="w-5 h-5 animate-spin mx-auto" /></div>
        <div v-else-if="!history.length" class="text-center py-6 text-sm text-gray-400">—</div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="(h, idx) in history" :key="idx" class="flex items-center justify-between text-sm py-2">
            <span class="font-medium">{{ h.supplierName }}</span>
            <span>{{ (h.costPriceCents / 100).toFixed(2) }} × {{ h.quantity }}</span>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
