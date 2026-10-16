<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { pagesApi, type PagesSite, type GlobalBlock } from '@/api/pages/ops';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { slugifyText } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';

const props = defineProps<{ site: PagesSite; nsSlug: string }>();

const { t } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const blocks = ref<GlobalBlock[]>([]);
const loading = ref(true);

async function load() {
  try {
    blocks.value = await pagesApi.globalBlocks(props.nsSlug, props.site.id);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const open = ref(false);
const saving = ref(false);
const error = ref('');
const slugTouched = ref(false);
const form = reactive({ name: '', slug: '' });

function openCreate() {
  Object.assign(form, { name: '', slug: '' });
  slugTouched.value = false; error.value = ''; open.value = true;
}
const editorPath = (b: GlobalBlock) => `/${props.nsSlug}/pages/${props.site.id}/blocks/${b.id}`;
function openEdit(b: GlobalBlock) { navigateTo(editorPath(b)); }
watch(() => form.name, (v) => { if (!slugTouched.value) form.slug = slugifyText(v); });

// A new block is created empty and opened straight in the editor.
async function save() {
  error.value = '';
  if (!form.name.trim()) { error.value = t('pages.blocks.needName'); return; }
  saving.value = true;
  try {
    const created = await pagesApi.createGlobalBlock(props.nsSlug, props.site.id, { name: form.name.trim(), slug: form.slug.trim() || undefined, markdown: '' });
    open.value = false;
    await navigateTo(editorPath(created));
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    error.value = msg.includes('already exists') ? t('pages.blocks.slugTaken') : (msg || getErrorMessage(e, t) || t('common.errorRetry'));
  } finally {
    saving.value = false;
  }
}

async function remove(b: GlobalBlock) {
  if (b.usedBy > 0) { toast.add({ title: t('pages.blocks.inUse'), color: 'amber' }); return; }
  const ok = await confirm({
    title: t('pages.blocks.deleteTitle', { name: b.name }), message: t('pages.blocks.deleteText'),
    confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.deleteGlobalBlock(props.nsSlug, b.id);
    await load();
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  }
}

const preview = (b: GlobalBlock) => b.markdown.replace(/[#*>:`_[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="max-w-2xl">
        <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('pages.blocks.intro') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.blocks.howTo') }}</p>
      </div>
      <button type="button" class="at-btn at-btn--primary" @click="openCreate"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.blocks.new') }}</button>
    </div>

    <div v-if="loading" class="py-4 text-sm text-gray-500">…</div>
    <div v-else-if="!blocks.length" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.blocks.empty') }}</div>
    <div v-else class="flex flex-col gap-2">
      <div v-for="b in blocks" :key="b.id" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:blocks" class="h-5 w-5" /></span>
        <button type="button" class="min-w-0 flex-1 text-left" @click="openEdit(b)">
          <div class="truncate font-semibold text-gray-900 dark:text-white">{{ b.name }} <code class="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-normal text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ b.slug }}</code></div>
          <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ preview(b) }}</div>
        </button>
        <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ b.usedBy ? t('pages.blocks.usedBy', { n: b.usedBy }) : t('pages.blocks.unused') }}</span>
        <div class="flex flex-shrink-0 items-center gap-1.5">
          <button type="button" class="at-btn !px-2.5" :title="t('common.edit')" :aria-label="t('common.edit')" @click="openEdit(b)"><Icon name="lucide:pencil" class="h-4 w-4" /></button>
          <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :title="t('common.delete')" :aria-label="t('common.delete')" @click="remove(b)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
        </div>
      </div>
    </div>

    <UModal v-model="open" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-2xl' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ t('pages.blocks.new') }}</h3></template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('pages.blocks.name')" required><UInput v-model="form.name" autofocus /></UFormGroup>
          <UFormGroup :label="t('pages.blocks.slug')" :help="t('pages.blocks.slugHint')">
            <UInput v-model="form.slug" @update:model-value="slugTouched = true" />
          </UFormGroup>
          <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button type="button" class="at-btn" @click="open = false">{{ t('common.cancel') }}</button>
            <button type="button" class="at-btn at-btn--primary" :disabled="saving" @click="save">
              <UIcon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('common.save') }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
