<template>
  <Teleport to="body">
    <div
      v-if="bundleModal.open"
      class="fixed inset-0 z-[70] overflow-y-auto p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ bundleModal.mode === 'create' ? (t('admin.newBundle') || 'Новая сборка') : (t('admin.editBundleTitle') || 'Изменить сборку') }}
          </h3>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.bundleName') || 'Название сборки' }} *</label>
            <input
              v-model="bundleForm.name"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="HoReCa Full"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planDescription') || 'Описание' }}</label>
            <textarea
              v-model="bundleForm.description"
              rows="2"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.currency') || 'Валюта' }} *</label>
              <select
                v-model="bundleForm.currency"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.symbol }} {{ c.code }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.trialDays') || 'Дней триала' }}</label>
              <input
                v-model.number="bundleForm.trialDays"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.monthlyPrice') || 'Цена/мес' }} *</label>
              <input
                v-model.number="bundleForm.monthlyPrice"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.yearlyPrice') || 'Цена/год' }} *</label>
              <input
                v-model.number="bundleForm.yearlyPrice"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          <p class="text-[11px] text-slate-400">{{ t('admin.bundleCreatesBothIntervals') || 'Создаются месячная и годовая сборки одновременно.' }}</p>

          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div class="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.bundleIncludes') || 'Приложения в сборке' }} *</div>
            <div class="space-y-2.5">
              <div v-for="app in apps" :key="app.appCode" class="flex items-center gap-3">
                <label class="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    :checked="!!bundleForm.tiers[app.appCode]"
                    @change="onToggleApp(app.appCode, ($event.target as HTMLInputElement).checked)"
                  />
                  <Icon :name="app.icon" class="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <span class="truncate text-sm text-slate-700 dark:text-slate-200">{{ app.title }}</span>
                </label>
                <select
                  v-model="bundleForm.tiers[app.appCode]"
                  :disabled="!bundleForm.tiers[app.appCode] && !(tierOptionsByApp[app.appCode] || []).length"
                  class="w-40 flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">{{ t('admin.bundlePickTier') || '— тариф —' }}</option>
                  <option v-for="tier in (tierOptionsByApp[app.appCode] || [])" :key="tier" :value="tier">{{ tier }}</option>
                </select>
              </div>
            </div>
            <p v-if="!apps.length" class="text-[11px] text-slate-400">{{ t('admin.bundleNoPlans') || 'Сначала создайте тарифы приложений.' }}</p>
          </div>

          <div v-if="bundleModal.mode === 'create'">
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.planCode') || 'Код' }}</label>
            <input
              :value="generatedCodePrefix"
              type="text"
              disabled
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            />
          </div>

          <p v-if="bundleModal.error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {{ bundleModal.error }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="$emit('close')"
          >
            {{ t('app.cancel') || 'Отмена' }}
          </button>
          <button
            :disabled="bundleModal.saving"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            @click="$emit('submit')"
          >
            <Icon v-if="bundleModal.saving" name="svg-spinners:ring-resize" class="h-3.5 w-3.5" />
            {{ t('app.save') || 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { CURRENCIES } from '@/utils/currency';

const bundleModal = defineModel<{ open: boolean; mode: 'create' | 'edit'; id: string | null; saving: boolean; error: string }>('bundleModal', { required: true });
const bundleForm = defineModel<{
  name: string;
  description: string;
  currency: string;
  trialDays: number;
  monthlyPrice: number;
  yearlyPrice: number;
  tiers: Record<string, string>;
}>('bundleForm', { required: true });

const props = defineProps<{
  apps: Array<{ appCode: string; title: string; icon: string }>;
  tierOptionsByApp: Record<string, string[]>;
  generatedCodePrefix: string;
}>();

defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const { t } = useI18n();

function onToggleApp(appCode: string, checked: boolean) {
  if (!checked) {
    bundleForm.value.tiers[appCode] = '';
    return;
  }
  // Default the tier to the first available option so a freshly-ticked app is
  // never left with an empty selection the submit handler would reject.
  const opts = props.tierOptionsByApp[appCode] || [];
  bundleForm.value.tiers[appCode] = opts[0] || '';
}
</script>
