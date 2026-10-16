<script lang="ts" setup>
import CategoryChips from '@/components/pages/CategoryChips.vue';
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { pagesApi, type PagesSite, type SiteCategory } from '@/api/pages/ops';
import { categoryTree, categoryDescendants } from '@/utils/pagesCategories';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { siteOrigin, slugifyText } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';

const props = defineProps<{ site: PagesSite; nsSlug: string; categories: SiteCategory[] }>();
const emit = defineEmits<{ changed: []; 'show-pages': [string] }>();

const { t } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const rows = computed(() => categoryTree(props.categories));
const origin = computed(() => siteOrigin(props.site.host));

const open = ref(false);
const saving = ref(false);
const error = ref('');
const slugTouched = ref(false);
const form = reactive({ id: '', title: '', slug: '', description: '', parentId: [] as string[], sort: 0 });
const excluded = computed(() => (form.id ? categoryDescendants(props.categories, form.id) : new Set<string>()));

function openCreate(parentId = '') {
  Object.assign(form, { id: '', title: '', slug: '', description: '', parentId: parentId ? [parentId] : [], sort: 0 });
  slugTouched.value = false; error.value = ''; open.value = true;
}
function openEdit(c: SiteCategory) {
  Object.assign(form, { id: c.id, title: c.title, slug: c.slug, description: c.description, parentId: c.parentId ? [c.parentId] : [], sort: c.sort });
  slugTouched.value = true; error.value = ''; open.value = true;
}
watch(() => form.title, (v) => { if (!slugTouched.value && !form.id) form.slug = slugifyText(v); });

async function save() {
  error.value = '';
  if (!form.title.trim()) { error.value = t('pages.categories.needTitle'); return; }
  saving.value = true;
  const input = { title: form.title.trim(), slug: form.slug.trim() || undefined, description: form.description.trim(), parentId: form.parentId[0] || null, sort: Number(form.sort) || 0 };
  try {
    if (form.id) await pagesApi.updateCategory(props.nsSlug, form.id, input);
    else await pagesApi.createCategory(props.nsSlug, props.site.id, input);
    open.value = false;
    emit('changed');
    toast.add({ title: t('pages.categories.saved'), color: 'green' });
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('already exists')) error.value = t('pages.categories.slugTaken');
    else if (msg.includes('lowercase')) error.value = t('pages.categories.slugInvalid');
    else if (msg.includes('inside itself')) error.value = t('pages.categories.cycle');
    else error.value = getErrorMessage(e, t) || t('common.errorRetry');
  } finally {
    saving.value = false;
  }
}

async function remove(c: SiteCategory) {
  const ok = await confirm({
    title: t('pages.categories.deleteTitle', { name: c.title }), message: t('pages.categories.deleteText'),
    confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.deleteCategory(props.nsSlug, c.id);
    emit('changed');
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-300">{{ t('pages.categories.intro') }}</p>
      <button type="button" class="at-btn at-btn--primary" @click="openCreate()"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.categories.new') }}</button>
    </div>

    <div v-if="!rows.length" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.categories.empty') }}</div>
    <div v-else class="flex flex-col gap-2">
      <div v-for="r in rows" :key="r.cat.id" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10"
        :style="r.depth ? { marginLeft: `${Math.min(r.depth, 3) * 1.25}rem` } : undefined">
        <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon :name="r.depth ? 'lucide:corner-down-right' : 'lucide:folder'" class="h-5 w-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold text-gray-900 dark:text-white">{{ r.cat.title }}</div>
          <div class="truncate text-xs text-gray-500 dark:text-gray-400">{{ origin }}/category/{{ r.cat.slug }}</div>
        </div>
        <button type="button" class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15" :title="t('pages.categories.showPages')" @click="emit('show-pages', r.cat.id)">
          {{ t('pages.categories.pageCount', { n: r.cat.pageCount }) }}
        </button>
        <div class="flex flex-shrink-0 items-center gap-1.5">
          <button type="button" class="at-btn !px-2.5" :title="t('pages.categories.addChild')" :aria-label="t('pages.categories.addChild')" @click="openCreate(r.cat.id)"><Icon name="lucide:plus" class="h-4 w-4" /></button>
          <button type="button" class="at-btn !px-2.5" :title="t('common.edit')" :aria-label="t('common.edit')" @click="openEdit(r.cat)"><Icon name="lucide:pencil" class="h-4 w-4" /></button>
          <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :title="t('common.delete')" :aria-label="t('common.delete')" @click="remove(r.cat)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
        </div>
      </div>
    </div>

    <UModal v-model="open" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-lg' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ form.id ? t('pages.categories.edit') : t('pages.categories.new') }}</h3></template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('pages.categories.title')" required><UInput v-model="form.title" autofocus @keyup.enter="save" /></UFormGroup>
          <UFormGroup :label="t('pages.categories.slug')" :help="t('pages.categories.slugHint')">
            <UInput v-model="form.slug" @update:model-value="slugTouched = true" @keyup.enter="save" />
          </UFormGroup>
          <UFormGroup :label="t('pages.categories.description')" :help="t('pages.categories.descriptionHint')">
            <UTextarea v-model="form.description" :rows="3" maxlength="1000" />
          </UFormGroup>
          <UFormGroup :label="t('pages.categories.parent')">
            <CategoryChips v-model="form.parentId" :categories="categories" single :exclude="excluded"><template #empty>{{ t('pages.categories.noParents') }}</template></CategoryChips>
          </UFormGroup>
          <UFormGroup :label="t('pages.categories.order')" :help="t('pages.categories.orderHint')"><UInput v-model="form.sort" type="number" class="w-28" /></UFormGroup>
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
