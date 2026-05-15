<template>
  <main class="flex-1 overflow-y-auto" @click.self="$emit('click-self')">
    <div class="min-h-full py-8 px-4">
      <!-- Document card -->
      <div class="mx-auto max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/30 border border-slate-200/60 dark:border-slate-800">
        <!-- Title area -->
        <div class="px-12 pt-10 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div
            ref="titleEl"
            contenteditable="true"
            :data-placeholder="t('admin.editor.titlePlaceholder')"
            class="text-4xl font-bold text-slate-900 dark:text-white leading-snug outline-none w-full
                   empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-slate-700"
            @input="onTitleInput"
          />
          <!-- Slug preview -->
          <button
            class="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors group/slug"
            @click="$emit('show-seo-tab')"
          >
            <Icon name="lucide:globe" class="h-3 w-3" />
            <span class="group-hover/slug:underline">{{ article.slug ? '/' + article.slug : t('admin.editor.setUrl') }}</span>
            <Icon name="lucide:pen-line" class="h-3 w-3 opacity-0 group-hover/slug:opacity-100 transition-opacity" />
          </button>
        </div>

        <!-- ── BLOCKS ─────────────────────────────────────────────── -->
        <div class="px-12 py-6 pb-16">
          <template v-for="(block, i) in blocks" :key="block.id">
            <!-- Add button between blocks -->
            <ConsoleAddBetweenBlock :index="i" @open="$emit('add-block-at', i)" />

            <!-- Block container with drag/drop and toolbar -->
            <div
              class="group/block relative py-2.5"
              :class="dragState.over === i ? 'bg-blue-50/40 dark:bg-blue-950/20 rounded-lg' : ''"
              draggable="true"
              @dragstart="$emit('start-drag', i, $event)"
              @dragover.prevent="$emit('drag-over', i)"
              @drop.prevent="$emit('drop', i)"
              @dragend="$emit('end-drag')"
            >
              <!-- Block toolbar (left side) -->
              <div class="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity">
                <button
                  class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Duplicate"
                  @click="$emit('duplicate-block', i)"
                ><Icon name="lucide:copy" class="h-3.5 w-3.5" /></button>
                <button
                  v-if="i > 0"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Up"
                  @click="$emit('move-block', i, -1)"
                ><Icon name="lucide:chevron-up" class="h-3.5 w-3.5" /></button>
                <button
                  v-if="i < blocks.length - 1"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Down"
                  @click="$emit('move-block', i, 1)"
                ><Icon name="lucide:chevron-down" class="h-3.5 w-3.5" /></button>
                <div class="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  class="p-1 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete"
                  @click="$emit('delete-block', i)"
                ><Icon name="lucide:trash-2" class="h-3.5 w-3.5" /></button>
              </div>

              <!-- Block content -->
              <div class="px-3 py-1.5">
                <!-- HEADING -->
                <component
                  :is="block.type"
                  v-if="['h2','h3','h4','h5'].includes(block.type)"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  :data-placeholder="headingPlaceholder(block.type)"
                  class="outline-none w-full
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-slate-700"
                  :class="headingClass(block.type)"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- PARAGRAPH -->
                <p
                  v-else-if="block.type === 'paragraph'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  data-placeholder="Начните вводить текст..."
                  class="outline-none w-full leading-7 text-slate-700 dark:text-slate-300 text-[15px]
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- QUOTE -->
                <blockquote
                  v-else-if="block.type === 'quote'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  data-placeholder="Цитата..."
                  class="outline-none w-full border-l-[3px] border-blue-400 dark:border-blue-500
                         pl-4 py-1 italic text-slate-500 dark:text-slate-400 text-lg leading-relaxed
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- UNORDERED LIST -->
                <ul
                  v-else-if="block.type === 'ul'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  data-placeholder="Элемент списка..."
                  class="outline-none w-full list-disc list-inside text-slate-700 dark:text-slate-300 text-[15px] space-y-1 leading-7
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- ORDERED LIST -->
                <ol
                  v-else-if="block.type === 'ol'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  data-placeholder="Элемент списка..."
                  class="outline-none w-full list-decimal list-inside text-slate-700 dark:text-slate-300 text-[15px] space-y-1 leading-7
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- DIVIDER -->
                <div v-else-if="block.type === 'divider'" class="py-3">
                  <div class="flex items-center gap-3">
                    <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>

                <!-- CALLOUT -->
                <div
                  v-else-if="block.type === 'callout'"
                  class="rounded-xl p-4 flex gap-3"
                  :class="calloutClass(block.attrs.calloutType)"
                >
                  <div class="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center" :class="calloutIconBg(block.attrs.calloutType)">
                    <Icon :name="calloutIcon(block.attrs.calloutType)" class="h-3 w-3" :class="calloutIconClass(block.attrs.calloutType)" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      data-placeholder="Текст заметки..."
                      class="outline-none w-full text-sm leading-relaxed
                             empty:before:content-[attr(data-placeholder)] empty:before:opacity-40"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="$emit('block-keydown', block, i, $event)"
                      @focus="$emit('set-active-block', block.id)"
                      @mouseup="$emit('show-format-bar-event', $event)"
                    />
                    <!-- Type switcher -->
                    <div class="mt-2.5 flex gap-1">
                      <button
                        v-for="ct in ['info','warning','success']" :key="ct"
                        class="text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide transition-all"
                        :class="block.attrs.calloutType === ct
                          ? calloutActiveBtnClass(ct)
                          : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'"
                        @click.stop="block.attrs.calloutType = ct"
                      >{{ { info: 'Инфо', warning: 'Важно', success: 'Готово' }[ct] }}</button>
                    </div>
                  </div>
                </div>

                <!-- IMAGE -->
                <div v-else-if="block.type === 'image'" class="py-1">
                  <div
                    v-if="!block.attrs.src"
                    class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center
                           hover:border-blue-300 dark:hover:border-blue-700 transition-colors group/img-drop"
                  >
                    <div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-3 mb-3">
                      <Icon name="lucide:image-plus" class="h-7 w-7 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Добавьте изображение</p>
                    <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">Вставьте URL или загрузите файл</p>
                    <input
                      class="w-full max-w-xs mx-auto block px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700
                             bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-shadow"
                      placeholder="https://example.com/image.jpg"
                      @change="block.attrs.src = ($event.target as HTMLInputElement).value"
                    />
                  </div>
                  <div v-else class="relative group/img">
                    <img
                      :src="block.attrs.src"
                      :alt="block.attrs.alt || 'Image'"
                      class="w-full rounded-xl object-cover shadow-sm"
                    />
                    <!-- Caption & alt -->
                    <div class="mt-3 space-y-1.5">
                      <input
                        :value="block.attrs.caption"
                        placeholder="Подпись к изображению..."
                        class="w-full text-sm text-center text-slate-500 dark:text-slate-400 bg-transparent outline-none
                               border-b border-transparent focus:border-slate-300 dark:focus:border-slate-600 py-0.5 transition-colors"
                        @input="block.attrs.caption = ($event.target as HTMLInputElement).value"
                      />
                      <div class="relative">
                        <input
                          :value="block.attrs.alt"
                          placeholder="Alt текст для SEO (обязательно)..."
                          class="w-full text-xs text-center text-slate-400 dark:text-slate-500 bg-transparent outline-none
                                 border-b transition-colors py-0.5"
                          :class="block.attrs.alt
                            ? 'border-transparent focus:border-slate-200 dark:focus:border-slate-700'
                            : 'border-red-300 dark:border-red-700 focus:border-slate-200 dark:focus:border-slate-700'"
                          @input="block.attrs.alt = ($event.target as HTMLInputElement).value"
                        />
                        <div v-if="!block.attrs.alt" class="absolute -right-1 -top-1 text-red-500 text-lg font-bold" title="Alt required">
                          *
                        </div>
                      </div>
                    </div>
                    <button
                      class="absolute top-2.5 right-2.5 opacity-0 group-hover/img:opacity-100 transition-opacity
                             bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-300
                             border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-medium shadow-sm"
                      @click.stop="block.attrs.src = ''"
                    >
                      Изменить
                    </button>
                  </div>
                </div>

                <!-- RAW HTML -->
                <div v-else-if="block.type === 'html'" class="py-1">
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <Icon name="lucide:code-xml" class="h-4 w-4 text-slate-400" />
                      <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">HTML</span>
                    </div>
                    <textarea
                      :value="block.content"
                      placeholder="&lt;div&gt;...&lt;/div&gt;"
                      class="w-full px-4 py-3 font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 outline-none resize-none
                             focus:ring-2 focus:ring-blue-500"
                      rows="6"
                      @input="block.content = ($event.target as HTMLTextAreaElement).value"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Add button after last block -->
            <ConsoleAddBetweenBlock v-if="i === blocks.length - 1" :index="blocks.length" @open="$emit('add-block-at', blocks.length)" />
          </template>

          <!-- Empty state -->
          <div v-if="blocks.length === 0" class="py-16 text-center">
            <div class="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-5 mb-4">
              <Icon name="lucide:layout-template" class="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p class="text-sm font-medium text-slate-400 dark:text-slate-500">Нажмите «+» чтобы добавить первый блок</p>
            <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">Параграфы, заголовки, изображения и многое другое</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Block {
  id: string
  type: string
  content: string
  attrs: Record<string, any>
}

interface Props {
  article: any
  blocks: Block[]
  activeBlockId: string | null
  dragState: any
}

const props = defineProps<Props>()

const { t } = useI18n()

const titleEl = ref<HTMLElement | null>(null)
const blockRefs = new Map<string, HTMLElement>()

defineExpose({
  titleEl,
  setBlockRef,
  blockRefs,
})

const emit = defineEmits<{
  'update:article': [Partial<any>]
  'set-active-block': [string | null]
  'add-block-at': [number]
  'duplicate-block': [number]
  'move-block': [number, number]
  'delete-block': [number]
  'start-drag': [number, DragEvent]
  'drag-over': [number]
  'drop': [number]
  'end-drag': []
  'block-keydown': [Block, number, KeyboardEvent]
  'show-format-bar-event': [MouseEvent]
  'click-self': []
  'show-seo-tab': []
}>()

function setBlockRef(id: string, el: HTMLElement | null) {
  if (el) blockRefs.set(id, el)
  else blockRefs.delete(id)
}

function onTitleInput(e: Event) {
  const title = (e.target as HTMLElement).innerText
  emit('update:article', { title })
}

// ─── Block styling helpers ───────────────────────────────────────────────
function headingClass(type: string) {
  return {
    h2: 'text-3xl font-bold text-slate-900 dark:text-white',
    h3: 'text-2xl font-bold text-slate-900 dark:text-white',
    h4: 'text-xl font-semibold text-slate-900 dark:text-white',
    h5: 'text-lg font-semibold text-slate-800 dark:text-slate-100',
  }[type] ?? 'text-2xl font-bold text-slate-900 dark:text-white'
}

function headingPlaceholder(type: string) {
  return { h2: 'Заголовок H2...', h3: 'Заголовок H3...', h4: 'Заголовок H4...', h5: 'Заголовок H5...' }[type] ?? 'Заголовок...'
}

function calloutClass(type: string) {
  return {
    info: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900',
    warning: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900',
    success: 'bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900',
  }[type] ?? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900'
}

function calloutIcon(type: string) {
  return { info: 'lucide:info', warning: 'lucide:alert-triangle', success: 'lucide:check-circle-2' }[type] ?? 'lucide:info'
}

function calloutIconBg(type: string) {
  return {
    info: 'bg-blue-100 dark:bg-blue-900/50',
    warning: 'bg-amber-100 dark:bg-amber-900/50',
    success: 'bg-green-100 dark:bg-green-900/50',
  }[type] ?? 'bg-blue-100 dark:bg-blue-900/50'
}

function calloutIconClass(type: string) {
  return {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-green-600 dark:text-green-400',
  }[type] ?? 'text-blue-600 dark:text-blue-400'
}

function calloutActiveBtnClass(type: string) {
  return {
    info: 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    success: 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300',
  }[type] ?? 'bg-blue-100 border-blue-300 text-blue-700'
}
</script>
