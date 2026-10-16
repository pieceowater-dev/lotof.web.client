<template>
  <main class="flex-1 overflow-y-auto" @click.self="$emit('click-self')">
    <div class="min-h-full px-3 py-4 sm:px-4 sm:py-6">
      <!-- Document card -->
      <div class="pe-sheet mx-auto max-w-4xl">
        <!-- Title area -->
        <div class="px-6 pt-8 pb-5 sm:px-10 md:px-14 sm:pt-10 sm:pb-6 border-b border-slate-900/[0.06] dark:border-white/10">
          <div
            ref="titleEl"
            contenteditable="true"
            :data-placeholder="t('admin.editor.titlePlaceholder')"
            class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug outline-none w-full
                   empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-neutral-700"
            @input="onTitleInput"
          />
          <!-- Address preview -->
          <button
            v-if="!simple"
            type="button"
            class="pe-address mt-4"
            :class="liveUrl ? 'cursor-pointer' : 'cursor-default'"
            @click="openLive"
          >
            <Icon name="lucide:globe" class="h-3.5 w-3.5 flex-shrink-0" />
            <span class="truncate">{{ siteHost }}{{ pathLabel }}</span>
            <Icon v-if="liveUrl" name="lucide:external-link" class="h-3 w-3 flex-shrink-0" />
          </button>
        </div>

        <!-- ── BLOCKS ─────────────────────────────────────────────── -->
        <div class="px-6 py-6 pb-16 sm:px-10 md:px-14">
          <template v-for="(block, i) in blocks" :key="block.id">
            <!-- Add button between blocks -->
            <PagesEditorAddBetween :index="i" @open="$emit('add-block-at', i)" />

            <!-- Block container with drag/drop and toolbar -->
            <div
              class="pe-block group/block relative py-2"
              :data-block-index="i"
              :class="isBlockSelected(i) ? 'pe-block--picked' : ''"
            >
              <!-- Block toolbar -->
              <div class="pe-tools absolute -top-3 right-3 z-10 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100">
                <button
                  v-if="isAnchorableHeading(block)"
                  class="pe-tool"
                  :class="copiedAnchor === block.id ? '!text-emerald-600 dark:!text-emerald-300' : ''"
                  :title="copiedAnchor === block.id ? t('pages.editor.ui.anchorCopied') : t('pages.editor.ui.copyAnchor')"
                  @click="copyAnchorToClipboard(blockAnchor(block, i))"
                ><Icon :name="copiedAnchor === block.id ? 'lucide:check' : 'lucide:link-2'" class="h-3.5 w-3.5" /></button>
                <button v-if="i > 0" class="pe-tool" :title="t('pages.editor.ui.up')" @click="$emit('move-block', i, -1)">
                  <Icon name="lucide:chevron-up" class="h-3.5 w-3.5" />
                </button>
                <button v-if="i < blocks.length - 1" class="pe-tool" :title="t('pages.editor.ui.down')" @click="$emit('move-block', i, 1)">
                  <Icon name="lucide:chevron-down" class="h-3.5 w-3.5" />
                </button>
                <button class="pe-tool" :title="t('pages.editor.ui.duplicate')" @click="$emit('duplicate-block', i)">
                  <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                </button>
                <button class="pe-tool pe-tool--danger" :title="t('pages.editor.ui.delete')" @click="$emit('delete-block', i)">
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
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
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-neutral-700"
                  :class="headingClass(block.type)"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @paste="$emit('block-paste', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- PARAGRAPH -->
                <p
                  v-else-if="block.type === 'paragraph'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  :data-placeholder="t('pages.editor.ui.typeHere')"
                  class="outline-none w-full leading-7 text-slate-700 dark:text-neutral-300 text-[15px]
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-neutral-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @paste="$emit('block-paste', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- QUOTE -->
                <blockquote
                  v-else-if="block.type === 'quote'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  :data-placeholder="t('pages.editor.ui.quote')"
                  class="outline-none w-full border-l-[3px] border-blue-400 dark:border-blue-500
                         pl-4 py-1 italic text-slate-500 dark:text-neutral-400 text-lg leading-relaxed
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-neutral-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @paste="$emit('block-paste', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- UNORDERED LIST -->
                <ul
                  v-else-if="block.type === 'ul'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  :data-placeholder="t('pages.editor.ui.listItem')"
                  class="outline-none w-full list-disc list-inside text-slate-700 dark:text-neutral-300 text-[15px] space-y-1 leading-7
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-neutral-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @paste="$emit('block-paste', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- ORDERED LIST -->
                <ol
                  v-else-if="block.type === 'ol'"
                  :ref="(el: any) => setBlockRef(block.id, el)"
                  contenteditable="true"
                  :data-placeholder="t('pages.editor.ui.listItem')"
                  class="outline-none w-full list-decimal list-inside text-slate-700 dark:text-neutral-300 text-[15px] space-y-1 leading-7
                         empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-neutral-600"
                  @input="block.content = ($event.target as HTMLElement).innerHTML"
                  @keydown="$emit('block-keydown', block, i, $event)"
                  @paste="$emit('block-paste', block, i, $event)"
                  @focus="$emit('set-active-block', block.id)"
                  @mouseup="$emit('show-format-bar-event', $event)"
                />

                <!-- DIVIDER -->
                <div v-else-if="block.type === 'divider'" class="py-3">
                  <div class="flex items-center gap-3">
                    <div class="flex-1 h-px bg-slate-200 dark:bg-[#303030]" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-[#3a3a3a]" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-[#3a3a3a]" />
                    <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-[#3a3a3a]" />
                    <div class="flex-1 h-px bg-slate-200 dark:bg-[#303030]" />
                  </div>
                </div>

                <!-- CALLOUT -->
                <div
                  v-else-if="block.type === 'callout'"
                  class="rounded-3xl p-4 flex gap-3"
                  :class="calloutClass(block.attrs.calloutType)"
                >
                  <div class="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center" :class="calloutIconBg(block.attrs.calloutType)">
                    <Icon :name="calloutIcon(block.attrs.calloutType)" class="h-3 w-3" :class="calloutIconClass(block.attrs.calloutType)" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      :data-placeholder="t('pages.editor.ui.noteText')"
                      class="outline-none w-full text-sm leading-relaxed
                             empty:before:content-[attr(data-placeholder)] empty:before:opacity-40"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="$emit('block-keydown', block, i, $event)"
                      @paste="$emit('block-paste', block, i, $event)"
                      @focus="$emit('set-active-block', block.id)"
                      @mouseup="$emit('show-format-bar-event', $event)"
                    />
                    <!-- Type switcher -->
                    <div class="mt-2.5 flex gap-1">
                      <button
                        v-for="ct in ['info','warning','success']" :key="ct"
                        class="text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wide transition-all"
                        :class="block.attrs.calloutType === ct
                          ? calloutActiveBtnClass(ct)
                          : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300'"
                        @click.stop="block.attrs.calloutType = ct"
                      >{{ { info: t('pages.editor.ui.calloutInfo'), warning: t('pages.editor.ui.calloutWarning'), success: t('pages.editor.ui.calloutSuccess') }[ct] }}</button>
                    </div>
                  </div>
                </div>

                <!-- IMAGE -->
                <div v-else-if="block.type === 'image'" class="py-1">
                  <div v-if="!block.attrs.src" class="pe-drop">
                    <span class="icon-tile mb-2"><Icon name="lucide:image-plus" class="h-5 w-5" /></span>
                    <p class="text-sm font-bold text-slate-700 dark:text-neutral-200">{{ t('pages.editor.ui.addImageTitle') }}</p>
                    <p class="mb-3 text-xs text-slate-400 dark:text-neutral-500">{{ t('pages.editor.ui.uploadFile') }}</p>
                    <label class="at-btn at-btn--blue cursor-pointer">
                      <Icon name="lucide:upload" class="h-4 w-4" />
                      <span>{{ t('pages.editor.ui.chooseFile') }}</span>
                      <input type="file" accept="image/*" class="hidden" @change="onImageFileChange(block, $event)" />
                    </label>
                  </div>
                  <div v-else class="relative group/img">
                    <!-- Admin-uploaded article image of arbitrary aspect
                         ratio -- no design-intended ratio to force here, so
                         this only reserves a placeholder min-height to bound
                         the shift rather than eliminate it outright. -->
                    <img
                      :src="resolveImage(block.attrs.src)"
                      :alt="block.attrs.alt || 'Image'"
                      class="w-full rounded-3xl object-cover"
                      style="min-height: 200px"
                    />
                    <!-- Caption & alt -->
                    <div class="mt-3 space-y-1.5">
                      <input
                        :value="block.attrs.caption"
                        :placeholder="t('pages.editor.ui.caption')"
                        class="pe-field pe-field--bare w-full text-sm text-slate-500 dark:text-neutral-400"
                        @input="block.attrs.caption = ($event.target as HTMLInputElement).value"
                      />
                      <input
                        :value="block.attrs.alt"
                        :placeholder="t('pages.editor.ui.altText')"
                        class="pe-field pe-field--bare w-full text-xs text-slate-500 dark:text-neutral-400"
                        :class="block.attrs.alt ? '' : 'pe-field--bad'"
                          @input="block.attrs.alt = ($event.target as HTMLInputElement).value"
                      />
                    </div>
                    <button
                      class="absolute top-2.5 right-2.5 opacity-0 group-hover/img:opacity-100 transition-opacity
                             pe-pill !bg-white/90 dark:!bg-[#262626]/90 backdrop-blur-sm"
                      @click.stop="block.attrs.src = ''"
                    >
                      {{ t('pages.editor.ui.change') }}
                    </button>
                  </div>
                </div>

                <!-- RAW HTML -->
                <div v-else-if="block.type === 'button'" class="py-1">
                  <div class="pe-tray">
                    <div class="pe-tray-title"><Icon name="lucide:rectangle-ellipsis" class="h-3.5 w-3.5" />{{ t('pages.editor.ui.button') }}</div>

                    <div class="grid gap-2">
                      <input
                        :value="String(block.attrs.text || '')"
                        :placeholder="t('pages.editor.ui.buttonText')"
                        class="pe-field"
                        @input="block.attrs.text = ($event.target as HTMLInputElement).value"
                      />

                      <input
                        v-if="buttonKind(block) !== 'login'"
                        :value="String(block.attrs.href || '')"
                        :placeholder="t('pages.editor.ui.buttonLink')"
                        class="pe-field"
                        @input="block.attrs.href = ($event.target as HTMLInputElement).value"
                      />

                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="variant in buttonVariants"
                          :key="variant.value"
                          type="button"
                          class="pe-pill"
                          :class="buttonVariant(block) === variant.value ? 'pe-pill--on' : ''"
                          @click="setButtonVariant(block, variant.value)"
                        >
                          {{ variant.label }}
                        </button>
                      </div>

                      <button
                        v-if="buttonKind(block) !== 'login'"
                        type="button"
                        class="inline-flex items-center gap-3 rounded-full px-1 py-1 text-xs font-medium text-slate-600 transition dark:text-neutral-300"
                        @click="block.attrs.newTab = !buttonOpensInNewTab(block)"
                      >
                        <span
                          class="relative inline-flex h-5 w-9 items-center rounded-full transition"
                          :class="buttonOpensInNewTab(block) ? 'bg-gradient-to-r from-blue-600 to-emerald-500' : 'bg-slate-300 dark:bg-[#3a3a3a]'"
                        >
                          <span
                            class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition"
                            :class="buttonOpensInNewTab(block) ? 'translate-x-4.5' : 'translate-x-0.5'"
                          />
                        </span>
                        <span>{{ t('pages.editor.ui.newTab') }}</span>
                      </button>
                    </div>

                    <div class="mt-3 flex items-center justify-between gap-3">
                      <p class="text-[11px] text-slate-500 dark:text-neutral-400">
                        {{ t('pages.editor.ui.anchorHint') }}
                      </p>
                      <a
                        :href="buttonPreviewHref(block)"
                        :class="buttonPreviewClass(block)"
                      >
                        {{ String(block.attrs.text || t('pages.editor.ui.button')) || t('pages.editor.ui.button') }}
                      </a>
                    </div>
                  </div>
                </div>

                <div v-else-if="block.type === 'global'" class="py-1">
                  <div class="pe-tray">
                    <div class="pe-tray-title"><Icon name="lucide:blocks" class="h-3.5 w-3.5" />{{ t('pages.editor.globalTitle') }}</div>
                    <p v-if="!(globalBlocks || []).length" class="text-sm text-slate-500 dark:text-neutral-400">{{ t('pages.editor.globalNone') }}</p>
                    <div v-else class="flex flex-wrap gap-1.5">
                      <button
                        v-for="g in globalBlocks"
                        :key="g.slug"
                        type="button"
                        class="rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition"
                        :class="block.attrs.ref === g.slug ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-600 ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'"
                        @click="block.attrs.ref = g.slug"
                      >{{ g.name }}</button>
                    </div>
                    <p class="mt-2 text-xs text-slate-500 dark:text-neutral-400">{{ t('pages.editor.globalHint') }}</p>
                  </div>
                </div>

                <div v-else-if="block.type === 'faq'" class="py-1">
                  <div class="pe-tray">
                    <div class="pe-tray-title"><Icon name="lucide:messages-square" class="h-3.5 w-3.5" />FAQ</div>

                    <div class="space-y-3">
                      <div
                        v-for="(item, faqIndex) in getFaqItems(block)"
                        :key="`faq-${block.id}-${faqIndex}`"
                        class="rounded-3xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]"
                      >
                        <div class="mb-2 flex items-center justify-between gap-2">
                          <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">{{ t('pages.editor.ui.faqPair', { n: faqIndex + 1 }) }}</span>
                          <button
                            type="button"
                            class="pe-pill pe-pill--danger"
                            @click="removeFaqItem(block, faqIndex)"
                          >
                            {{ t('pages.editor.ui.delete') }}
                          </button>
                        </div>

                        <input
                          :value="String(item.q || '')"
                          :placeholder="t('pages.editor.ui.question')"
                          class="pe-field mb-2"
                          @input="updateFaqField(block, faqIndex, 'q', ($event.target as HTMLInputElement).value)"
                        />
                        <textarea
                          :value="String(item.a || '')"
                          rows="3"
                          :placeholder="t('pages.editor.ui.answer')"
                          :aria-label="t('pages.editor.ui.answer')"
                          class="pe-field"
                          @input="updateFaqField(block, faqIndex, 'a', ($event.target as HTMLTextAreaElement).value)"
                        />
                      </div>
                    </div>

                    <div class="mt-4 flex justify-end">
                      <button
                        type="button"
                        class="pe-pill pe-pill--on"
                        @click="addFaqItem(block)"
                      >
                        + {{ t('pages.editor.ui.addQuestion') }}
                      </button>
                    </div>
                  </div>
                </div>

                <PagesEditorSectionBlock
                  v-else-if="['hero', 'columns', 'gallery', 'cta'].includes(block.type)"
                  :block="block"
                  :upload="uploadImage"
                  :resolve="imageResolver"
                />

                <div v-else-if="block.type === 'html'" class="py-1">
                  <div class="pe-tray">
                    <div class="pe-tray-title"><Icon name="lucide:code-xml" class="h-3.5 w-3.5" />HTML</div>
                    <textarea
                      :value="block.content"
                      placeholder="&lt;div&gt;...&lt;/div&gt;"
                      aria-label="HTML"
                      class="pe-field !rounded-3xl !px-4 !py-3 font-mono !text-xs"
                      rows="6"
                      @input="block.content = ($event.target as HTMLTextAreaElement).value"
                    />
                  </div>
                </div>
              </div>
              <PagesEditorBlockStyleBar
                v-if="activeBlockId === block.id && !['spoiler_open', 'spoiler_close'].includes(block.type)"
                :attrs="block.attrs"
                :upload="uploadImage"
                :resolve="imageResolver"
                @change="(st) => { if (st) block.attrs.style = st; else delete block.attrs.style }"
              />
            </div>

            <!-- Add button after last block -->
            <PagesEditorAddBetween v-if="i === blocks.length - 1" :index="blocks.length" @open="$emit('add-block-at', blocks.length)" />
          </template>

          <!-- Empty state -->
          <div v-if="blocks.length === 0" class="py-16 text-center">
            <span class="icon-tile mb-4 !h-14 !w-14"><Icon name="lucide:layout-template" class="h-7 w-7" /></span>
            <p class="text-sm font-bold text-slate-600 dark:text-neutral-300">{{ t('pages.editor.ui.emptyTitle') }}</p>
            <p class="text-xs text-slate-300 dark:text-neutral-600 mt-1">{{ t('pages.editor.ui.emptyHint') }}</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
  siteHost?: string
  simple?: boolean
  pathLabel?: string
  /** Absolute address of the page on the live site, empty until it can be opened. */
  liveUrl?: string
  /** Maps a site-relative image URL (/media/<hash>.png) to one the console can load. */
  imageResolver?: (src: string) => string
  uploadImage: (file: File) => Promise<{ url: string }>
  activeBlockId: string | null
  dragState: any
  selectedBlockRange?: { start: number; end: number } | null
  globalBlocks?: { slug: string; name: string }[]
}

const props = defineProps<Props>()

function isBlockSelected(index: number): boolean {
  const range = props.selectedBlockRange
  if (!range) return false
  return index >= range.start && index <= range.end
}

const { t } = useI18n()

const liveUrl = computed(() => (props.liveUrl || '').trim())

function openLive() {
  if (!liveUrl.value || typeof window === 'undefined') return
  window.open(liveUrl.value, '_blank', 'noopener,noreferrer')
}

function resolveImage(src: string): string {
  return props.imageResolver ? props.imageResolver(String(src || '')) : String(src || '')
}

const titleEl = ref<HTMLElement | null>(null)
const copiedAnchor = ref<string | null>(null)
let copiedAnchorTimer: ReturnType<typeof setTimeout> | null = null
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
  'block-paste': [Block, number, ClipboardEvent]
  'show-format-bar-event': [MouseEvent]
  'click-self': []
  'upload-inline-image': [{ blockId: string; file: File }]
}>()

function setBlockRef(id: string, el: HTMLElement | null) {
  if (el) blockRefs.set(id, el)
  else blockRefs.delete(id)
}

function onTitleInput(e: Event) {
  const title = (e.target as HTMLElement).innerText
  emit('update:article', { title })
}

function onImageFileChange(block: Block, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('upload-inline-image', { blockId: String(block.id || ''), file })
  input.value = ''
}


function buttonKind(block: Block): 'custom' | 'login' {
  return String(block?.attrs?.kind || 'custom') === 'login' ? 'login' : 'custom'
}

const cyrillicToLatin: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function transliterate(value: string): string {
  let out = ''
  for (const ch of String(value || '').toLowerCase()) {
    out += cyrillicToLatin[ch] ?? ch
  }
  return out
}

function slugifyAnchor(value: string, fallbackIndex: number): string {
  const normalized = transliterate(stripHtml(value))
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || `section-${fallbackIndex + 1}`
}

function isAnchorableHeading(block: Block): boolean {
  return ['h2', 'h3', 'h4', 'h5'].includes(String(block?.type || ''))
}

function blockAnchor(block: Block, fallbackIndex: number): string {
  const base = slugifyAnchor(String(block?.content || ''), fallbackIndex)
  let duplicateCount = 0

  for (let i = 0; i <= fallbackIndex; i += 1) {
    const candidate = props.blocks[i]
    if (!isAnchorableHeading(candidate)) continue
    const candidateBase = slugifyAnchor(String(candidate?.content || ''), i)
    if (candidateBase === base) duplicateCount += 1
  }

  const resolved = duplicateCount > 1 ? `${base}-${duplicateCount}` : base
  return `#${resolved}`
}

async function copyAnchorToClipboard(anchor: string) {
  if (!anchor || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(anchor)
    const matchingBlock = props.blocks.find((block) => isAnchorableHeading(block) && blockAnchor(block, props.blocks.indexOf(block)) === anchor)
    copiedAnchor.value = matchingBlock?.id || null
    if (copiedAnchorTimer) clearTimeout(copiedAnchorTimer)
    copiedAnchorTimer = setTimeout(() => {
      copiedAnchor.value = null
      copiedAnchorTimer = null
    }, 1400)
  } catch {
    // ignore clipboard failures in editor helper UI
  }
}

const buttonVariants = [
  { value: 'solid', label: t('pages.editor.ui.btnSolid') },
  { value: 'outline', label: t('pages.editor.ui.btnOutline') },
  { value: 'soft', label: t('pages.editor.ui.btnSoft') },
  { value: 'link', label: t('pages.editor.ui.btnLink') },
] as const

function buttonVariant(block: Block): 'solid' | 'outline' | 'soft' | 'link' {
  const value = String(block?.attrs?.variant || '').trim().toLowerCase()
  if (value === 'outline' || value === 'soft' || value === 'link') return value
  if (value === 'secondary') return 'outline'
  return 'solid'
}

function setButtonKind(block: Block, kind: 'custom' | 'login') {
  block.attrs.kind = kind
  if (kind === 'login') {
    block.attrs.text = String(block.attrs.text || '').trim() || t('pages.editor.ui.login')
    block.attrs.href = '/?auth-needed=true'
    block.attrs.newTab = false
    if (!String(block.attrs.variant || '').trim()) {
      block.attrs.variant = 'solid'
    }
    return
  }
}

function setButtonVariant(block: Block, variant: 'solid' | 'outline' | 'soft' | 'link') {
  block.attrs.variant = variant
}

function buttonOpensInNewTab(block: Block): boolean {
  return Boolean(block?.attrs?.newTab ?? true)
}

function buttonPreviewHref(block: Block): string {
  if (buttonKind(block) === 'login') return '/?auth-needed=true'
  return String(block?.attrs?.href || '').trim() || '#'
}

function buttonPreviewClass(block: Block): string {
  const variant = buttonVariant(block)
  if (variant === 'outline') {
    return 'inline-flex items-center rounded-md border border-blue-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm dark:border-blue-400 dark:text-blue-300'
  }
  if (variant === 'soft') {
    return 'inline-flex items-center rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
  }
  if (variant === 'link') {
    return 'inline-flex items-center px-1 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200'
  }
  return 'inline-flex items-center rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold !text-white no-underline shadow-sm dark:bg-blue-500 dark:!text-white'
}

function getFaqItems(block: Block): Array<{ q: string; a: string }> {
  if (!Array.isArray(block?.attrs?.items)) {
    block.attrs.items = [{ q: '', a: '' }]
  }
  return block.attrs.items
}

function addFaqItem(block: Block) {
  getFaqItems(block).push({ q: '', a: '' })
}

function removeFaqItem(block: Block, index: number) {
  const items = getFaqItems(block)
  if (items.length <= 1) {
    items[0] = { q: '', a: '' }
    return
  }
  items.splice(index, 1)
}

function updateFaqField(block: Block, index: number, field: 'q' | 'a', value: string) {
  const items = getFaqItems(block)
  if (!items[index]) items[index] = { q: '', a: '' }
  items[index][field] = value
}

// ─── Block styling helpers ───────────────────────────────────────────────
function headingClass(type: string) {
  return {
    h2: 'text-3xl font-bold text-slate-900 dark:text-white',
    h3: 'text-2xl font-bold text-slate-900 dark:text-white',
    h4: 'text-xl font-semibold text-slate-900 dark:text-white',
    h5: 'text-lg font-semibold text-slate-800 dark:text-neutral-100',
  }[type] ?? 'text-2xl font-bold text-slate-900 dark:text-white'
}

function headingPlaceholder(type: string) {
  return { h2: t('pages.editor.ui.h2'), h3: t('pages.editor.ui.h3'), h4: t('pages.editor.ui.h4'), h5: t('pages.editor.ui.h5') }[type] ?? t('pages.editor.ui.heading')
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
