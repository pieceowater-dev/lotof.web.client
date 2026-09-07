<template>
  <Teleport to="body">
    <div
      v-if="modal.open"
      class="fixed inset-0 z-[70] overflow-y-auto p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.confirmBundleCashPayment') || 'Оплата наличными за сборку' }}
          </h3>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div class="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Icon name="lucide:layers" class="h-5 w-5" />
            </div>
            <div class="text-sm text-emerald-800 dark:text-emerald-300">
              {{ t('admin.bundleCashHint') || 'Подключит все приложения сборки для неймспейса (каждое — отдельной подпиской).' }}
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.namespaceSlug') || 'Слаг неймспейса' }} *</label>
            <input
              v-model.trim="form.namespace"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="ns_ab12cd"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.bundles') || 'Готовая сборка' }} *</label>
            <select
              v-model="form.bundleCode"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>{{ t('admin.bundlePickTier') || '— сборка —' }}</option>
              <option v-for="b in activeBundles" :key="b.id" :value="b.code">
                {{ b.name }} ({{ b.interval === 'YEAR' ? (t('admin.interval.year') || 'год') : (t('admin.interval.month') || 'мес') }}) · {{ (b.amountCents / 100).toLocaleString('ru-KZ') }} {{ b.currency }}
              </option>
            </select>
          </div>

          <p v-if="modal.error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {{ modal.error }}
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
            :disabled="modal.saving"
            class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            @click="$emit('submit')"
          >
            <Icon v-if="modal.saving" name="svg-spinners:ring-resize" class="h-3.5 w-3.5" />
            {{ t('admin.confirmCashPayment') || 'Подтвердить оплату' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import type { Bundle } from '@/api/capital/bundles';

const modal = defineModel<{ open: boolean; saving: boolean; error: string }>('modal', { required: true });
const form = defineModel<{ namespace: string; bundleCode: string }>('form', { required: true });

defineProps<{ activeBundles: Bundle[] }>();
defineEmits<{ (e: 'close'): void; (e: 'submit'): void }>();

const { t } = useI18n();
</script>
