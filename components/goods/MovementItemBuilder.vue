<script lang="ts" setup>
// Shared "add line items to a document" builder -- used to be hand-copied
// into purchases/receiving/transfers/writeoffs (and settings.vue's
// price-list-items/recipe-items) with only the extra per-line fields
// differing. Good/unit/quantity are always present; anything else (cost
// price, batch number, expiry date, ...) is declared via `extraFields`.
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';
import GoodPicker from '@/components/goods/GoodPicker.vue';

export type MovementExtraField = {
  key: string;
  labelKey: string;
  type: 'number' | 'text' | 'date';
  step?: string;
  min?: string | number;
  colSpan?: number; // out of 12, default spreads evenly
};

export type MovementDraftItem = { goodId: string; unitId: string; quantity: number; [key: string]: string | number };

const props = withDefaults(
  defineProps<{
    modelValue: MovementDraftItem[];
    goods: GoodsGood[];
    units: GoodsUnit[];
    showUnit?: boolean;
    extraFields?: MovementExtraField[];
  }>(),
  { showUnit: true, extraFields: () => [] },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: MovementDraftItem[]): void }>();

const { t } = useI18n();

function blankDraft(): MovementDraftItem {
  const draft: MovementDraftItem = { goodId: '', unitId: '', quantity: 1 };
  for (const f of props.extraFields) draft[f.key] = f.type === 'number' ? 0 : '';
  return draft;
}

const itemDraft = reactive<MovementDraftItem>(blankDraft());

const goodCol = computed(() => (props.showUnit ? 6 : 8));
const qtyCol = computed(() => (props.showUnit ? 2 : 2));

function goodName(goodId: string): string {
  return props.goods.find((g) => g.id === goodId)?.name || goodId;
}

function addDraftItem() {
  if (!itemDraft.goodId || (props.showUnit && !itemDraft.unitId)) return;
  const item: MovementDraftItem = { ...itemDraft };
  if (!props.showUnit) item.unitId = props.goods.find((g) => g.id === itemDraft.goodId)?.baseUnitId || '';
  emit('update:modelValue', [...props.modelValue, item]);
  Object.assign(itemDraft, blankDraft());
}

function removeDraftItem(idx: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== idx));
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
    <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('goods.items') }}</div>

    <div class="grid grid-cols-12 gap-2">
      <div :style="{ gridColumn: `span ${goodCol}` }">
        <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.good') }}</label>
        <GoodPicker v-model="itemDraft.goodId" :goods="goods" />
      </div>
      <div v-if="showUnit" class="col-span-2">
        <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.unit') }}</label>
        <USelectMenu
          v-model="itemDraft.unitId"
          :options="units.map((u) => ({ label: u.symbol, value: u.id }))"
          value-attribute="value"
          option-attribute="label"
          size="sm"
          :popper="{ strategy: 'fixed' }"
        />
      </div>
      <div :style="{ gridColumn: `span ${qtyCol}` }">
        <label class="text-xs text-gray-400 mb-1 block">{{ t('goods.quantity') }}</label>
        <UInput v-model.number="itemDraft.quantity" type="number" min="0" size="sm" />
      </div>
      <div v-for="f in extraFields" :key="f.key" :style="{ gridColumn: `span ${f.colSpan || 12 - goodCol - (showUnit ? 2 : 0) - qtyCol}` }">
        <label class="text-xs text-gray-400 mb-1 block">{{ t(f.labelKey) }}</label>
        <UInput v-model="itemDraft[f.key]" :type="f.type" :min="f.min" :step="f.step" size="sm" />
      </div>
    </div>
    <UButton size="sm" color="gray" variant="soft" icon="lucide:plus" :disabled="!itemDraft.goodId || (showUnit && !itemDraft.unitId)" @click="addDraftItem">
      {{ t('common.add') }}
    </UButton>

    <div v-if="modelValue.length" class="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 pt-2">
      <div v-for="(item, idx) in modelValue" :key="idx" class="flex items-center justify-between text-sm py-1.5">
        <div>
          <div class="font-medium text-gray-900 dark:text-white">{{ goodName(item.goodId) }}</div>
          <div class="text-xs text-gray-400">
            <slot name="item-summary" :item="item">{{ item.quantity }}</slot>
          </div>
        </div>
        <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removeDraftItem(idx)" />
      </div>
    </div>
  </div>
</template>
