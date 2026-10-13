<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { CUSTOM_VAR_NAME_RE, parseCustomDocVariables } from '@/utils/customDocVariables';
import { menuUpdateOrderRules } from '@/api/menu/order/extra';

// The tenant's own document variables: name + text, usable as {{NAME}} in any
// template (company details, bank, terms of warranty …).
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const nsSlug = computed(() => route.params.namespace as string);

type Row = { name: string; value: string };
const rows = ref<Row[]>([]);
const rules = ref<Record<string, any>>({});
const saving = ref(false);
const loaded = ref(false);

function token(): string {
  const tk = useMenuToken().current();
  if (!tk) throw new Error('No menu token');
  return tk;
}

async function load() {
  try {
    const { menuGetBrandSettings } = await import('@/api/menu/brandsettings/get');
    const brand = await menuGetBrandSettings(token(), nsSlug.value);
    try { rules.value = JSON.parse(brand?.orderRules || '{}'); } catch { rules.value = {}; }
    rows.value = Object.entries(parseCustomDocVariables(brand?.orderRules)).map(([name, value]) => ({ name, value }));
  } catch (e) {
    logError('[menu/settings/docVariables] load failed', e);
  } finally {
    loaded.value = true;
  }
}
onMounted(load);

const duplicate = (r: Row) => !!r.name && rows.value.filter((x) => x.name.toLowerCase() === r.name.toLowerCase()).length > 1;
const invalid = (r: Row) => !!r.name && (!CUSTOM_VAR_NAME_RE.test(r.name) || duplicate(r));
const canSave = computed(() => rows.value.every((r) => !invalid(r)) && !saving.value);

function add() { if (rows.value.length < 30) rows.value.push({ name: '', value: '' }); }
function remove(i: number) { rows.value.splice(i, 1); }

async function save() {
  saving.value = true;
  try {
    const docVariables: Record<string, string> = {};
    for (const r of rows.value) if (r.name.trim()) docVariables[r.name.trim()] = r.value;
    const next = { ...rules.value, docVariables };
    await menuUpdateOrderRules(token(), nsSlug.value, next);
    rules.value = next;
    toast.add({ title: t('menu.docVarsSaved'), color: 'emerald' });
  } catch (e) {
    logError('[menu/settings/docVariables] save failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="loaded" class="at-panel !p-4 space-y-3">
    <div class="at-sechead">
      <div>
        <h3 class="at-h2">{{ t('menu.docVarsTitle') }}</h3>
        <p class="at-hint">{{ t('menu.docVarsHint') }}</p>
      </div>
      <button type="button" class="at-btn !px-3 !py-1.5" :disabled="rows.length >= 30" @click="add"><Icon name="lucide:plus" class="w-4 h-4" />{{ t('menu.docVarsAdd') }}</button>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="flex flex-wrap items-start gap-2">
      <div class="w-40 flex-shrink-0">
        <UInput v-model="r.name" maxlength="40" :placeholder="t('menu.docVarsName')" :color="invalid(r) ? 'red' : 'white'" :ui="{ rounded: 'rounded-xl' }" />
        <p v-if="invalid(r)" class="text-xs text-rose-600 mt-0.5">{{ t('menu.docVarsNameBad') }}</p>
      </div>
      <UTextarea v-model="r.value" :rows="1" autoresize maxlength="500" class="flex-1 min-w-[12rem]" :placeholder="t('menu.docVarsValue')" />
      <button type="button" class="at-btn !px-2.5 !py-2" :aria-label="t('common.delete')" @click="remove(i)"><Icon name="lucide:trash-2" class="w-4 h-4" /></button>
    </div>
    <p v-if="!rows.length" class="at-hint">{{ t('menu.docVarsEmpty') }}</p>
    <div class="flex justify-end">
      <button type="button" class="at-btn at-btn--primary" :disabled="!canSave" @click="save">{{ t('common.save') }}</button>
    </div>
  </div>
</template>
