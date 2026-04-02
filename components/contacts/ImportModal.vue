<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import * as XLSX from 'xlsx';
import { contactsImportClients, type ImportRow, type ImportBatchResult, type ImportProgress } from '@/api/contacts/importClients';
import { useContactsToken } from '@/composables/useContactsToken';
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  modelValue: boolean;
  namespace: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();

type Phase = 'upload' | 'importing' | 'done';
type MappingKey = 'name' | 'company' | 'phone' | 'email' | 'whatsapp' | 'telegram' | 'iin';

const file = ref<File | null>(null);
const isDragOver = ref(false);
const headers = ref<string[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const phase = ref<Phase>('upload');
const progress = ref<ImportProgress | null>(null);
const importResult = ref<ImportBatchResult | null>(null);
const importError = ref<string | null>(null);

const mapping = ref<Record<MappingKey, string>>({
  name: '',
  company: '',
  phone: '',
  email: '',
  whatsapp: '',
  telegram: '',
  iin: '',
});

const systemFields = computed<Array<{ key: MappingKey; label: string; required?: boolean }>>(() => [
  { key: 'company', label: t('contacts.importModal.fields.company') || 'Company (for legal entities)' },
  { key: 'name', label: t('contacts.importModal.fields.name') || 'Full Name (for individuals)' },
  { key: 'phone', label: t('contacts.importModal.fields.phone') || 'Phone' },
  { key: 'email', label: t('contacts.importModal.fields.email') || 'Email' },
  { key: 'whatsapp', label: t('contacts.importModal.fields.whatsapp') || 'WhatsApp' },
  { key: 'telegram', label: t('contacts.importModal.fields.telegram') || 'Telegram' },
  { key: 'iin', label: t('contacts.importModal.fields.iin') || 'IIN / BIN' },
]);

const hasFile = computed(() => !!file.value);
const columnOptions = computed<Array<{ label: string; value: string }>>(() => [
  { label: t('contacts.importModal.notSelected') || 'Not selected', value: '' },
  ...headers.value.map((h) => ({ label: h, value: h })),
]);
const isImportDisabled = computed(() => {
  if (!hasFile.value || phase.value !== 'upload') return true;
  return !mapping.value.company && !mapping.value.name;
});
const failedRows = computed(() => importResult.value?.rows.filter((r) => !r.success) ?? []);

function close() {
  emit('update:modelValue', false);
}

function resetState() {
  file.value = null;
  headers.value = [];
  isDragOver.value = false;
  phase.value = 'upload';
  progress.value = null;
  importResult.value = null;
  importError.value = null;
  mapping.value = { name: '', company: '', phone: '', email: '', whatsapp: '', telegram: '', iin: '' };
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) resetState();
  },
);

async function parseFileHeader(f: File) {
  file.value = f;
  headers.value = [];
  mapping.value = { name: '', company: '', phone: '', email: '', whatsapp: '', telegram: '', iin: '' };

  try {
    const buffer = await f.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
    const firstRow = rows[0];
    if (Array.isArray(firstRow)) {
      headers.value = firstRow.map((cell) => String(cell ?? '').trim()).filter(Boolean);
    }
  } catch {
    headers.value = [];
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) parseFileHeader(f);
  input.value = '';
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) parseFileHeader(f);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function onDragLeave() {
  isDragOver.value = false;
}

function triggerFilePicker() {
  fileInputRef.value?.click();
}

async function buildRows(): Promise<ImportRow[]> {
  if (!file.value) return [];

  const buffer = await file.value.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

  const [headerRow, ...dataRows] = rawRows;
  if (!Array.isArray(headerRow)) return [];

  const colIndex: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const key = String(cell ?? '').trim();
    if (key) colIndex[key] = i;
  });

  const mappedCols = new Set(Object.values(mapping.value).filter(Boolean));

  return dataRows
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()))
    .map((row) => {
      const entry: ImportRow = { name: '' };

      for (const field of systemFields.value) {
        const col = mapping.value[field.key];
        if (col && colIndex[col] !== undefined) {
          (entry as unknown as Record<string, string>)[field.key] = String(row[colIndex[col]] ?? '').trim();
        }
      }

      // Import mode is inferred per-row: company -> LEGAL, otherwise INDIVIDUAL.
      entry.client_type = entry.company ? 'LEGAL' : 'INDIVIDUAL';

      const extras: string[] = [];
      headerRow.forEach((colName, i) => {
        const key = String(colName ?? '').trim();
        if (key && !mappedCols.has(key)) {
          const val = String(row[i] ?? '').trim();
          if (val) extras.push(`${key}: ${val}`);
        }
      });
      if (extras.length) entry.extra_info = extras.join('\n');

      return entry;
    });
}

async function handleImport() {
  if (!file.value) return;

  importError.value = null;
  const { ensure } = useContactsToken();
  const token = await ensure(props.namespace);

  if (!token) {
    importError.value = t('contacts.importModal.errors.token') || 'Failed to obtain contacts token';
    return;
  }

  const rows = await buildRows();
  if (!rows.length) {
    importError.value = t('contacts.importModal.errors.noData') || 'No data rows found in file';
    return;
  }

  phase.value = 'importing';
  progress.value = { batchIndex: 0, totalBatches: Math.ceil(rows.length / 500), imported: 0, failed: 0 };

  try {
    importResult.value = await contactsImportClients(token, rows, (p) => {
      progress.value = p;
    });
    phase.value = 'done';
  } catch (e: unknown) {
    importError.value = e instanceof Error ? e.message : String(e);
    phase.value = 'upload';
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @close="close"
  >
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="lucide:file-spreadsheet"
                class="w-5 h-5"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ t('contacts.importModal.title') || 'Import from Excel' }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('contacts.importModal.subtitle') || 'Upload .xlsx and map columns' }}
              </p>
            </div>
          </div>
          <UButton
            icon="lucide:x"
            size="xs"
            color="gray"
            variant="ghost"
            @click="close"
          />
        </div>
      </template>

      <div class="space-y-5">
        <template v-if="phase === 'importing' && progress">
          <div class="flex flex-col items-center gap-4 py-8">
            <UIcon
              name="lucide:loader-circle"
              class="w-10 h-10 text-primary-500 animate-spin"
            />
            <div class="text-center">
              <p class="font-semibold text-gray-800 dark:text-gray-100">
                {{ t('contacts.importModal.importingTitle') || 'Import in progress...' }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('contacts.importModal.importingProgress', {
                  current: progress.batchIndex,
                  total: progress.totalBatches,
                  imported: progress.imported,
                  failed: progress.failed,
                }) || `Batch ${progress.batchIndex} / ${progress.totalBatches}; Success: ${progress.imported}; Failed: ${progress.failed}` }}
              </p>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-primary-500 h-2 rounded-full transition-all"
                :style="{ width: `${Math.round((progress.batchIndex / progress.totalBatches) * 100)}%` }"
              />
            </div>
          </div>
        </template>

        <template v-else-if="phase === 'done' && importResult">
          <div class="flex gap-3">
            <div class="flex-1 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-center">
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ importResult.imported }}
              </p>
              <p class="text-xs text-green-700 dark:text-green-300 mt-0.5">
                {{ t('contacts.importModal.imported') || 'Imported' }}
              </p>
            </div>
            <div
              v-if="importResult.failed > 0"
              class="flex-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-center"
            >
              <p class="text-2xl font-bold text-red-600 dark:text-red-400">
                {{ importResult.failed }}
              </p>
              <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {{ t('contacts.importModal.failed') || 'Failed' }}
              </p>
            </div>
          </div>

          <template v-if="failedRows.length > 0">
            <div>
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {{ t('contacts.importModal.failedRowsTitle') || 'Failed rows' }}
              </h4>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-60 overflow-y-auto">
                <table class="min-w-full text-xs">
                  <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-8">
                        #
                      </th>
                      <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">
                        {{ t('contacts.importModal.name') || 'Name' }}
                      </th>
                      <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">
                        {{ t('contacts.importModal.reason') || 'Reason' }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr
                      v-for="row in failedRows"
                      :key="row.row_index"
                      class="hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
                    >
                      <td class="px-3 py-2 text-gray-400 dark:text-gray-500">
                        {{ row.row_index + 2 }}
                      </td>
                      <td class="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {{ row.name || '-' }}
                      </td>
                      <td class="px-3 py-2 text-red-600 dark:text-red-400">
                        {{ row.error }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </template>

        <template v-else>
          <div
            v-if="importError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm"
          >
            {{ importError }}
          </div>

          <div
            class="relative rounded-xl border-2 border-dashed transition-colors cursor-pointer"
            :class="isDragOver
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'"
            @click="triggerFilePicker"
            @drop.prevent="onDrop"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".xlsx,.xls"
              class="hidden"
              @change="onFileChange"
            >
            <div class="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
              <UIcon
                :name="hasFile ? 'lucide:file-check-2' : 'lucide:upload-cloud'"
                class="w-10 h-10"
                :class="hasFile ? 'text-green-500' : 'text-gray-400'"
              />
              <template v-if="hasFile">
                <p class="font-medium text-gray-800 dark:text-gray-100">
                  {{ file!.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('contacts.importModal.replaceFile') || 'Click to replace file' }}
                </p>
              </template>
              <template v-else>
                <p class="font-medium text-gray-700 dark:text-gray-200">
                  <span class="text-primary-600 dark:text-primary-400">{{ t('contacts.importModal.chooseFile') || 'Choose file' }}</span>
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('contacts.importModal.chooseFileHint') || 'Select or drop .xlsx file here' }}
                </p>
              </template>
            </div>
          </div>

          <template v-if="hasFile && headers.length > 0">
            <div>
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                {{ t('contacts.importModal.columnMapping') || 'Column mapping' }}
              </h4>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table class="min-w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-1/2">
                        {{ t('contacts.importModal.sourceColumn') || 'Source column' }}
                      </th>
                      <th class="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-1/2">
                        {{ t('contacts.importModal.systemField') || 'System field' }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr
                      v-for="field in systemFields"
                      :key="field.key"
                      class="hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
                    >
                      <td class="px-4 py-2.5">
                        <USelectMenu
                          v-model="mapping[field.key]"
                          :options="columnOptions"
                          value-attribute="value"
                          option-attribute="label"
                          size="sm"
                        />
                      </td>
                      <td class="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        {{ field.label }}
                        <span
                          v-if="field.required"
                          class="text-red-500 ml-0.5"
                        >*</span>
                      </td>
                    </tr>
                    <tr class="bg-gray-50/50 dark:bg-gray-800/30">
                      <td
                        class="px-4 py-2.5 text-gray-400 dark:text-gray-500 italic text-xs"
                        colspan="2"
                      >
                        {{ t('contacts.importModal.unmappedHint') || 'Unmapped columns will be saved into client comment as key: value lines' }}
                        {{ t('contacts.importModal.autoModeHint') || ' Rows with Company are imported as legal entities, other rows as individuals.' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <template v-else-if="hasFile && headers.length === 0">
            <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
              {{ t('contacts.importModal.headerReadError') || 'Could not read header row. Make sure the first row contains column names.' }}
            </div>
          </template>
        </template>
      </div>

      <template #footer>
        <div class="flex items-center justify-end">
          <UButton
            v-if="phase === 'done'"
            color="primary"
            variant="soft"
            icon="lucide:check"
            @click="close"
          >
            {{ t('contacts.importModal.done') || 'Done' }}
          </UButton>
          <UButton
            v-else
            color="primary"
            icon="lucide:file-input"
            :disabled="isImportDisabled"
            :loading="phase === 'importing'"
            @click="handleImport"
          >
            {{ t('contacts.importModal.import') || 'Import' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
