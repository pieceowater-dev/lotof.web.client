<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <NuxtLink
          to="/console/guide"
          class="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <Icon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          {{ t('admin.guide') }}
        </NuxtLink>
        <div class="flex items-center gap-2">
          <UButton v-if="mode === 'edit' && onDelete" color="red" variant="ghost" size="sm" @click="handleDelete">
            {{ t('app.delete') }}
          </UButton>
          <UButton variant="soft" size="sm" :loading="saving" @click="handleSave('DRAFT')">
            {{ t('admin.guideSaveDraft') }}
          </UButton>
          <UButton size="sm" :loading="saving" @click="handleSave('PUBLISHED')">
            {{ t('admin.guidePublishArticle') }}
          </UButton>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <UCard>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="guide-product" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideProduct') }}</label>
            <USelectMenu id="guide-product" v-model="form.app" :options="appOptions" value-attribute="value" option-attribute="label" @update:model-value="onAppChange" />
          </div>
          <div>
            <label for="guide-parent-category" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideParentCategory') }}</label>
            <USelectMenu
              id="guide-parent-category"
              :model-value="form.categoryId ?? ''"
              :options="categoryOptions"
              value-attribute="value"
              option-attribute="label"
              @update:model-value="(v: string) => (form.categoryId = v || null)"
            />
          </div>
          <div>
            <label for="guide-sort-order" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideSortOrder') }}</label>
            <UInput id="guide-sort-order" v-model.number="form.sortOrder" type="number" />
          </div>
        </div>
        <div class="mt-4">
          <UCheckbox v-model="form.isFaq" :label="t('admin.guideIsFaq')" />
        </div>
      </UCard>

      <UCard>
        <div class="mb-4 flex gap-1">
          <UButton
            v-for="locale in LOCALES"
            :key="locale.code"
            size="xs"
            :variant="activeLocale === locale.code ? 'solid' : 'soft'"
            :color="activeLocale === locale.code ? 'primary' : 'gray'"
            @click="activeLocale = locale.code"
          >
            {{ locale.label }}
          </UButton>
          <div class="flex-1" />
          <UButton
            size="xs"
            variant="ghost"
            icon="lucide:list-checks"
            :disabled="preview"
            @click="insertChecklistTemplate"
          >
            {{ t('admin.guideInsertChecklist') }}
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            icon="lucide:image-plus"
            :loading="uploadingImage"
            :disabled="preview"
            @click="triggerImagePicker"
          >
            {{ t('admin.guideInsertImage') }}
          </UButton>
          <UButton size="xs" variant="ghost" :icon="preview ? 'lucide:pencil' : 'lucide:eye'" @click="preview = !preview">
            {{ preview ? t('admin.guideEdit') : t('admin.guidePreview') }}
          </UButton>
          <input ref="contentFileInput" type="file" accept="image/*" class="hidden" @change="onContentImagePicked">
        </div>

        <div v-show="activeLocale === 'Ru'" class="space-y-4">
          <div>
            <label for="guide-title-ru" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (Русский)</label>
            <UInput id="guide-title-ru" v-model="form.titleRu" />
          </div>
          <div>
            <label for="guide-excerpt-ru" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (Русский)</label>
            <UTextarea id="guide-excerpt-ru" v-model="form.excerptRu" :rows="2" />
          </div>
          <div>
            <label for="guide-content-ru" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (Русский, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentRu || '')"
            />
            <UTextarea v-else id="guide-content-ru" v-model="form.contentRu" :rows="16" class="font-mono text-sm" />
          </div>
        </div>

        <div v-show="activeLocale === 'Kk'" class="space-y-4">
          <div>
            <label for="guide-title-kk" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (Қазақша)</label>
            <UInput id="guide-title-kk" v-model="form.titleKk" />
          </div>
          <div>
            <label for="guide-excerpt-kk" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (Қазақша)</label>
            <UTextarea id="guide-excerpt-kk" v-model="form.excerptKk" :rows="2" />
          </div>
          <div>
            <label for="guide-content-kk" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (Қазақша, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentKk || '')"
            />
            <UTextarea v-else id="guide-content-kk" v-model="form.contentKk" :rows="16" class="font-mono text-sm" />
          </div>
        </div>

        <div v-show="activeLocale === 'En'" class="space-y-4">
          <div>
            <label for="guide-title-en" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (English)</label>
            <UInput id="guide-title-en" v-model="form.titleEn" />
          </div>
          <div>
            <label for="guide-excerpt-en" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (English)</label>
            <UTextarea id="guide-excerpt-en" v-model="form.excerptEn" :rows="2" />
          </div>
          <div>
            <label for="guide-content-en" class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (English, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentEn || '')"
            />
            <UTextarea v-else id="guide-content-en" v-model="form.contentEn" :rows="16" class="font-mono text-sm" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
import { renderMarkdownSafe } from '@/utils/renderMarkdown';
import { slugFromNames } from '@/utils/slug';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { compressImageForUpload } from '@/utils/imageCompression';
import type { GuideApp, GuideArticleStatus, GuideCategory } from '@/api/guide/public';
import type { GuideArticleInput } from '@/api/guide/admin';
import { consoleListGuideCategories, capitalUploadGuideArticleImage } from '@/api/guide/admin';

const props = defineProps<{
  mode: 'create' | 'edit';
  articleId?: string;
  initialArticle?: Partial<GuideArticleInput>;
  onSave: (input: GuideArticleInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}>();

const { t } = useI18n();
const { token } = useAuth();
const toast = useToast();
const { confirm } = useConfirm();

const saving = ref(false);
const preview = ref(false);
const uploadingImage = ref(false);
const activeLocale = ref<'Ru' | 'Kk' | 'En'>('Ru');
const contentFileInput = ref<HTMLInputElement | null>(null);

const LOCALES: Array<{ code: 'Ru' | 'Kk' | 'En'; label: string }> = [
  { code: 'Ru', label: 'Русский' },
  { code: 'Kk', label: 'Қазақша' },
  { code: 'En', label: 'English' },
];

const appOptions: Array<{ value: GuideApp; label: string }> = [
  { value: 'GLOBAL', label: t('guide.appGlobal') },
  { value: 'LANDING', label: t('guide.appLanding') },
  { value: 'ISSUES', label: t('app.tasks') },
  { value: 'MENU', label: t('app.menu') },
  { value: 'CONTACTS', label: t('app.clients') },
  { value: 'ATRACE', label: t('app.attendance') },
];

const form = reactive<GuideArticleInput>({
  categoryId: props.initialArticle?.categoryId ?? null,
  app: props.initialArticle?.app ?? 'GLOBAL',
  slug: props.initialArticle?.slug ?? '',
  isFaq: props.initialArticle?.isFaq ?? false,
  status: props.initialArticle?.status ?? 'DRAFT',
  sortOrder: props.initialArticle?.sortOrder ?? 0,
  titleRu: props.initialArticle?.titleRu ?? '',
  titleKk: props.initialArticle?.titleKk ?? '',
  titleEn: props.initialArticle?.titleEn ?? '',
  excerptRu: props.initialArticle?.excerptRu ?? '',
  excerptKk: props.initialArticle?.excerptKk ?? '',
  excerptEn: props.initialArticle?.excerptEn ?? '',
  contentRu: props.initialArticle?.contentRu ?? '',
  contentKk: props.initialArticle?.contentKk ?? '',
  contentEn: props.initialArticle?.contentEn ?? '',
});

const categories = ref<GuideCategory[]>([]);
const categoryOptions = computed(() => [
  { value: '', label: t('admin.guideNoCategory') },
  ...categories.value.map((c) => ({ value: c.id, label: c.nameRu || c.slug })),
]);

async function loadCategories() {
  try {
    categories.value = await consoleListGuideCategories(token.value || '', form.app);
  } catch {
    categories.value = [];
  }
}

function onAppChange() {
  form.categoryId = null;
  loadCategories();
}

// Slug is never shown or typed directly -- always derived from the English
// title, falling back to a transliterated Russian title.
watch([() => form.titleEn, () => form.titleRu], ([titleEn, titleRu]) => {
  form.slug = slugFromNames(titleEn || '', titleRu || '');
});

watch(() => props.initialArticle, (next) => {
  if (!next) return;
  Object.assign(form, next);
  loadCategories();
}, { deep: true });

loadCategories();

const CONTENT_FIELD_BY_LOCALE = { Ru: 'contentRu', Kk: 'contentKk', En: 'contentEn' } as const;

function triggerImagePicker() {
  if (!props.articleId) {
    toast.add({ title: t('admin.guideSaveFirstForImages'), color: 'amber' });
    return;
  }
  contentFileInput.value?.click();
}

async function onContentImagePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file || !props.articleId) return;

  uploadingImage.value = true;
  try {
    const compressed = await compressImageForUpload(file, { t });
    const uploaded = await capitalUploadGuideArticleImage(token.value || '', props.articleId, compressed);
    insertImageMarkdown(uploaded.url, file.name);
    toast.add({ title: t('admin.guideImageUploaded'), color: 'green' });
  } catch (e) {
    logError('Failed to upload guide image:', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('admin.guideImageUploadError'), color: 'red' });
  } finally {
    uploadingImage.value = false;
  }
}

// Inserts a markdown snippet at the focused textarea's cursor when that
// textarea belongs to the currently active locale (matched by its stable
// id), otherwise appends to the end of that locale's content -- there's no
// rich-text block model here to attach an "image block"/"checklist block"
// to, just plain markdown text per locale. This is how a heading, a
// paragraph, an inserted image, a checklist and another image all end up
// interleaved in one document: each insertion lands wherever the cursor
// was, same as typing would.
function insertBlockAtCursor(snippet: string) {
  const locale = activeLocale.value;
  const fieldKey = CONTENT_FIELD_BY_LOCALE[locale];
  const textareaId = `guide-content-${locale.toLowerCase()}`;
  const current = form[fieldKey] || '';

  const active = document.activeElement as HTMLTextAreaElement | null;
  if (active && active.tagName === 'TEXTAREA' && active.id === textareaId) {
    const start = active.selectionStart ?? current.length;
    const end = active.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const leadingNewline = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    form[fieldKey] = `${before}${leadingNewline}${snippet}\n${after}`;
    return;
  }

  const leadingNewline = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
  form[fieldKey] = `${current}${leadingNewline}${snippet}\n`;
}

function insertImageMarkdown(url: string, altSource: string) {
  const alt = altSource.replace(/[[\]]/g, '').trim();
  insertBlockAtCursor(`![${alt}](${url})`);
}

function insertChecklistTemplate() {
  insertBlockAtCursor('- [ ] \n- [ ] \n- [ ] ');
}

async function handleSave(status: GuideArticleStatus) {
  if (!form.slug.trim() || !form.titleRu.trim()) {
    toast.add({ title: t('admin.guideArticleValidation'), color: 'red' });
    return;
  }

  saving.value = true;
  try {
    await props.onSave({ ...form, status, categoryId: form.categoryId || null });
  } catch (e) {
    logError('Failed to save guide article:', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('admin.guideSaveError'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!props.onDelete) return;
  if (!(await confirm({ message: t('admin.guideConfirmDeleteArticle') }))) return;
  try {
    await props.onDelete();
  } catch (e) {
    logError('Failed to delete guide article:', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('admin.guideDeleteError'), color: 'red' });
  }
}
</script>
