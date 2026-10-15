<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { MENU_DOC_VARIABLES, menuDocVariableToken } from '@/utils/menuDocVariables';

const { t, locale } = useI18n();

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const editorRef = ref<HTMLDivElement | null>(null);
const varSearch = ref('');

// Seeded once on mount rather than kept in sync via a reactive binding --
// re-applying innerHTML on every keystroke would reset the caret position.
// Callers that need to swap which template is being edited should remount
// this component (e.g. :key="template?.id") instead of relying on prop
// updates to resync the DOM.
onMounted(() => {
  if (editorRef.value) editorRef.value.innerHTML = props.modelValue || '';
});

function handleInput() {
  if (editorRef.value) emit('update:modelValue', editorRef.value.innerHTML);
}

// mousedown (not click) with preventDefault keeps focus/selection inside the
// contenteditable region -- otherwise clicking a toolbar button steals focus
// first and execCommand loses track of where to apply the format.
function exec(command: string, value?: string) {
  editorRef.value?.focus();
  document.execCommand(command, false, value);
  handleInput();
}

function insertVariable(key: string) {
  editorRef.value?.focus();
  document.execCommand('insertText', false, menuDocVariableToken(key as any, locale.value));
  handleInput();
}

const variableGroups = [
  { key: 'order', labelKey: 'menu.docVarGroupOrder', fallback: 'Order' },
  { key: 'client', labelKey: 'menu.docVarGroupClient', fallback: 'Client' },
  { key: 'staff', labelKey: 'menu.docVarGroupStaff', fallback: 'Staff' },
  { key: 'brand', labelKey: 'menu.docVarGroupBrand', fallback: 'Business' },
] as const;

// The palette, grouped and filtered by the search box.
const paletteGroups = computed(() => {
  const q = varSearch.value.trim().toLowerCase();
  return variableGroups.map((g) => ({
    ...g,
    items: MENU_DOC_VARIABLES.filter((v) => v.group === g.key && (!q || (t(v.labelKey) || v.fallback).toLowerCase().includes(q))),
  })).filter((g) => g.items.length);
});
</script>

<template>
  <div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
    <!-- The page: formatting bar above, a sheet of paper to write on. -->
    <div class="flex min-h-0 min-w-0 flex-col">
      <div class="at-panel !rounded-2xl mb-3 flex flex-shrink-0 flex-wrap items-center gap-0.5 !p-1.5">
        <button type="button" class="cp-icon" :title="t('menu.docEditorBold') || 'Bold'" @mousedown.prevent="exec('bold')"><Icon name="lucide:bold" class="h-4 w-4" /></button>
        <button type="button" class="cp-icon" :title="t('menu.docEditorItalic') || 'Italic'" @mousedown.prevent="exec('italic')"><Icon name="lucide:italic" class="h-4 w-4" /></button>
        <button type="button" class="cp-icon" :title="t('menu.docEditorUnderline') || 'Underline'" @mousedown.prevent="exec('underline')"><Icon name="lucide:underline" class="h-4 w-4" /></button>
        <span class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <button type="button" class="cp-icon text-xs font-bold" @mousedown.prevent="exec('formatBlock', 'H2')">H2</button>
        <button type="button" class="cp-icon text-xs font-bold" @mousedown.prevent="exec('formatBlock', 'H3')">H3</button>
        <button type="button" class="cp-icon text-xs font-bold" @mousedown.prevent="exec('formatBlock', 'P')">P</button>
        <span class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <button type="button" class="cp-icon" :title="t('menu.docEditorBulletList') || 'Bullet list'" @mousedown.prevent="exec('insertUnorderedList')"><Icon name="lucide:list" class="h-4 w-4" /></button>
        <button type="button" class="cp-icon" :title="t('menu.docEditorNumberList') || 'Numbered list'" @mousedown.prevent="exec('insertOrderedList')"><Icon name="lucide:list-ordered" class="h-4 w-4" /></button>
        <span class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <button type="button" class="cp-icon" @mousedown.prevent="exec('justifyLeft')"><Icon name="lucide:align-left" class="h-4 w-4" /></button>
        <button type="button" class="cp-icon" @mousedown.prevent="exec('justifyCenter')"><Icon name="lucide:align-center" class="h-4 w-4" /></button>
        <button type="button" class="cp-icon" @mousedown.prevent="exec('justifyRight')"><Icon name="lucide:align-right" class="h-4 w-4" /></button>
        <span class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <button type="button" class="cp-icon" :title="t('menu.docEditorDivider') || 'Divider'" @mousedown.prevent="exec('insertHorizontalRule')"><Icon name="lucide:minus" class="h-4 w-4" /></button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-gray-100 p-3 sm:p-6 dark:bg-gray-950/60">
        <div
          ref="editorRef"
          class="prose prose-sm mx-auto min-h-[60vh] w-full max-w-[820px] rounded-lg bg-white px-6 py-8 text-sm leading-relaxed text-gray-900 shadow-sm ring-1 ring-black/5 focus:outline-none sm:px-12 sm:py-10 dark:prose-invert"
          contenteditable="true"
          @input="handleInput"
        />
      </div>
    </div>

    <!-- Variables: tap one to put it where the cursor is. The sheet keeps focus (mousedown is not allowed to take it). -->
    <aside class="at-panel flex min-h-0 flex-col !p-3 lg:max-h-full">
      <div class="mb-2 text-sm font-semibold">{{ t('menu.docEditorInsertVariable') || 'Insert variable' }}</div>
      <p class="mb-2 text-xs text-gray-500">{{ t('menu.docVarsHint') || 'Click a field to insert it at the cursor. It is replaced with the order data when printing.' }}</p>
      <UInput v-model="varSearch" size="sm" icon="lucide:search" :placeholder="t('common.search')" class="mb-2" />
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <section v-for="group in paletteGroups" :key="group.key">
          <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{{ t(group.labelKey) || group.fallback }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="v in group.items"
              :key="v.key"
              type="button"
              class="pill-filter !px-2.5 !py-1 !text-xs"
              :title="menuDocVariableToken(v.key, locale)"
              @mousedown.prevent="insertVariable(v.key)"
            >{{ t(v.labelKey) || v.fallback }}</button>
          </div>
        </section>
        <p v-if="!paletteGroups.length" class="py-4 text-center text-sm text-gray-400">{{ t('app.noSearchResults') }}</p>
      </div>
    </aside>
  </div>
</template>
