<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { BUSINESS_TYPES } from '@/config/businessTypes';
import { STATUS_PRESET_TYPES, orderStatusPreset } from '@/config/orderStatusPresets';
import { MAX_STATUS_LABEL_LENGTH, ORDER_STATUS_KEYS, defaultStatusLabel, parseStatusLabels, serializeStatusLabels } from '@/utils/orderStatusLabels';

const { t, locale } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// One text field per stage; empty means "use the default name". Only the labels
// change -- the order lifecycle behind them is fixed.
const form = reactive<Record<string, string>>({});
const saved = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);

const presetOptions = computed(() =>
  STATUS_PRESET_TYPES.map((type) => ({
    value: type,
    icon: BUSINESS_TYPES.find((b) => b.value === type)?.icon || 'lucide:shapes',
    label: t(BUSINESS_TYPES.find((b) => b.value === type)?.titleKey || '') || type,
  }))
);

function fill(labels: Record<string, string | undefined>) {
  for (const key of ORDER_STATUS_KEYS) form[key] = labels[key] || '';
}

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function load() {
  loading.value = true;
  try {
    const { menuGetBrandSettings } = await import('@/api/menu/brandsettings/get');
    const brand = await menuGetBrandSettings(await getToken(), nsSlug.value);
    const labels = parseStatusLabels(brand?.statusLabels);
    fill(labels);
    saved.value = { ...labels };
  } catch (e) {
    logError('[menu/settings/statuses] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load statuses', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const isDirty = computed(() => serializeStatusLabels(form) !== serializeStatusLabels(saved.value));

// Fills the fields from a business type's names; nothing is saved until "Save".
function applyPreset(type: string) {
  fill(orderStatusPreset(type, locale.value));
}

function resetAll() {
  fill({});
}

async function save() {
  if (!isDirty.value || saving.value) return;
  saving.value = true;
  try {
    const { menuUpdateOrderStatusLabels } = await import('@/api/menu/brandsettings/updateStatusLabels');
    const res = await menuUpdateOrderStatusLabels(await getToken(), nsSlug.value, serializeStatusLabels(form));
    const labels = parseStatusLabels(res.statusLabels);
    fill(labels);
    saved.value = { ...labels };
    useToast().add({ title: t('menu.statusLabelsSaved') || 'Status names saved', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/statuses] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save status names', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-2xl space-y-5">
    <p class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('menu.statusLabelsIntro') || 'Call the order stages whatever suits your business. Only the names change; the order flow stays the same.' }}
    </p>

    <div>
      <div class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('menu.statusLabelsPresets') || 'Fill in for a business type' }}
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="opt in presetOptions"
          :key="opt.value"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300"
          @click="applyPreset(opt.value)"
        >
          <UIcon :name="opt.icon" class="h-3.5 w-3.5" />
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="space-y-3 rounded-xl ring-1 ring-gray-200 p-4 dark:ring-gray-800" :class="{ 'opacity-60': loading }">
      <UFormGroup v-for="key in ORDER_STATUS_KEYS" :key="key" :label="defaultStatusLabel(key, t)">
        <UInput
          v-model="form[key]"
          :maxlength="MAX_STATUS_LABEL_LENGTH"
          :placeholder="defaultStatusLabel(key, t)"
          :disabled="loading"
          :ui="{ rounded: 'rounded-xl' }"
        />
      </UFormGroup>
    </div>

    <div class="flex items-center justify-between gap-3">
      <UButton color="gray" variant="ghost" :disabled="saving || loading" @click="resetAll">
        {{ t('menu.statusLabelsReset') || 'Reset to defaults' }}
      </UButton>
      <UButton color="primary" class="rounded-xl" :loading="saving" :disabled="!isDirty || saving || loading" @click="save">
        {{ t('app.save') || 'Save' }}
      </UButton>
    </div>
  </div>
</template>
