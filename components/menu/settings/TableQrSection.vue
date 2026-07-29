<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuShareLink } from '@/api/menu/sharelink/list';
import { buildTableTag, formatTableNumber, parseTableTag } from '@/utils/tableTag';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// QR code generator: a guest scans this from their spot to open the menu
// already scoped to that branch + QR number ("?b=slug&table=001" — see
// pages/to/[namespace]/menu/index.vue's isTableOrder handling). There's no
// dedicated backend resource for a QR code — a saved one IS a ShareLink
// (same CRUD ShareLinkSection.vue already uses), just one whose sourceTag
// follows the "table:NNN" convention (utils/tableTag.ts, internal name only
// — nothing user-facing on this screen calls it a "table"). This section
// filters that same list down to the QR-tagged rows; ShareLinkSection
// filters them back out.
const branches = ref<MenuBranch[]>([]);
const allLinks = ref<MenuShareLink[]>([]);
const qrLinks = computed(() => allLinks.value.filter((l) => parseTableTag(l.sourceTag)));
const loading = ref(false);
const creating = ref(false);

const genBranchId = ref('');
// UInput coerces a type="number" v-model to an actual JS number once the
// user types a digit (Nuxt UI's looseToNumber) — only the initial empty
// state is a string. Every use below has to handle both, not call
// String.prototype methods (e.g. .trim()) directly on it.
const genQrNumber = ref<number | string>('');

const branchOptions = computed(() => branches.value.map((b) => ({ label: b.name, value: b.id })));

function isQrNumberSet(n: number | string): boolean {
  return n !== '' && n !== null && n !== undefined;
}
function isQrNumberValid(n: number | string): boolean {
  if (!isQrNumberSet(n)) return false;
  const num = Number(n);
  return Number.isFinite(num) && num >= 0 && num <= 999;
}

function buildLink(branchId: string, qrNumber: number | string): string {
  if (!process.client || !branchId || !isQrNumberValid(qrNumber)) return '';
  const branch = branches.value.find((b) => b.id === branchId);
  if (!branch) return '';
  const params = new URLSearchParams();
  params.set('b', branch.slug || branch.id);
  params.set('table', formatTableNumber(qrNumber));
  return `${window.location.origin}/to/${nsSlug.value}/menu?${params.toString()}`;
}

function branchName(id?: string | null): string {
  if (!id) return t('menu.noBranch') || '—';
  return branches.value.find((b) => b.id === id)?.name || id;
}

// --- QR rendering — client-side only, no external QR API involved, so the
// code's URL never leaves the browser just to draw it. Never shown before a
// QR is actually saved — only a small thumbnail per saved row (below) plus
// an offscreen render at download time.
async function renderQr(canvas: HTMLCanvasElement, url: string) {
  const QRCode = (await import('qrcode')).default;
  await QRCode.toCanvas(canvas, url, { width: 200, margin: 2 });
}

// Thumbnails for the saved-QR table, keyed by ShareLink id. Generated lazily
// (data URL, not a live canvas per row) once both the link list and the
// branch list it depends on (for the branch slug) have loaded.
const qrThumbnails = ref<Record<string, string>>({});
async function ensureThumbnails() {
  if (!process.client) return;
  const QRCode = (await import('qrcode')).default;
  for (const link of qrLinks.value) {
    if (qrThumbnails.value[link.id]) continue;
    const url = buildLink(link.branchId || '', parseTableTag(link.sourceTag) || '');
    if (!url) continue;
    try {
      // Rendered at 2x the display size (112 for a 56px thumbnail) so it
      // stays crisp instead of visibly upscaled/blurry on retina displays.
      qrThumbnails.value[link.id] = await QRCode.toDataURL(url, { width: 112, margin: 1 });
    } catch (e) {
      logError('[menu/settings/table-qr] ensureThumbnails failed', e);
    }
  }
}
watch([branches, qrLinks], ensureThumbnails, { immediate: true });

async function downloadQr(url: string, qrNumber: number | string) {
  if (!url) return;
  try {
    const canvas = document.createElement('canvas');
    await renderQr(canvas, url);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${formatTableNumber(qrNumber)}.png`;
    a.click();
  } catch (e) {
    logError('[menu/settings/table-qr] downloadQr failed', e);
    useToast().add({ title: t('menu.qrDownloadFailed') || 'Failed to generate QR image', color: 'red' });
  }
}

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
    if (!genBranchId.value && branches.value.length === 1) genBranchId.value = branches.value[0].id;
  } catch (e) {
    logError('[menu/settings/table-qr] loadBranches failed', e);
  }
}

async function loadLinks() {
  loading.value = true;
  try {
    const menuToken = await getToken();
    const { menuShareLinksList } = await import('@/api/menu/sharelink/list');
    allLinks.value = await menuShareLinksList(menuToken, nsSlug.value);
  } catch (e) {
    logError('[menu/settings/table-qr] loadLinks failed', e);
  } finally {
    loading.value = false;
  }
}

const isFormValid = computed(() => !!genBranchId.value && isQrNumberValid(genQrNumber.value));

async function createQr() {
  if (!isFormValid.value || creating.value) return;
  creating.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateShareLink } = await import('@/api/menu/sharelink/create');
    const padded = formatTableNumber(genQrNumber.value);
    const created = await menuCreateShareLink(menuToken, nsSlug.value, {
      branchId: genBranchId.value,
      label: `QR ${padded}`,
      sourceTag: buildTableTag(padded),
    });
    allLinks.value = [created, ...allLinks.value];
    genQrNumber.value = '';
    useToast().add({ title: t('menu.qrCreated') || 'QR code created', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/table-qr] createQr failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create QR code', color: 'red' });
  } finally {
    creating.value = false;
  }
}

// --- Inline "click the QR number to edit it" ---
// There's no UpdateShareLink RPC (sharelink.proto only has Create/Delete/
// List) — an edit is implemented as create-the-new-one-first, then
// delete-the-old-one, so the row is never briefly missing. If the delete
// leg fails, the old row survives alongside the new one and the user is
// told to remove the leftover manually rather than silently losing data.
const editingId = ref<string | null>(null);
const editQrNumberValue = ref<number | string>('');
const savingEdit = ref(false);

function startEdit(link: MenuShareLink) {
  editingId.value = link.id;
  editQrNumberValue.value = parseTableTag(link.sourceTag) || '';
}
function cancelEdit() {
  editingId.value = null;
}

async function confirmEdit(link: MenuShareLink) {
  if (!isQrNumberValid(editQrNumberValue.value) || savingEdit.value) return;
  const padded = formatTableNumber(editQrNumberValue.value);
  if (padded === parseTableTag(link.sourceTag)) {
    cancelEdit();
    return;
  }
  savingEdit.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateShareLink } = await import('@/api/menu/sharelink/create');
    const created = await menuCreateShareLink(menuToken, nsSlug.value, {
      branchId: link.branchId || undefined,
      label: `QR ${padded}`,
      sourceTag: buildTableTag(padded),
    });
    allLinks.value = [created, ...allLinks.value];
    editingId.value = null;
    try {
      const { menuDeleteShareLink } = await import('@/api/menu/sharelink/delete');
      await menuDeleteShareLink(menuToken, nsSlug.value, link.id);
      allLinks.value = allLinks.value.filter((l) => l.id !== link.id);
      delete qrThumbnails.value[link.id];
    } catch (e) {
      logError('[menu/settings/table-qr] confirmEdit cleanup-old failed', e);
      useToast().add({ title: t('menu.qrEditCleanupFailed') || 'Updated, but the old QR code could not be removed — delete it manually.', color: 'amber' });
    }
  } catch (e) {
    logError('[menu/settings/table-qr] confirmEdit failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update QR code', color: 'red' });
  } finally {
    savingEdit.value = false;
  }
}

async function removeLink(link: MenuShareLink) {
  if (!(await confirm({ message: t('menu.confirmDeleteShareLink') || 'Delete this QR code?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteShareLink } = await import('@/api/menu/sharelink/delete');
    await menuDeleteShareLink(menuToken, nsSlug.value, link.id);
    allLinks.value = allLinks.value.filter((l) => l.id !== link.id);
    delete qrThumbnails.value[link.id];
  } catch (e) {
    logError('[menu/settings/table-qr] removeLink failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete QR code', color: 'red' });
  }
}

onMounted(() => {
  loadBranches();
  loadLinks();
});
</script>

<template>
  <div class="max-w-2xl space-y-4">
    <!-- Generator -->
    <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
      <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon name="lucide:qr-code" class="h-3.5 w-3.5" />
        {{ t('menu.qrGeneratorTitle') || 'New QR code' }}
      </div>
      <p class="text-xs text-gray-400">
        {{ t('menu.qrGeneratorDesc') || 'Choose a branch and a QR number — print the code so guests can scan it and order.' }}
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UFormGroup :label="t('menu.branch') || 'Branch'" required>
          <USelectMenu v-model="genBranchId" :options="branchOptions" value-attribute="value" option-attribute="label" size="lg" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>
        <UFormGroup :label="t('menu.qrNumberLabel') || 'QR number'" required>
          <UInput v-model="genQrNumber" type="number" min="0" max="999" size="lg" placeholder="001" />
        </UFormGroup>
      </div>

      <div class="flex justify-end">
        <UButton color="primary" icon="lucide:plus" :loading="creating" :disabled="!isFormValid || creating" @click="createQr">
          {{ t('menu.createQr') || 'Create' }}
        </UButton>
      </div>
    </div>

    <!-- Saved QR codes -->
    <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 px-5 pt-5 pb-2">
        <Icon name="lucide:list" class="h-3.5 w-3.5" />
        {{ t('menu.savedQrCodes') || 'Saved QR codes' }}
      </div>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
      </div>
      <div v-else-if="!qrLinks.length" class="text-sm text-gray-400 px-5 pb-5">
        {{ t('menu.noSavedQrCodes') || 'No QR codes saved yet — create one above.' }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th class="px-5 py-2.5 font-medium w-20">QR</th>
              <th class="px-5 py-2.5 font-medium">{{ t('menu.branch') || 'Branch' }}</th>
              <th class="px-5 py-2.5 font-medium">{{ t('menu.qrNumberLabel') || 'QR number' }}</th>
              <th class="px-5 py-2.5 font-medium text-right">{{ t('app.actions') || 'Actions' }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="link in qrLinks" :key="link.id">
              <td class="px-5 py-3">
                <div class="w-14 h-14 flex-shrink-0 rounded-md border border-gray-200 dark:border-gray-700 bg-white overflow-hidden flex items-center justify-center">
                  <img
                    v-if="qrThumbnails[link.id]"
                    :src="qrThumbnails[link.id]"
                    :alt="`QR ${parseTableTag(link.sourceTag)}`"
                    width="56"
                    height="56"
                    class="w-full h-full object-contain"
                  >
                  <Icon v-else name="lucide:loader-2" class="w-4 h-4 text-gray-300 animate-spin" />
                </div>
              </td>
              <td class="px-5 py-3 min-w-0">
                <span class="truncate block">{{ branchName(link.branchId) }}</span>
              </td>
              <td class="px-5 py-3">
                <div v-if="editingId === link.id" class="flex items-center gap-1.5">
                  <UInput
                    v-model="editQrNumberValue"
                    type="number"
                    min="0"
                    max="999"
                    size="xs"
                    class="w-20"
                    autofocus
                    @keyup.enter="confirmEdit(link)"
                    @keyup.escape="cancelEdit"
                  />
                  <UButton size="2xs" color="primary" variant="soft" icon="lucide:check" :loading="savingEdit" @click="confirmEdit(link)" />
                  <UButton size="2xs" color="gray" variant="ghost" icon="lucide:x" :disabled="savingEdit" @click="cancelEdit" />
                </div>
                <button
                  v-else
                  type="button"
                  class="font-mono font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1"
                  @click="startEdit(link)"
                >
                  {{ parseTableTag(link.sourceTag) }}
                  <Icon name="lucide:pencil" class="w-3 h-3 opacity-40" />
                </button>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1.5">
                  <UButton
                    size="2xs"
                    color="gray"
                    variant="soft"
                    icon="lucide:download"
                    @click="downloadQr(buildLink(link.branchId || '', parseTableTag(link.sourceTag) || ''), parseTableTag(link.sourceTag) || '')"
                  >
                    {{ t('menu.downloadQr') || 'Download' }}
                  </UButton>
                  <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" @click="removeLink(link)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
