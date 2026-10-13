<script lang="ts" setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { atModalUi } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useOrderStages } from '@/composables/useOrderStages';
import { BRAND_COLORS } from '@/utils/color';
import { ORDER_STATUS_KEYS, defaultStatusLabel, parseStatusLabels, statusLabelFor } from '@/utils/orderStatusLabels';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import {
  menuCreateOrderStage, menuUpdateOrderStage, menuDeleteOrderStage, menuApplyStagePreset, menuUpdateOrderRules,
  type OrderStage,
} from '@/api/menu/order/extra';

// The tenant's own order statuses inside the seven fixed lifecycle groups, plus
// the opt-in "price stage" switch. A tenant with no stages simply keeps the
// seven standard statuses.
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const nsSlug = computed(() => route.params.namespace as string);
const { stages, load: loadStages } = useOrderStages();

const loading = ref(true);
const labels = ref<Record<string, string | undefined>>({});
const rules = ref<Record<string, any>>({});
const prefixDraft = ref('');
const modalOpen = ref(false);
const editing = ref<OrderStage | null>(null);
const confirmDeleteId = ref<string | null>(null);
const busy = ref(false);
const palette = BRAND_COLORS.filter(c => c.toLowerCase() !== '#111827'); // never a black accent

const form = reactive({ status: 'NEW', name: '', color: '#2563eb', slaMinutes: 0, isUrgent: false, isOverdue: false, autoTaskTitle: '' });

const PRESETS: Array<{ key: string; icon: string; label: string }> = [
  { key: 'service', icon: 'lucide:wrench', label: 'menu.stagePresetService' },
  { key: 'cafe', icon: 'lucide:coffee', label: 'menu.stagePresetCafe' },
  { key: 'delivery', icon: 'lucide:truck', label: 'menu.stagePresetDelivery' },
  { key: 'retail', icon: 'lucide:shopping-bag', label: 'menu.stagePresetRetail' },
];
const SLA_CHOICES = [
  { v: 0, label: 'menu.slaNone' }, { v: 30, label: '30 ' + 'min' }, { v: 60, label: '1 h' }, { v: 240, label: '4 h' },
  { v: 1440, label: '1 d' }, { v: 4320, label: '3 d' },
];

function token(): string {
  const { current } = useMenuToken();
  const tk = current();
  if (!tk) throw new Error('No menu token');
  return tk;
}

const groupLabel = (g: string) => statusLabelFor(g, labels.value as any, t) || defaultStatusLabel(g, t);
const stagesOf = (g: string) => stages.value.filter(s => s.status === g);
const slaText = (m: number) => (m <= 0 ? '' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);

async function load() {
  loading.value = true;
  try {
    await loadStages(token(), nsSlug.value, true);
    const { menuGetBrandSettings } = await import('@/api/menu/brandsettings/get');
    const brand = await menuGetBrandSettings(token(), nsSlug.value);
    labels.value = parseStatusLabels(brand?.statusLabels);
    try { rules.value = JSON.parse(brand?.orderRules || '{}'); prefixDraft.value = rules.value.numberPrefix || ''; } catch { rules.value = {}; }
  } catch (e) {
    logError('[menu/settings/stages] load failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function fail(e: unknown) {
  logError('[menu/settings/stages] failed', e);
  toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
}

function openNew(group: string) {
  editing.value = null;
  Object.assign(form, { status: group, name: '', color: '#2563eb', slaMinutes: 0, isUrgent: false, isOverdue: false, autoTaskTitle: '' });
  modalOpen.value = true;
}

function openEdit(s: OrderStage) {
  editing.value = s;
  Object.assign(form, { status: s.status, name: s.name, color: s.color || '#2563eb', slaMinutes: s.slaMinutes, isUrgent: s.isUrgent, isOverdue: s.isOverdue, autoTaskTitle: s.autoTaskTitle || '' });
  modalOpen.value = true;
}

async function save() {
  if (!form.name.trim()) return;
  busy.value = true;
  try {
    if (editing.value) {
      await menuUpdateOrderStage(token(), nsSlug.value, { id: editing.value.id, name: form.name.trim(), color: form.color, sortOrder: editing.value.sortOrder, slaMinutes: form.slaMinutes, isUrgent: form.isUrgent, isOverdue: form.isOverdue, autoTaskTitle: form.autoTaskTitle.trim() });
    } else {
      await menuCreateOrderStage(token(), nsSlug.value, { status: form.status, name: form.name.trim(), color: form.color, slaMinutes: form.slaMinutes, isUrgent: form.isUrgent, isOverdue: form.isOverdue, autoTaskTitle: form.autoTaskTitle.trim() });
    }
    modalOpen.value = false;
    await loadStages(token(), nsSlug.value, true);
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function remove(s: OrderStage) {
  busy.value = true;
  try {
    await menuDeleteOrderStage(token(), nsSlug.value, s.id);
    confirmDeleteId.value = null;
    await loadStages(token(), nsSlug.value, true);
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function applyPreset(key: string) {
  if (stages.value.length && !window.confirm(t('menu.stagePresetConfirm'))) return;
  busy.value = true;
  try {
    await menuApplyStagePreset(token(), nsSlug.value, key);
    await loadStages(token(), nsSlug.value, true);
    toast.add({ title: t('menu.stagePresetApplied'), color: 'emerald' });
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function toggleRule(key: string, value: boolean | string) {
  const next = { ...rules.value, [key]: value };
  try {
    await menuUpdateOrderRules(token(), nsSlug.value, next);
    rules.value = next;
  } catch (e) { fail(e); }
}
</script>

<template>
  <div class="space-y-4">
    <div class="at-sechead">
      <div>
        <h3 class="at-h2">{{ t('menu.stagesTitle') }}</h3>
        <p class="at-hint">{{ t('menu.stagesHint') }}</p>
      </div>
    </div>

    <!-- presets -->
    <div class="at-panel !p-4 space-y-2">
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('menu.stagePresets') }}</div>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="p in PRESETS" :key="p.key" type="button" class="pill-filter" :disabled="busy" @click="applyPreset(p.key)">
          <Icon :name="p.icon" class="w-3.5 h-3.5" />{{ t(p.label) }}
        </button>
      </div>
    </div>

    <!-- opt-in rules -->
    <div class="at-switch">
      <UToggle :model-value="!!rules.priceStage" @update:model-value="(v: boolean) => toggleRule('priceStage', v)" />
      <div>
        <div class="text-sm font-semibold">{{ t('menu.ruleItemPriceStage') }}</div>
        <div class="at-hint !mt-0.5">{{ t('menu.ruleItemPriceStageHint') }}</div>
      </div>
    </div>

    <!-- numbering -->
    <div class="at-panel !p-4 space-y-3">
      <div>
        <div class="text-sm font-semibold">{{ t('menu.numberingTitle') }}</div>
        <div class="at-hint !mt-0.5">{{ t('menu.numberingHint') }}</div>
      </div>
      <div class="overflow-x-auto"><div class="at-seg">
        <button type="button" class="at-seg__btn" :class="(rules.numbering || 'daily') === 'daily' ? 'at-seg__btn--on' : ''" @click="toggleRule('numbering', 'daily')">{{ t('menu.numberingDaily') }}</button>
        <button type="button" class="at-seg__btn" :class="rules.numbering === 'continuous' ? 'at-seg__btn--on' : ''" @click="toggleRule('numbering', 'continuous')">{{ t('menu.numberingContinuous') }}</button>
      </div></div>
      <div class="flex items-center gap-2">
        <UInput v-model="prefixDraft" maxlength="5" :placeholder="t('menu.numberPrefixPlaceholder')" class="w-40" />
        <button type="button" class="at-btn at-btn--blue !px-3 !py-1.5" :disabled="prefixDraft === (rules.numberPrefix || '')" @click="toggleRule('numberPrefix', prefixDraft.trim())">{{ t('common.save') }}</button>
        <span class="at-hint">{{ t('menu.numberPreview') }}: <b>{{ (rules.numberPrefix || '') + '105' }}</b></span>
      </div>
    </div>

    <AppSkeleton v-if="loading" variant="panel" :rows="3" />

    <!-- groups -->
    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div v-for="g in ORDER_STATUS_KEYS" :key="g" class="at-panel !p-4 space-y-2.5">
        <div class="flex items-center gap-2">
          <div class="at-h2 flex-1">{{ groupLabel(g) }}</div>
          <button type="button" class="pill-outline !px-3 !py-1 !text-xs" @click="openNew(g)"><Icon name="lucide:plus" class="w-3.5 h-3.5" />{{ t('menu.stageAdd') }}</button>
        </div>
        <p v-if="!stagesOf(g).length" class="text-xs text-slate-400">{{ t('menu.stageGroupDefault') }}</p>
        <div v-for="s in stagesOf(g)" :key="s.id" class="at-row flex items-center gap-3 !py-2">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: s.color || '#94a3b8' }" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold truncate">{{ s.name }}</div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <span v-if="s.slaMinutes" class="at-chip !text-[11px]"><Icon name="lucide:timer" class="w-3 h-3" />{{ slaText(s.slaMinutes) }}</span>
              <span v-if="s.isUrgent" class="at-chip !text-[11px]"><Icon name="lucide:flame" class="w-3 h-3" />{{ t('menu.urgent') }}</span>
              <span v-if="s.autoTaskTitle" class="at-chip !text-[11px]" :title="s.autoTaskTitle"><Icon name="lucide:list-checks" class="w-3 h-3" />{{ t('menu.stageAutoTaskBadge') }}</span>
              <span v-if="s.isOverdue" class="at-chip !text-[11px]"><Icon name="lucide:alarm-clock" class="w-3 h-3" />{{ t('menu.overdue') }}</span>
            </div>
          </div>
          <template v-if="confirmDeleteId === s.id">
            <button type="button" class="at-btn at-btn--danger !px-3 !py-1.5" :disabled="busy" @click="remove(s)">{{ t('common.delete') }}</button>
            <button type="button" class="at-btn !px-3 !py-1.5" @click="confirmDeleteId = null">{{ t('common.cancel') }}</button>
          </template>
          <template v-else>
            <button type="button" class="cp-icon" :aria-label="t('common.edit')" @click="openEdit(s)"><Icon name="lucide:pencil" class="w-4 h-4" /></button>
            <button type="button" class="cp-icon" :aria-label="t('common.delete')" @click="confirmDeleteId = s.id"><Icon name="lucide:trash-2" class="w-4 h-4" /></button>
          </template>
        </div>
      </div>
    </div>

    <UModal v-model="modalOpen" class="at-modal" :ui="atModalUi">
      <div class="p-6 sm:p-8 space-y-5">
        <div class="flex items-center gap-3">
          <h2 class="flex-1 text-lg font-semibold">{{ editing ? t('menu.stageEdit') : t('menu.stageNew') }} · {{ groupLabel(form.status) }}</h2>
          <button type="button" class="cp-icon" :aria-label="t('common.close')" @click="modalOpen = false"><Icon name="lucide:x" class="w-4 h-4" /></button>
        </div>
        <label class="block space-y-1">
          <span class="text-sm font-medium">{{ t('menu.stageName') }}</span>
          <UInput v-model="form.name" maxlength="120" :placeholder="t('menu.stageNamePlaceholder')" @keyup.enter="save" />
        </label>
        <div class="space-y-1.5">
          <span class="text-sm font-medium">{{ t('menu.stageColor') }}</span>
          <ColorSwatch v-model="form.color" :palette="palette" />
        </div>
        <div class="space-y-1.5">
          <span class="text-sm font-medium">{{ t('menu.stageSla') }}</span>
          <p class="at-hint !mt-0">{{ t('menu.stageSlaHint') }}</p>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="c in SLA_CHOICES" :key="c.v" type="button" class="pill-filter" :class="form.slaMinutes === c.v ? 'pill-filter--active' : ''" @click="form.slaMinutes = c.v">
              {{ c.v === 0 ? t(c.label) : c.label }}
            </button>
          </div>
        </div>
        <div class="at-switch"><UToggle v-model="form.isUrgent" /><div class="text-sm font-semibold">{{ t('menu.stageUrgentFlag') }}</div></div>
        <div class="at-switch"><UToggle v-model="form.isOverdue" /><div class="text-sm font-semibold">{{ t('menu.stageOverdueFlag') }}</div></div>
        <div class="space-y-1.5">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('menu.stageAutoTask') }}</div>
          <UInput v-model="form.autoTaskTitle" maxlength="160" :placeholder="t('menu.stageAutoTaskPlaceholder')" :ui="{ rounded: 'rounded-xl' }" />
          <p class="at-hint">{{ t('menu.stageAutoTaskHint') }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="at-btn" @click="modalOpen = false">{{ t('common.cancel') }}</button>
          <button type="button" class="at-btn at-btn--primary" :disabled="busy || !form.name.trim()" @click="save">{{ t('common.save') }}</button>
        </div>
      </div>
    </UModal>
  </div>
</template>
