<template>
  <div class="at-scope ct-scope publication-builder pe-root flex flex-col h-screen overflow-hidden">
    <PagesEditorHeader
      :page="article"
      :path="pathLabel"
      :is-dirty="isDirty"
      :is-saving="isSaving"
      :can-delete="!!props.onDelete && !props.isHome"
      :back-to="props.backTo"
      :live-url="liveUrl"
      :simple="props.simple"
      @save="saveDraft"
      @delete="deletePage"
    />

    <div class="flex flex-1 overflow-hidden relative">
      <PagesEditorCanvas
        ref="canvasRef"
        :article="article"
        :blocks="blocks"
        :site-host="props.siteHost"
        :path-label="pathLabel"
        :live-url="liveUrl"
        :simple="props.simple"
        :global-blocks="props.globalBlocks"
        :image-resolver="resolveImage"
        :upload-image="props.onUploadImage"
        :active-block-id="activeBlockId"
        :drag-state="dragState"
        :selected-block-range="selectedBlockRange"
        @update:article="onArticlePatch"
        @upload-inline-image="uploadInlineImage"
        @set-active-block="(id) => activeBlockId = id"
        @add-block-at="openPicker"
        @duplicate-block="duplicateBlock"
        @move-block="(i, dir) => moveBlock(i, dir)"
        @delete-block="deleteBlock"
        @start-drag="startDrag"
        @drag-over="onDragOver"
        @drop="onDrop"
        @end-drag="endDrag"
        @block-keydown="onBlockKeydown"
        @block-paste="onBlockPaste"
        @show-format-bar-event="onShowFormatBarEvent"
        @click-self="activeBlockId = null"
      />

      <PagesEditorSidebar
        v-if="!props.simple"
        :page="article"
        :blocks="blocks"
        :is-home="props.isHome"
        :parent-path="props.parentPath"
        :ns-slug="props.nsSlug"
        :site-id="props.siteId"
        :exclude="props.exclude"
        :parent-id="props.parentId"
        :sort="props.sort"
        :can-move="!!props.onMove"
        :categories="props.categories"
        :category-ids="props.categoryIds"
        :can-categories="!!props.onCategories && props.categories.length > 0"
        :translations="props.translations"
        :site-langs="props.siteLangs"
        :can-translate="!!props.onTranslate"
        @translate="(l: string) => props.onTranslate?.(l)"
        @open-page="(id: string) => props.onOpenPage?.(id)"
        @categories="(ids: string[]) => props.onCategories?.(ids)"
        @move="(p: string, s: number) => props.onMove?.(p, s)"
        :resolve-image="resolveImage"
        @update:page="onArticlePatch"
        @upload-og-image="uploadOgImage"
        @upload-featured="uploadFeaturedImage"
        :tag-suggestions="props.tagSuggestions"
        :site-name="props.siteName"
        :site-host="props.siteHost"
      />

      <PagesEditorMobileSidebar
        v-if="isMobileSidebarOpen && !props.simple"
        :page="article"
        :blocks="blocks"
        :is-home="props.isHome"
        :parent-path="props.parentPath"
        :ns-slug="props.nsSlug"
        :site-id="props.siteId"
        :exclude="props.exclude"
        :parent-id="props.parentId"
        :sort="props.sort"
        :can-move="!!props.onMove"
        :categories="props.categories"
        :category-ids="props.categoryIds"
        :can-categories="!!props.onCategories && props.categories.length > 0"
        :translations="props.translations"
        :site-langs="props.siteLangs"
        :can-translate="!!props.onTranslate"
        @translate="(l: string) => props.onTranslate?.(l)"
        @open-page="(id: string) => props.onOpenPage?.(id)"
        @categories="(ids: string[]) => props.onCategories?.(ids)"
        @move="(p: string, s: number) => props.onMove?.(p, s)"
        :resolve-image="resolveImage"
        @update:page="onArticlePatch"
        @upload-og-image="uploadOgImage"
        @upload-featured="uploadFeaturedImage"
        :tag-suggestions="props.tagSuggestions"
        :site-name="props.siteName"
        :site-host="props.siteHost"
        @close="isMobileSidebarOpen = false"
      />
    </div>

    <PagesEditorFloatingButtons
      v-if="!isMobileSidebarOpen"
      :hide-sidebar="props.simple"
      @add-block="openPicker(blocks.length)"
      @toggle-sidebar="isMobileSidebarOpen = true"
    />

    <PagesEditorBlockPicker
      :open="picker.open"
      :hide-global="props.simple"
      @update:open="picker.open = $event"
      @add="insertBlock(picker.atIndex, $event)"
    />

    <PagesEditorFormatToolbar
      :format-bar="formatBar"
      @hide="hideFormatBar"
      @apply-format="applyFormat"
      @delete-blocks="deleteSelectedBlocks"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { BLOCK_FORM_TYPES, defaultAttrs } from '@/utils/pagesBlockForms'
import { useConfirm } from '@/composables/useConfirm'
import { compressImageForUpload } from '@/utils/imageCompression'

const { t } = useI18n()
const toast = useToast()

// ─── Types ───────────────────────────────────────────────────────────────
interface Block {
  id: string
  type: string
  content: string
  attrs: Record<string, any>
}

interface PageState {
  title: string
  slug: string
  status: 'draft' | 'ready'
  lang: string
  metaTitle: string
  metaDescription: string
  canonicalPath: string
  ogImage: string
  noindex: boolean
  // blog and layout (see the Post tab)
  kind: string
  tags: string[]
  excerpt: string
  featuredImage: string
  author: string
  pinned: boolean
  layout: string
  publishAt: number
}

interface Props {
  initialPage?: Partial<PageState>
  initialBlocks?: Block[]
  /** Public host of the site, e.g. shop.pages.lota.tools */
  siteHost: string
  /** Absolute origin of the live site (scheme + host [+ port]) for opening the page. */
  siteOrigin?: string
  /** Path of the parent page ("" for top level), shown in front of the slug. */
  parentPath?: string
  isHome?: boolean
  /** Candidate parents ({ label, value }) and the page's current placement — WordPress "Page attributes". */
  nsSlug?: string
  siteId?: string
  exclude?: Set<string>
  parentId?: string
  sort?: number
  onMove?: (parentId: string, sort: number) => Promise<void>
  /** Categories of the site and the ones this page is in; applied on their own (not part of the content save). */
  categories?: any[]
  categoryIds?: string[]
  /** Tags already used on the site, offered as quick picks. */
  tagSuggestions?: string[]
  siteName?: string
  onCategories?: (ids: string[]) => Promise<void>
  /** Reusable blocks of the site, offered by the "shared block" block. */
  globalBlocks?: { slug: string; name: string }[]
  /** The page and its translations; the sidebar offers the missing languages. */
  translations?: { id: string; lang: string; path: string; status: string }[]
  siteLangs?: string[]
  onTranslate?: (lang: string) => Promise<void>
  onOpenPage?: (id: string) => void
  /** True once the page has been published at least once, so "open live" can work. */
  published?: boolean
  /** Shared-block mode: only the content, no page settings, status, address or sidebar. */
  simple?: boolean
  backTo: string
  onSave: (payload: { page: PageState; blocks: Block[] }) => Promise<void>
  /** Uploads an image to the site's library and returns its site-relative URL. */
  onUploadImage: (file: File) => Promise<{ url: string }>
  /** Maps a site-relative URL to one the console can load. */
  imageResolver?: (src: string) => string
  onDelete?: () => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  initialPage: () => ({}),
  initialBlocks: () => [],
  siteOrigin: '',
  parentPath: '',
  isHome: false,
  parentId: '',
  sort: 0,
  onMove: undefined,
  categories: () => [],
  categoryIds: () => [],
  tagSuggestions: () => [],
  siteName: '',
  onCategories: undefined,
  globalBlocks: () => [],
  translations: () => [],
  siteLangs: () => [],
  onTranslate: undefined,
  onOpenPage: undefined,
  published: false,
  simple: false,
  imageResolver: undefined,
  onDelete: undefined,
})

// ─── Page state ───────────────────────────────────────────────────────────
const article = reactive<PageState>({
  title: props.initialPage.title || '',
  slug: props.initialPage.slug || '',
  status: (props.initialPage.status as any) || 'draft',
  lang: props.initialPage.lang || '',
  metaTitle: props.initialPage.metaTitle || '',
  metaDescription: props.initialPage.metaDescription || '',
  canonicalPath: props.initialPage.canonicalPath || '',
  ogImage: props.initialPage.ogImage || '',
  noindex: !!props.initialPage.noindex,
  kind: props.initialPage.kind || '',
  tags: [...(props.initialPage.tags || [])],
  excerpt: props.initialPage.excerpt || '',
  featuredImage: props.initialPage.featuredImage || '',
  author: props.initialPage.author || '',
  pinned: !!props.initialPage.pinned,
  layout: props.initialPage.layout || '',
  publishAt: Number(props.initialPage.publishAt) || 0,
})

const pathLabel = computed(() => {
  if (props.isHome) return '/'
  const slug = article.slug || t('pages.editor.slugPlaceholder')
  return `${props.parentPath || ''}/${slug}`
})
const liveUrl = computed(() => (props.published && props.siteOrigin ? `${props.siteOrigin}${props.isHome ? '/' : pathLabel.value}` : ''))
function resolveImage(src: string): string {
  return props.imageResolver ? props.imageResolver(src) : src
}

// ─── Blocks ───────────────────────────────────────────────────────────────
const blocks = ref<Block[]>(props.initialBlocks || [])
const activeBlockId = ref<string | null>(null)
const canvasRef = ref<any>(null)
const blockRefs = computed(() => canvasRef.value?.blockRefs || new Map())
const titleEl = computed(() => canvasRef.value?.titleEl)

let _idCounter = 0
function uid() { return `b${++_idCounter}_${Math.random().toString(36).slice(2, 7)}` }

function createBlock(type: string): Block {
  const attrs = type === 'callout'
    ? { calloutType: 'info' }
    : type === 'button'
      ? { text: t('pages.editor.ui.button'), href: '', newTab: true, kind: 'custom', variant: 'solid' }
      : type === 'faq'
        ? { items: [{ q: '', a: '' }] }
      : type === 'global'
        ? { ref: '' }
      : type === 'hero'
        ? { title: '', subtitle: '', buttonText: '', buttonHref: '', layout: 'center' }
      : type === 'columns'
        ? { cols: '3', items: [{ icon: '', title: '', text: '' }, { icon: '', title: '', text: '' }, { icon: '', title: '', text: '' }] }
      : type === 'gallery'
        ? { cols: '3', images: [] }
      : type === 'cta'
        ? { title: '', text: '', buttonText: '', buttonHref: '' }
      : type === 'schema'
        ? { kind: 'LocalBusiness' }
      : BLOCK_FORM_TYPES.includes(type)
        ? defaultAttrs(type)
      : {}

  const content = type === 'ul'
    ? `<li>${t('pages.editor.ui.listItemDefault')}</li>`
    : type === 'ol'
      ? `<li>${t('pages.editor.ui.listItemDefault')}</li>`
      : ''

  return {
    id: uid(),
    type,
    content,
    attrs,
  }
}

function focusBlock(id: string) {
  nextTick(() => {
    const el = blockRefs.value.get(id)
    if (el) {
      el.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

// ─── Block operations ─────────────────────────────────────────────────────
function insertBlock(index: number, type: string) {
  picker.open = false
  const block = createBlock(type)
  blocks.value.splice(index, 0, block)
  activeBlockId.value = block.id
  nextTick(() => {
    const el = blockRefs.value.get(block.id)
    if (el) {
      el.innerHTML = block.content
      el.focus()
    }
  })
}

function duplicateBlock(index: number) {
  const src = blocks.value[index]
  const clone: Block = {
    id: uid(),
    type: src.type,
    content: src.content,
    attrs: { ...src.attrs },
  }
  blocks.value.splice(index + 1, 0, clone)
  nextTick(() => {
    const el = blockRefs.value.get(clone.id)
    if (el) el.innerHTML = clone.content
  })
}

function moveBlock(index: number, dir: number) {
  const target = index + dir
  if (target < 0 || target >= blocks.value.length) return
  const arr = blocks.value
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  blocks.value = [...arr]
}

// ─── Keyboard handling in blocks ─────────────────────────────────────────
function onBlockKeydown(block: Block, index: number, e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && block.type !== 'ul' && block.type !== 'ol') {
    e.preventDefault()
    const newBlock = createBlock('paragraph')
    blocks.value.splice(index + 1, 0, newBlock)
    activeBlockId.value = newBlock.id
    nextTick(() => {
      const el = blockRefs.value.get(newBlock.id)
      if (el) { el.innerHTML = ''; el.focus() }
    })
  }
  if (e.key === 'Backspace') {
    const el = blockRefs.value.get(block.id)
    if (el && (el.innerHTML === '' || el.innerHTML === '<br>') && blocks.value.length > 1) {
      e.preventDefault()
      deleteBlock(index)
      const prevIndex = Math.max(0, index - 1)
      if (blocks.value[prevIndex]) {
        focusBlock(blocks.value[prevIndex].id)
      }
    }
  }
}

function onBlockFocus(block: Block) {
  activeBlockId.value = block.id
}

function looksLikeMarkdownBulk(text: string): boolean {
  const value = String(text || '').trim()
  if (!value) return false
  if (value.length < 120 && !value.includes('\n')) return false
  return /(^|\n)(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s+|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\))/m.test(value)
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeInlineMarkdown(value: string): string {
  let out = escapeHtml(value)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const url = String(href || '').trim()
    if (!url) return label
    return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
  })
  return out
}

function markdownToBlocks(markdown: string): Block[] {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const result: Block[] = []
  let index = 0

  const pushBlock = (type: string, content: string, attrs: Record<string, any> = {}) => {
    result.push({ id: uid(), type, content, attrs })
  }

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) {
      index += 1
      continue
    }

    const heading = line.match(/^(#{2,5})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const type = (`h${Math.min(Math.max(level, 2), 5)}`)
      pushBlock(type, normalizeInlineMarkdown(heading[2]))
      index += 1
      continue
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/)
    if (image) {
      pushBlock('image', '', { src: String(image[2] || '').trim(), alt: String(image[1] || '').trim() })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
        index += 1
      }
      const listHtml = items.map((item) => `<li>${normalizeInlineMarkdown(item)}</li>`).join('')
      pushBlock('ul', listHtml)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''))
        index += 1
      }
      const listHtml = items.map((item) => `<li>${normalizeInlineMarkdown(item)}</li>`).join('')
      pushBlock('ol', listHtml)
      continue
    }

    if (/^>\s?/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      pushBlock('quote', normalizeInlineMarkdown(items.join('<br>')))
      continue
    }

    const paragraphLines: string[] = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index].trim()
      if (!next) {
        index += 1
        break
      }
      if (/^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s+|!\[[^\]]*\]\([^)]*\))/.test(next)) break
      paragraphLines.push(next)
      index += 1
    }
    pushBlock('paragraph', normalizeInlineMarkdown(paragraphLines.join(' ')))
  }

  return result.length ? result : [createBlock('paragraph')]
}

function onBlockPaste(_block: Block, index: number, e: ClipboardEvent) {
  const text = String(e.clipboardData?.getData('text/plain') || '')
  if (!looksLikeMarkdownBulk(text)) return

  e.preventDefault()
  const parsedBlocks = markdownToBlocks(text)
  if (!parsedBlocks.length) return

  blocks.value.splice(index, 1, ...parsedBlocks)
  activeBlockId.value = parsedBlocks[0]?.id || null

  nextTick(() => {
    hydrateEditorDomFromState()
    const firstId = parsedBlocks[0]?.id
    if (!firstId) return
    const el = blockRefs.value.get(firstId)
    if (el) el.focus()
  })

  markDirty()
}

// ─── Drag & drop ─────────────────────────────────────────────────────────
const dragState = reactive({ index: -1, over: -1 })

function startDrag(index: number, e: DragEvent) {
  if (!e.dataTransfer) return
  dragState.index = index
  dragState.over = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/html', 'block')
  const img = new Image()
  e.dataTransfer.setDragImage(img, 0, 0)
}

function onDragOver(index: number) {
  if (dragState.index === -1) return
  dragState.over = index
}

function onDrop(index: number) {
  const from = dragState.index
  if (from === -1 || from === index) {
    endDrag()
    return
  }
  
  const arr = [...blocks.value]
  const [moved] = arr.splice(from, 1)
  const targetIndex = from < index ? index - 1 : index
  arr.splice(targetIndex, 0, moved)
  blocks.value = arr
  activeBlockId.value = moved?.id ?? activeBlockId.value
  markDirty()
  endDrag()
}

function endDrag() {
  dragState.index = -1
  dragState.over = -1
}

// ─── Block picker ─────────────────────────────────────────────────────────
const picker = reactive({ open: false, atIndex: 0 })

function openPicker(index: number) {
  picker.atIndex = index
  picker.open = true
}

// ─── Text format toolbar ──────────────────────────────────────────────────
const formatBar = reactive({ visible: false, x: 0, y: 0, mode: 'format' as 'format' | 'deleteBlocks', blockCount: 0 })
let savedRange: Range | null = null
const isSlugManuallyEdited = ref(false)

// ─── Multi-block selection (native text selection spanning multiple blocks) ─
const selectedBlockRange = ref<{ start: number; end: number } | null>(null)

function resolveBlockIndex(node: Node | null): number | null {
  const el = (node instanceof Element ? node : node?.parentElement) || null
  const blockEl = el?.closest<HTMLElement>('[data-block-index]')
  if (!blockEl) return null
  const index = Number(blockEl.dataset.blockIndex)
  return Number.isFinite(index) ? index : null
}

function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    selectedBlockRange.value = null
    return
  }

  const startIndex = resolveBlockIndex(sel.anchorNode)
  const endIndex = resolveBlockIndex(sel.focusNode)
  if (startIndex === null || endIndex === null || startIndex === endIndex) {
    selectedBlockRange.value = null
    return
  }

  selectedBlockRange.value = {
    start: Math.min(startIndex, endIndex),
    end: Math.max(startIndex, endIndex),
  }
}

function deleteSelectedBlocks() {
  const range = selectedBlockRange.value
  if (!range) return
  openConfirmDialog('deleteBlocks', undefined, range)
}

const isHydrating = ref(false)
const isDirty = ref(false)
const isSaving = ref(false)
const isMobileSidebarOpen = ref(false)

const { confirm } = useConfirm()

type ConfirmKind = 'deleteBlock' | 'deleteBlocks' | 'deletePage'

async function openConfirmDialog(type: ConfirmKind, blockIndex?: number, blockRange?: { start: number; end: number }) {
  let title: string
  let message: string
  let confirmLabel: string
  let cancelLabel: string
  if (type === 'deletePage') {
    title = t('pages.editor.deleteTitle')
    message = t('pages.editor.deleteText')
    confirmLabel = t('pages.editor.delete')
    cancelLabel = t('pages.editor.cancel')
  } else {
    const count = type === 'deleteBlocks' && blockRange ? blockRange.end - blockRange.start + 1 : 1
    title = type === 'deleteBlock' ? t('pages.editor.ui.deleteBlockTitle') : t('pages.editor.ui.deleteBlocksTitle', { n: count })
    message = t('pages.editor.ui.irreversible')
    confirmLabel = t('pages.editor.ui.delete')
    cancelLabel = t('pages.editor.cancel')
  }
  const ok = await confirm({ title, message, confirmLabel, cancelLabel, color: 'red', icon: 'lucide:trash-2' })
  if (ok) await runConfirmAction(type, blockIndex, blockRange)
}

async function runConfirmAction(type: ConfirmKind, index?: number, range?: { start: number; end: number }) {
  if (type === 'deleteBlock') {
    if (index === undefined || index < 0 || index >= blocks.value.length) return
    blocks.value.splice(index, 1)
    markDirty()
    return
  }

  if (type === 'deleteBlocks') {
    selectedBlockRange.value = null
    hideFormatBar()
    if (!range) return
    const start = Math.max(0, range.start)
    const end = Math.min(blocks.value.length - 1, range.end)
    if (start > end) return
    blocks.value.splice(start, end - start + 1)
    markDirty()
    return
  }

  if (!props.onDelete) return
  try {
    await props.onDelete()
  } catch (error) {
    console.error('[delete page] failed', error)
  }
}

function applyFormat(cmd: string, value?: string) {
  if (savedRange) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange)
  }
  document.execCommand(cmd, false, value)
  hideFormatBar()
}

function showFormatBar(rect: DOMRect) {
  if (selectedBlockRange.value) {
    const range = selectedBlockRange.value
    formatBar.mode = 'deleteBlocks'
    formatBar.blockCount = range.end - range.start + 1
    formatBar.x = rect.left + rect.width / 2
    formatBar.y = rect.top + window.scrollY
    formatBar.visible = true
    return
  }

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange()
    formatBar.mode = 'format'
    formatBar.x = rect.left + rect.width / 2
    formatBar.y = rect.top + window.scrollY
    formatBar.visible = true
  }
}

function onShowFormatBarEvent(e: Event) {
  const target = e.target as HTMLElement | null
  if (!target) return
  showFormatBar(target.getBoundingClientRect())
}

function hideFormatBar() {
  formatBar.visible = false
  savedRange = null
}

function onDocumentClick(e: MouseEvent) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) hideFormatBar()
}

function onArticlePatch(patch: Partial<PageState>) {
  Object.assign(article, patch)
}

async function uploadImageFile(raw: File): Promise<string | null> {
  try {
    const file = await compressImageForUpload(raw, { t })
    const uploaded = await props.onUploadImage(file)
    return uploaded.url
  } catch (error: any) {
    toast.add({ title: error?.message || t('pages.editor.uploadFailed'), color: 'red' })
    return null
  }
}

async function uploadOgImage(file: File) {
  const url = await uploadImageFile(file)
  if (!url) return
  article.ogImage = url
  isDirty.value = true
}

async function uploadFeaturedImage(file: File) {
  const url = await uploadImageFile(file)
  if (!url) return
  article.featuredImage = url
  isDirty.value = true
}

async function uploadInlineImage(payload: { blockId: string; file: File }) {
  const url = await uploadImageFile(payload.file)
  if (!url) return
  const blockIndex = blocks.value.findIndex((item) => String(item.id) === String(payload.blockId))
  const block = blockIndex >= 0 ? blocks.value[blockIndex] : null
  if (!block || String(block.type) !== 'image') return
  blocks.value[blockIndex] = { ...block, attrs: { ...block.attrs, src: url } }
  isDirty.value = true
  toast.add({ title: t('pages.editor.imageUploaded'), color: 'green' })
}

// ─── Block type label ─────────────────────────────────────────────────────
function blockTypeLabel(type: string) {
  const map: Record<string, string> = {
    paragraph: '¶', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5',
    quote: '"', ul: 'UL', ol: 'OL', image: 'IMG',
    callout: 'ℹ', spoiler: 'S', spoiler_open: 'S+', spoiler_close: 'S-', divider: '—', html: '</>',
    button: 'BTN', faq: 'FAQ', hero: 'HERO', columns: 'COL', gallery: 'IMG+', cta: 'CTA', schema: 'SEO',
  }
  return map[type] ?? type
}

// ─── Block style helpers ──────────────────────────────────────────────────
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

// ─── Actions ─────────────────────────────────────────────────────────────
const RAW_CONTENT_TYPES = ['divider', 'image', 'html', 'button', 'faq', 'global', 'hero', 'columns', 'gallery', 'cta', 'schema', ...BLOCK_FORM_TYPES]

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMeaningfulBlock(block: Block): boolean {
  const type = String(block?.type || '')
  if (type === 'divider') return true
  if (type === 'image') return String(block?.attrs?.src || '').trim().length > 0
  if (type === 'html') return stripHtml(String(block?.content || '')).length > 0
  if (type === 'button') return String(block?.attrs?.text || '').trim().length > 0 && String(block?.attrs?.href || '').trim().length > 0
  if (type === 'global') return String(block?.attrs?.ref || '').trim().length > 0
  if (type === 'hero' || type === 'cta') return ['title', 'subtitle', 'text', 'buttonText'].some(k => String(block?.attrs?.[k] || '').trim())
  if (BLOCK_FORM_TYPES.includes(type)) return JSON.stringify(block?.attrs || {}).replace(/["{}[\]:,]|false|true|null|""/g, '').trim().length > 0
  if (type === 'schema') return !!String(block?.attrs?.name || block?.attrs?.itemName || '').trim()
  if (type === 'columns') return (block?.attrs?.items || []).some((i: any) => String(i?.title || i?.text || '').trim())
  if (type === 'gallery') return (block?.attrs?.images || []).length > 0
  if (type === 'faq') {
    const items = Array.isArray(block?.attrs?.items) ? block.attrs.items : []
    return items.some((item: any) => String(item?.q || '').trim() || String(item?.a || '').trim())
  }
  return stripHtml(String(block?.content || '')).length > 0
}

function getPayload(syncDom = true) {
  if (syncDom) {
    for (const block of blocks.value) {
      const el = blockRefs.value.get(block.id)
      if (el && !RAW_CONTENT_TYPES.includes(block.type)) block.content = el.innerHTML
    }
  }
  const page: PageState = {
    ...article,
    title: (article.title || '').trim(),
    slug: (article.slug || '').trim(),
    metaTitle: (article.metaTitle || '').trim(),
    metaDescription: (article.metaDescription || '').trim(),
    canonicalPath: (article.canonicalPath || '').trim(),
  }
  const list = blocks.value
    .map((block) => ({
      ...block,
      content: RAW_CONTENT_TYPES.includes(String(block.type)) ? block.content : (block.content || '').trim(),
    }))
    .filter(isMeaningfulBlock)
  return { page, blocks: list }
}

function hydrateEditorDomFromState() {
  nextTick(() => {
    if (titleEl.value) titleEl.value.innerText = article.title || ''
    for (const block of blocks.value) {
      const el = blockRefs.value.get(block.id)
      if (!el) continue
      if (RAW_CONTENT_TYPES.includes(block.type)) continue
      if (el.innerHTML !== block.content) el.innerHTML = block.content || ''
    }
  })
}

async function saveDraft(): Promise<boolean> {
  if (!isDirty.value || isSaving.value) return true
  const payload = getPayload(true)
  if (!payload.page.title) {
    toast.add({ title: t('pages.editor.needTitle'), color: 'amber' })
    return false
  }
  if (!props.simple && !props.isHome && !payload.page.slug) {
    toast.add({ title: t('pages.editor.needSlug'), color: 'amber' })
    return false
  }
  isSaving.value = true
  try {
    await props.onSave({ page: { ...payload.page }, blocks: payload.blocks.map((b) => ({ ...b })) })
  } catch (error: any) {
    console.error('[save page] failed', error)
    toast.add({
      title: t('pages.editor.saveFailed'),
      description: error?.response?.errors?.[0]?.message || error?.message || t('common.errorRetry'),
      color: 'red',
    })
    isSaving.value = false
    return false
  }
  Object.assign(article, payload.page)
  isDirty.value = false
  setTimeout(() => { isSaving.value = false }, 300)
  toast.add({ title: t('pages.editor.savedToast'), color: 'green' })
  return true
}

function deletePage() {
  if (!props.onDelete) return
  openConfirmDialog('deletePage')
}

function markDirty() {
  if (isHydrating.value) return
  isDirty.value = true
}

function deleteBlock(i: number) {
  openConfirmDialog('deleteBlock', i)
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (selectedBlockRange.value && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault()
    deleteSelectedBlocks()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    saveDraft()
  }
  if (e.key === 'Escape') {
    picker.open = false
    hideFormatBar()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('selectionchange', onSelectionChange)
  window.addEventListener('beforeunload', onBeforeUnload)
  isHydrating.value = true
  if (!blocks.value.length) blocks.value.push(createBlock('paragraph'))
  hydrateEditorDomFromState()
  nextTick(() => {
    isHydrating.value = false
    watch(blocks, markDirty, { deep: true })
    watch(article, markDirty, { deep: true })
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('selectionchange', onSelectionChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

// ─── Exports for parent ───────────────────────────────────────────────────
defineExpose({ article, blocks, getPayload, saveDraft, isDirty })
</script>

<style scoped>
[contenteditable]:empty:before {
  pointer-events: none;
  user-select: none;
}

:deep(a) {
  color: rgb(37 99 235);
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(strong), :deep(b) {
  font-weight: 700;
}

:deep(input),
:deep(textarea),
:deep(select) {
  outline: none !important;
}

:deep(input:focus),
:deep(textarea:focus),
:deep(select:focus),
:deep(input:focus-visible),
:deep(textarea:focus-visible),
:deep(select:focus-visible) {
  outline: none !important;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35) !important;
}

:global(.dark) :deep(input:focus),
:global(.dark) :deep(textarea:focus),
:global(.dark) :deep(select:focus),
:global(.dark) :deep(input:focus-visible),
:global(.dark) :deep(textarea:focus-visible),
:global(.dark) :deep(select:focus-visible) {
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.45) !important;
}

.group[draggable="true"] {
  cursor: default;
}
</style>
