<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { CURRENCIES } from '@/utils/currency';
import type { GoodsWarehouseType } from '@/api/goods/warehouse';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const emit = defineEmits<{ (e: 'completed'): void }>();

const step = ref<1 | 2 | 3>(1);

async function getToken(): Promise<string> {
  const { current } = useGoodsToken();
  const goodsToken = current();
  if (!goodsToken) throw new Error('No goods token');
  return goodsToken;
}

const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

// --- Step 1: first warehouse + currency (required) ---
const warehouseForm = reactive({
  name: '',
  address: '',
  type: 'BOTH' as GoodsWarehouseType,
  currencyCode: 'KZT',
});
const savingWarehouse = ref(false);
const isWarehouseValid = computed(() => warehouseForm.name.trim().length > 0 && warehouseForm.address.trim().length > 0);
const createdWarehouseId = ref<string | null>(null);

async function saveWarehouseAndContinue() {
  if (!isWarehouseValid.value) return;
  savingWarehouse.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateWarehouse } = await import('@/api/goods/warehouse');
    const created = await goodsCreateWarehouse(goodsToken, nsSlug.value, {
      name: warehouseForm.name.trim(),
      address: warehouseForm.address.trim(),
      type: warehouseForm.type,
    });
    createdWarehouseId.value = created.id;

    const { goodsGetSettings, goodsUpdateSettings } = await import('@/api/goods/settings');
    const current = await goodsGetSettings(goodsToken, nsSlug.value);
    await goodsUpdateSettings(goodsToken, nsSlug.value, {
      ...current,
      currency: warehouseForm.currencyCode,
      defaultWarehouseId: created.id,
    });

    step.value = 2;
  } catch (e) {
    logError('[goods onboarding] saveWarehouseAndContinue failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create warehouse', color: 'red' });
  } finally {
    savingWarehouse.value = false;
  }
}

// --- Step 2: units (optional, one-click seed) ---
const seededUnits = ref<GoodsUnit[]>([]);
const seedingUnits = ref(false);

async function seedUnitsAndContinue() {
  seedingUnits.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsSeedDefaultUnits } = await import('@/api/goods/unit');
    seededUnits.value = await goodsSeedDefaultUnits(goodsToken, nsSlug.value);
    step.value = 3;
  } catch (e) {
    logError('[goods onboarding] seedUnitsAndContinue failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to set up units', color: 'red' });
  } finally {
    seedingUnits.value = false;
  }
}

async function loadExistingUnitsAndContinue() {
  try {
    const goodsToken = await getToken();
    const { goodsListUnits } = await import('@/api/goods/unit');
    const { units } = await goodsListUnits(goodsToken, nsSlug.value);
    seededUnits.value = units;
  } catch {}
  step.value = 3;
}

// --- Step 3: first good (optional) ---
const goodForm = reactive({ name: '', sku: '', salePriceCents: 0 });
const addingGood = ref(false);
const addedGoods = ref<{ name: string }[]>([]);
const isGoodValid = computed(() => goodForm.name.trim().length > 0 && seededUnits.value.length > 0);

async function addGood() {
  if (!isGoodValid.value) return;
  addingGood.value = true;
  try {
    const goodsToken = await getToken();
    const baseUnit = seededUnits.value[0];
    const { goodsCreateGood } = await import('@/api/goods/good');
    const created = await goodsCreateGood(goodsToken, nsSlug.value, {
      name: goodForm.name.trim(),
      sku: goodForm.sku.trim() || goodForm.name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 32),
      baseUnitId: baseUnit.id,
      costPriceCents: 0,
      salePriceCents: Math.round(goodForm.salePriceCents * 100),
      trackStock: true,
      isWeighted: false,
      imageUrl: '',
    });
    addedGoods.value.push({ name: created.name });
    goodForm.name = '';
    goodForm.sku = '';
    goodForm.salePriceCents = 0;
  } catch (e) {
    logError('[goods onboarding] addGood failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add good', color: 'red' });
  } finally {
    addingGood.value = false;
  }
}

function finish() {
  emit('completed');
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
    <div class="max-w-lg mx-auto px-4 py-10">
      <div class="text-center mb-6">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.onboardingTitle') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('goods.onboardingSubtitle') }}</p>
      </div>

      <div class="flex items-center justify-center gap-2 mb-6">
        <span class="flex items-center gap-1.5 text-xs font-medium" :class="step >= 1 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" :class="step >= 1 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'">1</span>
          {{ t('goods.onboardingStepWarehouse') }}
        </span>
        <span class="w-8 h-0.5" :class="step >= 2 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'" />
        <span class="flex items-center gap-1.5 text-xs font-medium" :class="step >= 2 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" :class="step >= 2 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'">2</span>
          {{ t('goods.onboardingStepUnits') }}
        </span>
        <span class="w-8 h-0.5" :class="step >= 3 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'" />
        <span class="flex items-center gap-1.5 text-xs font-medium" :class="step >= 3 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" :class="step >= 3 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'">3</span>
          {{ t('goods.onboardingStepGoods') }}
        </span>
      </div>

      <!-- Step 1: First warehouse -->
      <div v-if="step === 1" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.onboardingWarehouseHint') }}</p>

        <UFormGroup :label="t('goods.warehouseName')" required>
          <UInput v-model="warehouseForm.name" size="lg" :placeholder="t('goods.onboardingWarehouseNamePlaceholder')" @keyup.enter="saveWarehouseAndContinue" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseAddress')" required>
          <UInput v-model="warehouseForm.address" size="lg" @keyup.enter="saveWarehouseAndContinue" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseType')">
          <USelectMenu
            v-model="warehouseForm.type"
            :options="[
              { label: t('goods.warehouseTypeBoth'), value: 'BOTH' },
              { label: t('goods.warehouseTypeShop'), value: 'SHOP' },
              { label: t('goods.warehouseTypeStorage'), value: 'STORAGE' },
            ]"
            value-attribute="value"
            option-attribute="label"
            size="lg"
            :popper="{ strategy: 'fixed' }"
          />
        </UFormGroup>
        <UFormGroup :label="t('goods.currency')">
          <USelectMenu v-model="warehouseForm.currencyCode" :options="currencyOptions" value-attribute="value" option-attribute="label" size="lg" class="max-w-[180px]" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>

        <div class="flex justify-end pt-1">
          <UButton color="primary" :loading="savingWarehouse" :disabled="!isWarehouseValid || savingWarehouse" @click="saveWarehouseAndContinue">
            {{ t('app.continue') }}
          </UButton>
        </div>
      </div>

      <!-- Step 2: Units (optional) -->
      <div v-else-if="step === 2" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.onboardingUnitsHint') }}</p>

        <div v-if="seededUnits.length" class="flex flex-wrap gap-1.5">
          <UBadge v-for="u in seededUnits" :key="u.id" color="gray" variant="soft">{{ u.name }} ({{ u.symbol }})</UBadge>
        </div>

        <div class="flex justify-between pt-1">
          <UButton color="gray" variant="ghost" :disabled="seedingUnits" @click="loadExistingUnitsAndContinue">
            {{ t('goods.onboardingSkip') }}
          </UButton>
          <UButton color="primary" icon="lucide:sparkles" :loading="seedingUnits" :disabled="seedingUnits" @click="seedUnitsAndContinue">
            {{ t('goods.onboardingSeedUnits') }}
          </UButton>
        </div>
      </div>

      <!-- Step 3: First good (optional) -->
      <div v-else class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.onboardingGoodsHint') }}</p>

        <div v-if="addedGoods.length" class="space-y-1.5">
          <div v-for="(g, idx) in addedGoods" :key="idx" class="flex items-center gap-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
            <Icon name="lucide:check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span class="font-medium text-gray-900 dark:text-white">{{ g.name }}</span>
          </div>
        </div>

        <div v-if="seededUnits.length" class="space-y-3">
          <UFormGroup :label="t('goods.goodName')">
            <UInput v-model="goodForm.name" size="lg" :placeholder="t('goods.onboardingGoodNamePlaceholder')" @keyup.enter="addGood" />
          </UFormGroup>
          <UFormGroup :label="t('goods.goodSku')">
            <UInput v-model="goodForm.sku" size="lg" placeholder="SKU-001" @keyup.enter="addGood" />
          </UFormGroup>
          <UFormGroup :label="t('goods.salePrice')">
            <UInput v-model.number="goodForm.salePriceCents" type="number" min="0" step="0.01" size="lg" @keyup.enter="addGood" />
          </UFormGroup>
          <UButton color="gray" variant="soft" icon="lucide:plus" :loading="addingGood" :disabled="!isGoodValid || addingGood" @click="addGood">
            {{ t('goods.addGood') }}
          </UButton>
        </div>
        <p v-else class="text-xs text-amber-600 dark:text-amber-400">{{ t('goods.onboardingNoUnitsWarning') }}</p>

        <div class="flex justify-end pt-1">
          <UButton color="primary" @click="finish">
            {{ t('goods.onboardingFinish') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
