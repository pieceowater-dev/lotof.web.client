<script lang="ts" setup>
// Files attached to a warehouse document (invoice scan, act, photo of the goods).
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { toStoredMediaPath } from '@/utils/mediaUrl';
import type { GoodsDocAttachment, GoodsDocType } from '@/api/goods/docextras';

const props = defineProps<{ docType: GoodsDocType; docId: string; nsSlug: string }>();

const { t } = useI18n();
const { getToken } = useGoodsAuth();
const { confirm } = useConfirm();

const files = ref<GoodsDocAttachment[]>([]);
const busy = ref(false);
const input = ref<HTMLInputElement | null>(null);

async function load() {
  try {
    const token = await getToken(props.nsSlug);
    const { goodsListDocAttachments } = await import('@/api/goods/docextras');
    files.value = await goodsListDocAttachments(token, props.nsSlug, props.docType, props.docId);
  } catch (e) {
    logError('[goods/DocAttachments] load failed', e);
  }
}
watch(() => [props.docType, props.docId], load, { immediate: true });

async function onPick(ev: Event) {
  const list = Array.from((ev.target as HTMLInputElement).files || []);
  (ev.target as HTMLInputElement).value = '';
  if (!list.length) return;
  busy.value = true;
  try {
    const token = await getToken(props.nsSlug);
    const { goodsUploadDocument } = await import('@/api/goods/media/upload');
    const { goodsAddDocAttachment } = await import('@/api/goods/docextras');
    for (const file of list) {
      const up = await goodsUploadDocument(token, props.nsSlug, file);
      files.value.push(await goodsAddDocAttachment(token, props.nsSlug, { docType: props.docType, docId: props.docId, name: file.name, url: up.rawUrl, contentType: up.contentType, size: up.size }));
    }
  } catch (e) {
    logError('[goods/DocAttachments] upload failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('goods.attachFailed'), color: 'red' });
  } finally {
    busy.value = false;
  }
}

async function remove(f: GoodsDocAttachment) {
  if (!(await confirm({ message: t('goods.attachDeleteConfirm'), confirmLabel: t('common.delete'), icon: 'lucide:trash-2' }))) return;
  try {
    const token = await getToken(props.nsSlug);
    const { goodsDeleteDocAttachment } = await import('@/api/goods/docextras');
    await goodsDeleteDocAttachment(token, props.nsSlug, f.id);
    files.value = files.value.filter((x) => x.id !== f.id);
  } catch (e) {
    logError('[goods/DocAttachments] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('goods.attachFailed'), color: 'red' });
  }
}

const isImage = (f: GoodsDocAttachment) => f.contentType.startsWith('image/');
const href = (f: GoodsDocAttachment) => toStoredMediaPath('goods', f.url);
const sizeText = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
</script>

<template>
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <div class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ t('goods.attachments') }}</div>
      <button type="button" class="at-btn !px-2.5 !py-1" :disabled="busy" @click="input?.click()">
        <UIcon :name="busy ? 'lucide:loader-2' : 'lucide:paperclip'" class="h-4 w-4" :class="busy ? 'animate-spin' : ''" />{{ t('goods.attachAdd') }}
      </button>
      <input ref="input" type="file" multiple class="hidden" accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx" @change="onPick">
    </div>
    <p v-if="!files.length" class="text-sm text-gray-400">{{ t('goods.attachEmpty') }}</p>
    <ul v-else class="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      <li v-for="f in files" :key="f.id" class="flex items-center gap-3 px-3 py-2 text-sm">
        <a :href="href(f)" target="_blank" rel="noopener" class="flex min-w-0 flex-1 items-center gap-2 hover:text-primary-600">
          <UIcon :name="isImage(f) ? 'lucide:image' : 'lucide:file-text'" class="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span class="truncate">{{ f.name }}</span>
          <span class="flex-shrink-0 text-xs text-gray-400">{{ sizeText(f.size) }}</span>
        </a>
        <button type="button" class="text-gray-400 hover:text-red-500" :aria-label="t('common.delete')" @click="remove(f)"><UIcon name="lucide:trash-2" class="h-4 w-4" /></button>
      </li>
    </ul>
  </div>
</template>
