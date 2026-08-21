<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { MENU_DOC_VARIABLES, menuDocVariableToken } from '@/utils/menuDocVariables';

const { t } = useI18n();

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const editorRef = ref<HTMLDivElement | null>(null);
const isVariableMenuOpen = ref(false);

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
  document.execCommand('insertText', false, menuDocVariableToken(key as any));
  handleInput();
  isVariableMenuOpen.value = false;
}

const variableGroups = [
  { key: 'order', labelKey: 'menu.docVarGroupOrder', fallback: 'Order' },
  { key: 'client', labelKey: 'menu.docVarGroupClient', fallback: 'Client' },
  { key: 'staff', labelKey: 'menu.docVarGroupStaff', fallback: 'Staff' },
] as const;
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
      <UButton icon="lucide:bold" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorBold') || 'Bold'" @mousedown.prevent="exec('bold')" />
      <UButton icon="lucide:italic" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorItalic') || 'Italic'" @mousedown.prevent="exec('italic')" />
      <UButton icon="lucide:underline" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorUnderline') || 'Underline'" @mousedown.prevent="exec('underline')" />
      <span class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
      <UButton label="H2" size="2xs" color="gray" variant="ghost" class="font-semibold" @mousedown.prevent="exec('formatBlock', 'H2')" />
      <UButton label="H3" size="2xs" color="gray" variant="ghost" class="font-semibold" @mousedown.prevent="exec('formatBlock', 'H3')" />
      <UButton label="P" size="2xs" color="gray" variant="ghost" @mousedown.prevent="exec('formatBlock', 'P')" />
      <span class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
      <UButton icon="lucide:list" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorBulletList') || 'Bullet list'" @mousedown.prevent="exec('insertUnorderedList')" />
      <UButton icon="lucide:list-ordered" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorNumberList') || 'Numbered list'" @mousedown.prevent="exec('insertOrderedList')" />
      <span class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
      <UButton icon="lucide:align-left" size="2xs" color="gray" variant="ghost" @mousedown.prevent="exec('justifyLeft')" />
      <UButton icon="lucide:align-center" size="2xs" color="gray" variant="ghost" @mousedown.prevent="exec('justifyCenter')" />
      <UButton icon="lucide:align-right" size="2xs" color="gray" variant="ghost" @mousedown.prevent="exec('justifyRight')" />
      <span class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
      <UButton icon="lucide:minus" size="2xs" color="gray" variant="ghost" :title="t('menu.docEditorDivider') || 'Divider'" @mousedown.prevent="exec('insertHorizontalRule')" />

      <div class="ml-auto relative">
        <UButton
          icon="lucide:braces"
          size="2xs"
          color="primary"
          variant="soft"
          :label="t('menu.docEditorInsertVariable') || 'Insert variable'"
          @mousedown.prevent="isVariableMenuOpen = !isVariableMenuOpen"
        />
        <div
          v-if="isVariableMenuOpen"
          class="absolute right-0 top-full mt-1 z-20 w-64 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-1"
        >
          <template v-for="group in variableGroups" :key="group.key">
            <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ t(group.labelKey) || group.fallback }}
            </div>
            <button
              v-for="v in MENU_DOC_VARIABLES.filter((x) => x.group === group.key)"
              :key="v.key"
              type="button"
              class="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
              @mousedown.prevent="insertVariable(v.key)"
            >
              <span>{{ t(v.labelKey) || v.fallback }}</span>
              <span class="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">{{ menuDocVariableToken(v.key) }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <div
      ref="editorRef"
      class="min-h-[280px] max-h-[50vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed focus:outline-none prose prose-sm dark:prose-invert max-w-none"
      contenteditable="true"
      @input="handleInput"
      @mousedown="isVariableMenuOpen = false"
    />
  </div>
</template>
