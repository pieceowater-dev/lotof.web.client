<script lang="ts" setup>
// "Branch → warehouse": which Goods warehouse the orders taken at this branch draw their parts from.
// The link lives on the Goods warehouse (one warehouse per branch); this field edits it from the Menu side
// and saves immediately. Hidden when Goods is not installed / not reachable for this user.
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsWarehouse } from '@/api/goods/warehouse';

const props = defineProps<{ branchId: string; nsSlug: string }>();
const { t } = useI18n();
const { getToken } = useGoodsAuth();

const available = ref(false);
const warehouses = ref<GoodsWarehouse[]>([]);
const selected = ref('');
const saving = ref(false);

async function load() {
  try {
    const token = await getToken(props.nsSlug);
    const { goodsListWarehouses } = await import('@/api/goods/warehouse');
    warehouses.value = (await goodsListWarehouses(token, props.nsSlug)).warehouses.filter((w) => w.isActive);
    selected.value = warehouses.value.find((w) => w.menuBranchId === props.branchId)?.id || '';
    available.value = true;
  } catch {
    available.value = false; // no Goods for this namespace/user: the field simply does not exist
  }
}
watch(() => props.branchId, load, { immediate: true });

const options = computed(() => [{ label: t('menu.branchWarehouseDefault'), value: '' }, ...warehouses.value.map((w) => ({ label: w.name, value: w.id }))]);

async function onChange(id: string) {
  const prev = selected.value;
  selected.value = id;
  saving.value = true;
  try {
    const token = await getToken(props.nsSlug);
    const { goodsUpdateWarehouse } = await import('@/api/goods/warehouse');
    const link = async (w: GoodsWarehouse, menuBranchId: string | null) =>
      goodsUpdateWarehouse(token, props.nsSlug, { id: w.id, name: w.name, address: w.address, type: w.type, isActive: w.isActive, menuBranchId });
    const old = warehouses.value.find((w) => w.menuBranchId === props.branchId);
    if (old && old.id !== id) { await link(old, null); old.menuBranchId = null; }
    const next = warehouses.value.find((w) => w.id === id);
    if (next) {
      // the server moves the branch off any other warehouse; mirror that locally
      for (const w of warehouses.value) if (w.menuBranchId === props.branchId) w.menuBranchId = null;
      await link(next, props.branchId);
      next.menuBranchId = props.branchId;
    }
  } catch (e) {
    selected.value = prev;
    logError('[menu/BranchWarehouseField] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UFormGroup v-if="available" :label="t('menu.branchWarehouse')" :hint="t('menu.branchWarehouseHint')">
    <USelectMenu :model-value="selected" :options="options" value-attribute="value" option-attribute="label" :loading="saving" :popper="{ strategy: 'fixed' }" @update:model-value="onChange" />
  </UFormGroup>
</template>
