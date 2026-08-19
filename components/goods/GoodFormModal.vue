<script lang="ts" setup>
// Unified create/edit-good form -- replaces three divergent copies that used
// to live in index.vue, catalog.vue and OnboardingWizard.vue, each with a
// different field subset. SKU auto-fill (transliteration) and cents
// conversion live here once instead of being reimplemented per call site.
import type { GoodsGood, CreateGoodInput, UpdateGoodInput } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';
import type { GoodsCategory } from '@/api/goods/category';
import { generateSku } from '@/utils/slug';
import GoodsImageUpload from '@/components/goods/ImageUpload.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    good?: GoodsGood | null;
    units: GoodsUnit[];
    categories?: GoodsCategory[];
    saving?: boolean;
    nsSlug: string;
  }>(),
  { good: null, categories: () => [], saving: false },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: CreateGoodInput | UpdateGoodInput): void;
}>();

const { t } = useI18n();

const form = reactive({ name: '', sku: '', salePriceCents: 0, unitId: '', categoryId: '', isActive: true, imageUrl: '' });

function defaultUnitId(): string {
  return props.units.find((u) => u.symbol === 'шт')?.id || props.units[0]?.id || '';
}

// Re-seed the form whenever the modal opens, from `good` when editing.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.good) {
      form.name = props.good.name;
      form.sku = props.good.sku;
      form.salePriceCents = props.good.salePriceCents / 100;
      form.unitId = props.good.baseUnitId;
      form.categoryId = props.good.categoryId || '';
      form.isActive = props.good.isActive;
      form.imageUrl = props.good.imageUrl || '';
    } else {
      form.name = '';
      form.sku = '';
      form.salePriceCents = 0;
      form.unitId = defaultUnitId();
      form.categoryId = '';
      form.isActive = true;
      form.imageUrl = '';
    }
  },
);

const isValid = computed(() => form.name.trim().length > 0 && !!form.unitId);

function submit() {
  if (!isValid.value) return;
  const base = {
    name: form.name.trim(),
    sku: form.sku.trim() || generateSku(form.name),
    baseUnitId: form.unitId,
    categoryId: form.categoryId || undefined,
    salePriceCents: Math.round(form.salePriceCents * 100),
    trackStock: true,
    isWeighted: false,
    imageUrl: form.imageUrl,
  };
  if (props.good) {
    emit('submit', { ...base, id: props.good.id, isActive: form.isActive } satisfies UpdateGoodInput);
  } else {
    emit('submit', { ...base, costPriceCents: 0 } satisfies CreateGoodInput);
  }
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">{{ good ? t('goods.editGood') : t('goods.addGood') }}</h3>
      </template>

      <div class="space-y-3">
        <GoodsImageUpload v-model="form.imageUrl" :ns-slug="nsSlug" />
        <UFormGroup :label="t('goods.goodName')" required>
          <UInput v-model="form.name" size="lg" autofocus @keyup.enter="submit" />
        </UFormGroup>
        <UFormGroup :label="t('goods.goodSku')">
          <UInput v-model="form.sku" size="lg" placeholder="SKU-001" @keyup.enter="submit" />
          <p class="text-xs text-gray-400 mt-1">{{ t('goods.goodSkuHint') }}</p>
        </UFormGroup>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('goods.unit')" required>
            <USelectMenu
              v-model="form.unitId"
              :options="units.map((u) => ({ label: u.symbol, value: u.id }))"
              value-attribute="value"
              option-attribute="label"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
          <UFormGroup v-if="categories.length" :label="t('goods.category')">
            <USelectMenu
              v-model="form.categoryId"
              :options="categories.map((c) => ({ label: c.name, value: c.id }))"
              value-attribute="value"
              option-attribute="label"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
        </div>
        <UFormGroup :label="t('goods.salePrice')">
          <UInput v-model.number="form.salePriceCents" type="number" min="0" step="0.01" size="lg" @keyup.enter="submit" />
        </UFormGroup>
        <UFormGroup v-if="good" :label="t('common.status')">
          <UToggle v-model="form.isActive" />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</UButton>
          <UButton color="primary" :loading="saving" :disabled="!isValid || saving" @click="submit">{{ t('common.save') }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
