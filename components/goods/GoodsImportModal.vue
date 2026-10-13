<script lang="ts" setup>
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { parseGoodsSheet, TEMPLATE_HEADERS, type ImportedGood } from '@/utils/goodsImport';
import { generateSku } from '@/utils/slug';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsUnit } from '@/api/goods/unit';
import type { GoodsCategory } from '@/api/goods/category';
import type { GoodsWarehouse } from '@/api/goods/warehouse';

// Imports goods (and, optionally, opening stock) from an Excel/CSV sheet.
// Columns are recognised by their header names; the preview shows what will
// be created and which lines will be skipped, before anything is written.
const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
  units: GoodsUnit[];
  categories: GoodsCategory[];
  warehouses: GoodsWarehouse[];
  getToken: () => Promise<string>;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'done'): void }>();
const { t } = useI18n();

const rows = ref<ImportedGood[]>([]);
const columns = ref<Record<string, string>>({});
const fileName = ref('');
const warehouseId = ref('');
const phase = ref<'pick' | 'importing' | 'done'>('pick');
const progress = reactive({ done: 0, total: 0 });
const result = reactive({ created: 0, failed: [] as { line: number; name: string; reason: string }[], stocked: 0 });
const dragOver = ref(false);

const valid = computed(() => rows.value.filter((r) => !r.error));
const invalid = computed(() => rows.value.filter((r) => r.error));
const withStock = computed(() => valid.value.filter((r) => r.quantity > 0));

watch(() => props.modelValue, (open) => {
  if (!open) return;
  rows.value = []; columns.value = {}; fileName.value = ''; phase.value = 'pick';
  warehouseId.value = props.warehouses[0]?.id || '';
  result.created = 0; result.failed = []; result.stocked = 0;
});

const errorText = (e?: string) => (e ? t(`goods.importError_${e}`) : '');

async function readFile(file: File) {
  fileName.value = file.name;
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed = parseGoodsSheet(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }));
    rows.value = parsed.goods;
    columns.value = parsed.columns;
  } catch (e) {
    logError('[goods/import] read failed', e);
    useToast().add({ title: t('goods.importReadFailed'), color: 'red' });
  }
}
function onPick(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (f) readFile(f);
}
function onDrop(ev: DragEvent) {
  dragOver.value = false;
  const f = ev.dataTransfer?.files?.[0];
  if (f) readFile(f);
}

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ['Хлеб белый', 'BREAD-1', 'Выпечка', 'шт', 30, 50, 20]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'goods');
  XLSX.writeFile(wb, 'goods-template.xlsx');
}

function unitIdFor(name: string): string {
  const n = name.trim().toLowerCase();
  const hit = n ? props.units.find((u) => u.symbol.toLowerCase() === n || u.name.toLowerCase() === n) : undefined;
  return hit?.id || props.units.find((u) => u.symbol === 'шт')?.id || props.units[0]?.id || '';
}

async function runImport() {
  if (!valid.value.length || phase.value === 'importing') return;
  phase.value = 'importing';
  progress.done = 0; progress.total = valid.value.length;
  result.created = 0; result.failed = []; result.stocked = 0;
  const token = await props.getToken();
  const { goodsCreateGood } = await import('@/api/goods/good');
  const { goodsCreateCategory } = await import('@/api/goods/category');
  const categoryIds = new Map(props.categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const opening: { goodId: string; unitId: string; quantity: number; costPriceCents: number }[] = [];

  for (const row of valid.value) {
    try {
      let categoryId: string | undefined;
      if (row.category) {
        const key = row.category.toLowerCase();
        if (!categoryIds.has(key)) {
          const created = await goodsCreateCategory(token, props.nsSlug, { name: row.category, sortOrder: categoryIds.size });
          categoryIds.set(key, created.id);
        }
        categoryId = categoryIds.get(key);
      }
      const unitId = unitIdFor(row.unit);
      const good = await goodsCreateGood(token, props.nsSlug, {
        categoryId, name: row.name, sku: row.sku || generateSku(row.name), baseUnitId: unitId,
        costPriceCents: row.costPriceCents, salePriceCents: row.salePriceCents, trackStock: true, isWeighted: false, imageUrl: '',
      });
      result.created++;
      if (row.quantity > 0) opening.push({ goodId: good.id, unitId, quantity: row.quantity, costPriceCents: row.costPriceCents });
    } catch (e) {
      logError('[goods/import] row failed', e);
      result.failed.push({ line: row.line, name: row.name, reason: getErrorMessage(e, t) || '' });
    }
    progress.done++;
  }

  if (opening.length && warehouseId.value) {
    try {
      const { goodsCreateReceipt } = await import('@/api/goods/goodsreceipt');
      await goodsCreateReceipt(token, props.nsSlug, { warehouseId: warehouseId.value, items: opening });
      result.stocked = opening.length;
    } catch (e) {
      logError('[goods/import] opening stock failed', e);
      useToast().add({ title: getErrorMessage(e, t) || t('goods.importStockFailed'), color: 'red' });
    }
  }
  phase.value = 'done';
  emit('done');
}
</script>

<template>
  <UModal class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-3xl' }" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <UCard :ui="atCardUiFit">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-lg font-semibold">{{ t('goods.importTitle') }}</h3>
          <button type="button" class="at-btn !px-3 !py-1.5" @click="downloadTemplate"><Icon name="lucide:download" class="w-4 h-4" />{{ t('goods.importTemplate') }}</button>
        </div>
      </template>

      <div v-if="phase === 'pick'" class="space-y-4">
        <label
          class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors"
          :class="dragOver ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30' : 'border-gray-200 dark:border-gray-800 hover:border-primary-300'"
          @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop"
        >
          <Icon name="lucide:file-spreadsheet" class="w-8 h-8 text-gray-400" />
          <span class="text-sm font-medium">{{ fileName || t('goods.importPick') }}</span>
          <span class="at-hint !mt-0">{{ t('goods.importHint') }}</span>
          <input type="file" class="hidden" accept=".xlsx,.xls,.csv" @change="onPick" />
        </label>

        <template v-if="rows.length">
          <div class="flex flex-wrap gap-2">
            <span class="at-chip"><Icon name="lucide:check" class="w-3.5 h-3.5" />{{ t('goods.importWillCreate', { n: valid.length }) }}</span>
            <span v-if="invalid.length" class="at-chip !text-rose-600"><Icon name="lucide:alert-triangle" class="w-3.5 h-3.5" />{{ t('goods.importWillSkip', { n: invalid.length }) }}</span>
            <span v-if="withStock.length" class="at-chip"><Icon name="lucide:package" class="w-3.5 h-3.5" />{{ t('goods.importWithStock', { n: withStock.length }) }}</span>
          </div>

          <div v-if="withStock.length && warehouses.length > 1" class="space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('goods.importStockWarehouse') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="w in warehouses" :key="w.id" type="button" class="pill-filter" :class="warehouseId === w.id ? 'pill-filter--active' : ''" @click="warehouseId = w.id">{{ w.name }}</button>
            </div>
          </div>

          <div class="max-h-64 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <div v-for="r in rows.slice(0, 100)" :key="r.line" class="flex items-center justify-between gap-3 px-3 py-2" :class="r.error ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''">
              <div class="min-w-0">
                <div class="font-medium truncate">{{ r.name || '—' }} <span class="text-xs text-gray-400">#{{ r.line }}</span></div>
                <div class="text-xs text-gray-400 truncate">{{ [r.sku, r.category, r.unit].filter(Boolean).join(' · ') }}</div>
              </div>
              <div class="text-right text-xs flex-shrink-0">
                <div v-if="r.error" class="text-rose-600 font-medium">{{ errorText(r.error) }}</div>
                <template v-else>
                  <div class="tabular-nums">{{ (r.salePriceCents / 100).toFixed(2) }}</div>
                  <div v-if="r.quantity" class="text-gray-400 tabular-nums">× {{ r.quantity }}</div>
                </template>
              </div>
            </div>
          </div>
          <p v-if="rows.length > 100" class="at-hint">{{ t('goods.importMore', { n: rows.length - 100 }) }}</p>
        </template>
      </div>

      <div v-else-if="phase === 'importing'" class="py-8 text-center space-y-3">
        <Icon name="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin text-primary-500" />
        <div class="text-sm font-medium tabular-nums">{{ progress.done }} / {{ progress.total }}</div>
      </div>

      <div v-else class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <span class="at-chip"><Icon name="lucide:check" class="w-3.5 h-3.5" />{{ t('goods.importCreated', { n: result.created }) }}</span>
          <span v-if="result.stocked" class="at-chip"><Icon name="lucide:package" class="w-3.5 h-3.5" />{{ t('goods.importStocked', { n: result.stocked }) }}</span>
          <span v-if="result.failed.length" class="at-chip !text-rose-600"><Icon name="lucide:alert-triangle" class="w-3.5 h-3.5" />{{ t('goods.importFailed', { n: result.failed.length }) }}</span>
        </div>
        <div v-if="result.failed.length" class="max-h-48 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
          <div v-for="f in result.failed" :key="f.line" class="px-3 py-2"><span class="font-medium">{{ f.name }}</span> <span class="text-xs text-gray-400">#{{ f.line }}</span><div class="text-xs text-rose-600">{{ f.reason }}</div></div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="at-btn" @click="emit('update:modelValue', false)">{{ phase === 'done' ? t('common.close') : t('common.cancel') }}</button>
          <button v-if="phase === 'pick'" type="button" class="at-btn at-btn--primary" :disabled="!valid.length" @click="runImport">{{ t('goods.importRun', { n: valid.length }) }}</button>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
