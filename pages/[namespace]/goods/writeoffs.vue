<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import type { GoodsWriteOff, GoodsWriteOffReason } from '@/api/goods/writeoff';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.writeoffs')} — ${titleBySlug(nsSlug.value)}` : t('goods.writeoffs'),
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
const writeOffs = ref<GoodsWriteOff[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ writeOffs: wo }, { warehouses: w }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/writeoff')).goodsListWriteOffs(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    writeOffs.value = wo;
    warehouses.value = w;
    goods.value = g;
    units.value = u;
  } catch (e) {
    logError('[goods/writeoffs] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load write-offs', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const rows = computed(() => writeOffs.value.map((wo) => ({ ...wo, warehouseName: warehouses.value.find((w) => w.id === wo.warehouseId)?.name || wo.warehouseId })));
const columns = [
  { key: 'number', label: '#' },
  { key: 'warehouseName', label: t('goods.selectWarehouse') },
  { key: 'reason', label: t('goods.reason') },
  { key: 'createdAt', label: t('common.title') },
];

const REASON_OPTIONS: GoodsWriteOffReason[] = ['DAMAGE', 'EXPIRED', 'LOST', 'OTHER'];

// --- Create ---
const showCreate = ref(false);
const saving = ref(false);
const form = reactive({ warehouseId: '', reason: 'OTHER' as GoodsWriteOffReason });
type DraftItem = { goodId: string; unitId: string; quantity: number };
const draftItems = ref<DraftItem[]>([]);
const itemDraft = reactive<DraftItem>({ goodId: '', unitId: '', quantity: 1 });

function addDraftItem() {
  if (!itemDraft.goodId || !itemDraft.unitId) return;
  draftItems.value.push({ ...itemDraft });
  itemDraft.goodId = ''; itemDraft.unitId = ''; itemDraft.quantity = 1;
}
function removeDraftItem(idx: number) { draftItems.value.splice(idx, 1); }

const isFormValid = computed(() => !!form.warehouseId && draftItems.value.length > 0);

async function submitCreate() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { goodsCreateWriteOff } = await import('@/api/goods/writeoff');
    await goodsCreateWriteOff(token, nsSlug.value, { ...form, items: draftItems.value });
    showCreate.value = false;
    form.warehouseId = ''; form.reason = 'OTHER';
    draftItems.value = [];
    await loadAll();
  } catch (e) {
    logError('[goods/writeoffs] submitCreate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create write-off', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.writeoffs') }}</h1>
      <UButton color="primary" icon="lucide:plus" @click="showCreate = true">{{ t('goods.createWriteOff') }}</UButton>
    </div>

    <GoodsNavTabs />

    <div class="min-h-[280px] max-h-[65vh] overflow-hidden">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:trash-2" />
    </div>

    <UModal v-model="showCreate" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.createWriteOff') }}</h3></template>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('goods.selectWarehouse')" required>
              <USelectMenu v-model="form.warehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
            <UFormGroup :label="t('goods.reason')" required>
              <USelectMenu v-model="form.reason" :options="REASON_OPTIONS" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('goods.items') }}</div>

            <div class="grid grid-cols-12 gap-2">
              <div class="col-span-6">
                <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.good') }}</label>
                <USelectMenu v-model="itemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" :popper="{ strategy: 'fixed' }" />
              </div>
              <div class="col-span-3">
                <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.unit') }}</label>
                <USelectMenu v-model="itemDraft.unitId" :options="units.map((u) => ({ label: u.symbol, value: u.id }))" value-attribute="value" option-attribute="label" size="sm" :popper="{ strategy: 'fixed' }" />
              </div>
              <div class="col-span-3">
                <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.quantity') }}</label>
                <UInput v-model.number="itemDraft.quantity" type="number" min="0" size="sm" />
              </div>
            </div>
            <UButton size="sm" color="gray" variant="soft" icon="lucide:plus" :disabled="!itemDraft.goodId || !itemDraft.unitId" @click="addDraftItem">{{ t('common.add') }}</UButton>

            <div v-if="draftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 pt-2">
              <div v-for="(item, idx) in draftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span class="font-medium text-gray-900 dark:text-white">{{ goodName(item.goodId) }} — {{ item.quantity }}</span>
                <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removeDraftItem(idx)" />
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showCreate = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!isFormValid || saving" @click="submitCreate">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
