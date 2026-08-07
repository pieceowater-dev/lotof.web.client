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
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideProduct') }}</label>
            <USelectMenu v-model="form.app" :options="appOptions" value-attribute="value" option-attribute="label" @update:model-value="onAppChange" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideParentCategory') }}</label>
            <USelectMenu
              :model-value="form.categoryId ?? ''"
              :options="categoryOptions"
              value-attribute="value"
              option-attribute="label"
              @update:model-value="(v: string) => (form.categoryId = v || null)"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideSortOrder') }}</label>
            <UInput v-model.number="form.sortOrder" type="number" />
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
          <UButton size="xs" variant="ghost" :icon="preview ? 'lucide:pencil' : 'lucide:eye'" @click="preview = !preview">
            {{ preview ? t('admin.guideEdit') : t('admin.guidePreview') }}
          </UButton>
        </div>

        <div v-show="activeLocale === 'Ru'" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (Русский)</label>
            <UInput v-model="form.titleRu" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (Русский)</label>
            <UTextarea v-model="form.excerptRu" :rows="2" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (Русский, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentRu || '')"
            />
            <UTextarea v-else v-model="form.contentRu" :rows="16" class="font-mono text-sm" />
          </div>
        </div>

        <div v-show="activeLocale === 'Kk'" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (Қазақша)</label>
            <UInput v-model="form.titleKk" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (Қазақша)</label>
            <UTextarea v-model="form.excerptKk" :rows="2" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (Қазақша, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentKk || '')"
            />
            <UTextarea v-else v-model="form.contentKk" :rows="16" class="font-mono text-sm" />
          </div>
        </div>

        <div v-show="activeLocale === 'En'" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideTitle') }} (English)</label>
            <UInput v-model="form.titleEn" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideExcerpt') }} (English)</label>
            <UTextarea v-model="form.excerptEn" :rows="2" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('admin.guideContent') }} (English, Markdown)</label>
            <div
              v-if="preview"
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-200 p-4 dark:border-slate-800 min-h-[16rem]"
              v-html="renderMarkdownSafe(form.contentEn || '')"
            />
            <UTextarea v-else v-model="form.contentEn" :rows="16" class="font-mono text-sm" />
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
import type { GuideApp, GuideArticleStatus, GuideCategory } from '@/api/guide/public';
import type { GuideArticleInput } from '@/api/guide/admin';
import { consoleListGuideCategories } from '@/api/guide/admin';

const props = defineProps<{
  mode: 'create' | 'edit';
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
const activeLocale = ref<'Ru' | 'Kk' | 'En'>('Ru');

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

async function handleSave(status: GuideArticleStatus) {
  if (!form.slug.trim() || !form.titleRu.trim()) {
    toast.add({ title: t('admin.guideArticleValidation'), color: 'red' });
    return;
  }

  saving.value = true;
  try {
    await props.onSave({ ...form, status, categoryId: form.categoryId || null });
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!props.onDelete) return;
  if (!(await confirm({ message: t('admin.guideConfirmDeleteArticle') }))) return;
  await props.onDelete();
}
</script>
