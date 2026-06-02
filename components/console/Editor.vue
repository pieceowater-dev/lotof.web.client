<template>
  <div class="publication-builder flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
    <!-- Header -->
    <ConsoleEditorHeader
      :mode="props.mode"
      :can-delete="props.mode === 'edit' && !!props.onDelete"
      :article="article"
      :blocks="blocks"
      :is-dirty="isDirty"
      :is-saving="isSaving"
      @save="saveDraft"
      @publish="publish"
      @delete="deletePublication"
      @toggle-sidebar="isMobileSidebarOpen = !isMobileSidebarOpen"
    />

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Canvas -->
      <ConsoleEditorCanvas
        ref="canvasRef"
        :article="article"
        :blocks="blocks"
        :active-block-id="activeBlockId"
        :drag-state="dragState"
        @update:article="onArticlePatch"
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
        @show-format-bar-event="onShowFormatBarEvent"
        @click-self="activeBlockId = null"
      />

      <!-- Desktop Sidebar -->
      <ConsoleEditorSidebar
        :article="article"
        :blocks="blocks"
        @update:article="onArticlePatch"
        @add-block="openPicker(blocks.length)"
        @clear="clearAllConfirm"
      />

      <!-- Mobile Sidebar -->
      <Teleport to="body">
        <ConsoleEditorMobileSidebar
          v-if="isMobileSidebarOpen"
          :article="article"
          :blocks="blocks"
          @update:article="onArticlePatch"
          @add-block="openPicker(blocks.length)"
          @clear="clearAllConfirm"
          @close="isMobileSidebarOpen = false"
        />
      </Teleport>
    </div>

    <!-- Floating Buttons (Mobile) -->
    <ConsoleEditorFloatingButtons
      v-if="!isMobileSidebarOpen"
      @add-block="openPicker(blocks.length)"
      @toggle-sidebar="isMobileSidebarOpen = true"
    />

    <!-- Block Picker -->
    <ConsoleBlockPickerModal
      :open="picker.open"
      @update:open="picker.open = $event"
      @add="insertBlock(picker.atIndex, $event)"
    />

    <!-- Format Toolbar -->
    <ConsoleFormatToolbar
      :format-bar="formatBar"
      @hide="hideFormatBar"
      @apply-format="applyFormat"
    />

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <ConsoleEditorConfirmDialog
        :open="confirmDialog.open"
        :title="confirmDialog.title"
        :message="confirmDialog.message"
        :confirm-label="confirmDialog.confirmLabel"
        :cancel-label="confirmDialog.cancelLabel"
        :variant="confirmDialog.variant"
        @confirm="runConfirmAction"
        @cancel="confirmDialog.open = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()
const toast = useToast()

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function formatDateTimeLocal(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function transliterateCyrillic(value: string): string {
  let out = ''
  for (const ch of String(value || '').toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch
  }
  return out
}

function slugify(value: string): string {
  return transliterateCyrillic(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

// ─── Types ───────────────────────────────────────────────────────────────
interface Block {
  id: string
  type: string
  content: string
  attrs: Record<string, any>
}

interface ArticleState {
  title: string
  slug: string
  status: 'draft' | 'published'
  category: string
  author: string
  authorUrl: string
  authorRole: string
  publishedAt: string
  updatedAt: string
  featuredImage: string
  tags: string[]
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImage: string
  schemaType: 'Article' | 'NewsArticle' | 'BlogPosting'
  sourceUrl: string
  sourceName: string
  reviewedBy: string
  reviewedByUrl: string
  reviewedDate: string
  publisherName: string
  publisherUrl: string
  publisherLogo: string
  robots: string
}

// Props
interface Props {
  mode?: 'create' | 'edit'
  initialArticle?: Partial<ArticleState>
  initialBlocks?: Block[]
  storageKey?: string
  useLocalDraft?: boolean
  onSave?: (payload: { article: ArticleState; blocks: Block[] }) => Promise<void> | void
  onPublish?: (payload: { article: ArticleState; blocks: Block[] }) => Promise<void> | void
  onDelete?: () => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  initialArticle: () => ({}),
  initialBlocks: () => [],
  storageKey: 'publication_editor_draft',
  useLocalDraft: true,
  onSave: undefined,
  onPublish: undefined,
  onDelete: undefined,
})

// ─── Article state ────────────────────────────────────────────────────────
const article = reactive<ArticleState>({
  title: props.initialArticle.title || '',
  slug: props.initialArticle.slug || '',
  status: (props.initialArticle.status as any) || 'draft',
  category: props.initialArticle.category || 'news',
  author: props.initialArticle.author || '',
  authorUrl: (props.initialArticle as any).authorUrl || '',
  authorRole: (props.initialArticle as any).authorRole || '',
  publishedAt: props.initialArticle.publishedAt || formatDateTimeLocal(),
  updatedAt: (props.initialArticle as any).updatedAt || '',
  featuredImage: props.initialArticle.featuredImage || '',
  tags: props.initialArticle.tags || [],
  focusKeyword: (props.initialArticle as any).focusKeyword || '',
  metaTitle: props.initialArticle.metaTitle || '',
  metaDescription: props.initialArticle.metaDescription || '',
  canonicalUrl: (props.initialArticle as any).canonicalUrl || '',
  ogImage: props.initialArticle.ogImage || '',
  schemaType: ((props.initialArticle as any).schemaType as any) || 'Article',
  sourceUrl: (props.initialArticle as any).sourceUrl || '',
  sourceName: (props.initialArticle as any).sourceName || '',
  reviewedBy: (props.initialArticle as any).reviewedBy || '',
  reviewedByUrl: (props.initialArticle as any).reviewedByUrl || '',
  reviewedDate: (props.initialArticle as any).reviewedDate || '',
  publisherName: (props.initialArticle as any).publisherName || 'Lota',
  publisherUrl: (props.initialArticle as any).publisherUrl || '',
  publisherLogo: (props.initialArticle as any).publisherLogo || '',
  robots: props.initialArticle.robots || 'index',
})

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
      : {}

  const content = type === 'ul'
    ? '<li>Элемент</li>'
    : type === 'ol'
      ? '<li>Элемент</li>'
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
  scheduleAutosave()
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
const formatBar = reactive({ visible: false, x: 0, y: 0 })
let savedRange: Range | null = null
const isSlugManuallyEdited = ref(false)

const SAVE_DEBOUNCE_MS = 500
let saveTimer: ReturnType<typeof setTimeout> | null = null
const isHydrating = ref(false)
const isDirty = ref(false)
const isSaving = ref(false)
const isSavingManually = ref(false)
const isMobileSidebarOpen = ref(false)

const confirmDialog = reactive({
  open: false,
  type: 'clear' as 'clear' | 'deleteBlock' | 'deletePublication',
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: '',
  variant: 'danger' as 'danger' | 'primary',
})

const pendingDeleteBlockIndex = ref<number | null>(null)

function openConfirmDialog(type: 'clear' | 'deleteBlock' | 'deletePublication', blockIndex?: number) {
  pendingDeleteBlockIndex.value = null

  if (type === 'clear') {
    confirmDialog.type = 'clear'
    confirmDialog.title = 'Очистить весь контент?'
    confirmDialog.message = 'Это удалит всю статью из редактора. Действие нельзя отменить.'
    confirmDialog.confirmLabel = 'Очистить'
    confirmDialog.cancelLabel = 'Отмена'
    confirmDialog.variant = 'danger'
  } else if (type === 'deleteBlock') {
    confirmDialog.type = 'deleteBlock'
    confirmDialog.title = 'Удалить блок?'
    confirmDialog.message = 'Это действие нельзя отменить.'
    confirmDialog.confirmLabel = 'Удалить'
    confirmDialog.cancelLabel = 'Отмена'
    confirmDialog.variant = 'danger'
    pendingDeleteBlockIndex.value = typeof blockIndex === 'number' ? blockIndex : null
  } else {
    confirmDialog.type = 'deletePublication'
    confirmDialog.title = 'Архивировать публикацию?'
    confirmDialog.message = 'Публикация исчезнет из списков и публичной выдачи.'
    confirmDialog.confirmLabel = 'Архивировать'
    confirmDialog.cancelLabel = 'Отмена'
    confirmDialog.variant = 'danger'
  }
  confirmDialog.open = true
}

async function runConfirmAction() {
  const type = confirmDialog.type
  confirmDialog.open = false

  if (type === 'clear') {
    performClearAll()
    return
  }

  if (type === 'deleteBlock') {
    const index = pendingDeleteBlockIndex.value
    pendingDeleteBlockIndex.value = null
    if (index === null || index < 0 || index >= blocks.value.length) return
    blocks.value.splice(index, 1)
    scheduleAutosave()
    return
  }

  if (type === 'deletePublication') {
    if (!props.onDelete) return
    try {
      await props.onDelete()
    } catch (error) {
      console.error('[delete publication] failed', error)
    }
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
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange()
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

// ─── SEO helpers ──────────────────────────────────────────────────────────
const seoScore = computed(() => {
  let score = 0
  if (article.metaTitle) score += 15
  if (article.metaTitle.length >= 30 && article.metaTitle.length <= 60) score += 15
  if (article.metaDescription) score += 15
  if (article.metaDescription.length >= 120 && article.metaDescription.length <= 160) score += 15
  if (article.slug) score += 10
  if (blocks.value.some(b => b.type === 'image' && b.attrs.alt)) score += 10
  return score
})

function syncSlug() {
  if (isSlugManuallyEdited.value) return
  const title = article.title.trim()
  if (!title) {
    article.slug = ''
    return
  }
  article.slug = slugify(title)
}

function generateSlugFromTitle(title: string): string {
  return slugify(title)
}

function onArticlePatch(patch: Partial<ArticleState>) {
  if (Object.prototype.hasOwnProperty.call(patch, 'slug')) {
    isSlugManuallyEdited.value = true
    const incoming = slugify(String(patch.slug || ''))
    Object.assign(article, { ...patch, slug: incoming })
    return
  }

  Object.assign(article, patch)
}

// ─── Block type label ─────────────────────────────────────────────────────
function blockTypeLabel(type: string) {
  const map: Record<string, string> = {
    paragraph: '¶', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5',
    quote: '"', ul: 'UL', ol: 'OL', image: 'IMG',
    callout: 'ℹ', spoiler: 'S', spoiler_open: 'S+', spoiler_close: 'S-', divider: '—', html: '</>',
  }
  return map[type] ?? type
}

// ─── Block style helpers ──────────────────────────────────────────────────
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

// ─── Actions ─────────────────────────────────────────────────────────────
function getPayload(syncDom = true) {
  if (syncDom) {
    for (const block of blocks.value) {
      const el = blockRefs.value.get(block.id)
      if (el && block.type !== 'divider' && block.type !== 'image' && block.type !== 'html' && block.type !== 'spoiler_open' && block.type !== 'spoiler_close') {
        block.content = el.innerHTML
      }
    }
  }
  
  const trimmedArticle = { ...article }
  trimmedArticle.title = (trimmedArticle.title || '').trim()
  trimmedArticle.slug = (trimmedArticle.slug || '').trim()
  trimmedArticle.author = (trimmedArticle.author || '').trim()
  trimmedArticle.metaTitle = (trimmedArticle.metaTitle || '').trim()
  trimmedArticle.metaDescription = (trimmedArticle.metaDescription || '').trim()

  const normalizedBlocks = blocks.value.map(block => {
    const type = String(block.type || '')
    return {
      ...block,
      attrs: type === 'spoiler' || type === 'spoiler_open' || type === 'spoiler_close'
        ? {}
        : block.attrs,
      content: ['divider', 'image', 'html', 'spoiler_open', 'spoiler_close'].includes(type)
        ? block.content
        : (block.content || '').trim()
    }
  })

  const trimmedBlocks = normalizedBlocks.filter(isMeaningfulBlock)

  if (!trimmedBlocks.length) {
    trimmedBlocks.push(createBlock('paragraph'))
  }
  
  return { article: trimmedArticle, blocks: trimmedBlocks }
}

function isMeaningfulBlock(block: Block): boolean {
  const type = String(block?.type || '')

  if (type === 'divider') return true

  if (type === 'spoiler_open' || type === 'spoiler_close') return true

  // Keep spoiler blocks even while empty so user can type after insertion.
  if (type === 'spoiler') return true

  if (type === 'image') {
    const src = String(block?.attrs?.src || '').trim()
    return src.length > 0
  }

  if (type === 'html') {
    return stripHtml(String(block?.content || '')).length > 0
  }

  if (type === 'ul' || type === 'ol') {
    const text = stripHtml(String(block?.content || ''))
    return text.length > 0
  }

  return stripHtml(String(block?.content || '')).length > 0
}

function getMissingRequiredFields(action: 'save' | 'publish', payload: ReturnType<typeof getPayload>) {
  const missing: string[] = []
  const articleState = payload.article

  if (!articleState.title) missing.push('title')
  if (!articleState.author) missing.push('author')

  return missing
}

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

function firstNonEmptyBlockText(list: Block[]): string {
  for (const block of list) {
    const text = stripHtml(block?.content || '')
    if (text) return text
  }
  return ''
}

function applyPublishAutofill(payload: ReturnType<typeof getPayload>) {
  const nextArticle = { ...payload.article }

  if (!nextArticle.slug) {
    nextArticle.slug = generateSlugFromTitle(nextArticle.title)
  }

  if (!nextArticle.category) {
    nextArticle.category = 'news'
  }

  if (!nextArticle.publishedAt) {
    nextArticle.publishedAt = formatDateTimeLocal()
  }

  if (!nextArticle.metaTitle) {
    nextArticle.metaTitle = nextArticle.title
  }

  if (!nextArticle.metaDescription) {
    const fallback = firstNonEmptyBlockText(payload.blocks as Block[])
    nextArticle.metaDescription = (fallback || nextArticle.title).slice(0, 160)
  }

  return {
    article: nextArticle,
    blocks: payload.blocks,
  }
}

function showRequiredFieldsError(action: 'save' | 'publish', missing: string[]) {
  toast.add({
    title: action === 'publish' ? 'Нельзя опубликовать' : 'Нельзя сохранить',
    description: `Заполните обязательные поля: ${missing.join(', ')}`,
    color: 'red',
  })
}

function hydrateEditorDomFromState() {
  nextTick(() => {
    if (titleEl.value) {
      titleEl.value.innerText = article.title || ''
    }

    for (const block of blocks.value) {
      const el = blockRefs.value.get(block.id)
      if (!el) continue
      if (block.type === 'divider' || block.type === 'image' || block.type === 'html' || block.type === 'spoiler_open' || block.type === 'spoiler_close') continue
      if (el.innerHTML !== block.content) {
        el.innerHTML = block.content || ''
      }
    }
  })
}

async function saveDraft() {
  if (!isDirty.value) return
  const payload = getPayload(true)

  article.status = 'draft'
  isSaving.value = true
  isSavingManually.value = true
  Object.assign(article, payload.article)
  blocks.value = payload.blocks

  try {
    if (props.onSave) {
      await props.onSave({ article: { ...payload.article }, blocks: [...payload.blocks] })
    } else if (props.mode === 'create') {
      toast.add({
        title: 'Локальный черновик сохранен',
        color: 'green',
      })
    }
  } catch (error) {
    console.error('[save draft] failed', error)
  }

  saveToLocalStorage(false)
  isDirty.value = false
  nextTick(() => {
    isSavingManually.value = false
  })
  setTimeout(() => {
    isSaving.value = false
  }, 600)
}

async function publish() {
  const payload = applyPublishAutofill(getPayload(true))
  const missing = getMissingRequiredFields('publish', payload)
  if (missing.length) {
    showRequiredFieldsError('publish', missing)
    return
  }

  article.status = 'published'
  Object.assign(article, payload.article)
  blocks.value = payload.blocks

  try {
    if (props.onPublish) {
      await props.onPublish({ article: { ...payload.article }, blocks: [...payload.blocks] })
    }
  } catch (error) {
    console.error('[publish] failed', error)
  }

  if (props.mode === 'create') {
    saveToLocalStorage(false)
  } else {
    localStorage.removeItem(STORAGE_KEY.value)
  }
  isDirty.value = false
}

async function deletePublication() {
  if (!props.onDelete) return
  openConfirmDialog('deletePublication')
}

// ─── LocalStorage ─────────────────────────────────────────────────────────
const STORAGE_KEY = computed(() => props.storageKey || 'publication_editor_draft')

function saveToLocalStorage(syncDom = false) {
  const data = getPayload(syncDom)
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save to localStorage', e)
  }
}

function scheduleAutosave() {
  if (isHydrating.value) return
  if (isSavingManually.value) return
  isDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    isSaving.value = true
    const payload = getPayload(true)
    Object.assign(article, payload.article)
    blocks.value = payload.blocks
    saveToLocalStorage(false)
    saveTimer = null
    setTimeout(() => {
      isSaving.value = false
    }, 400)
  }, SAVE_DEBOUNCE_MS)
}

function loadFromLocalStorage() {
  if (!props.useLocalDraft) return false
  try {
    const saved = localStorage.getItem(STORAGE_KEY.value)
    if (!saved) return false
    const data = JSON.parse(saved)
    if (data.article && data.blocks) {
      const loadedTitle = String(data.article.title || '').trim()
      const loadedSlug = String(data.article.slug || '').trim()
      const generatedFromTitle = generateSlugFromTitle(loadedTitle)

      if (!loadedTitle || loadedSlug.length <= 1) {
        data.article.slug = ''
        isSlugManuallyEdited.value = false
      } else if (!loadedSlug || loadedSlug === generatedFromTitle) {
        isSlugManuallyEdited.value = false
      } else {
        isSlugManuallyEdited.value = true
      }

      Object.assign(article, data.article)
      blocks.value = data.blocks
      return true
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e)
  }
  return false
}

function deleteBlock(i: number) {
  openConfirmDialog('deleteBlock', i)
}

function clearAllConfirm() {
  openConfirmDialog('clear')
}

function performClearAll() {
  blocks.value = [createBlock('paragraph')]
  article.title = ''
  article.slug = ''
  article.focusKeyword = ''
  article.metaTitle = ''
  article.metaDescription = ''
  article.canonicalUrl = ''
  article.ogImage = ''
  article.tags = []
  article.category = 'news'
  article.author = ''
  article.authorUrl = ''
  article.authorRole = ''
  article.sourceUrl = ''
  article.sourceName = ''
  article.reviewedBy = ''
  article.reviewedByUrl = ''
  article.reviewedDate = ''
  article.updatedAt = ''
  article.schemaType = 'Article'
  article.publisherName = 'Lota'
  article.publisherUrl = ''
  article.publisherLogo = ''
  article.status = 'draft'
  article.publishedAt = formatDateTimeLocal()
  isSlugManuallyEdited.value = false
  localStorage.removeItem(STORAGE_KEY.value)
  isDirty.value = false
  nextTick(() => titleEl.value?.focus())
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    saveDraft()
  }
  if (e.key === 'Escape') {
    picker.open = false
    hideFormatBar()
    confirmDialog.open = false
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault()
    window.location.reload()
  }

  if (e.key === 'F5') {
    e.preventDefault()
    window.location.reload()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocumentClick)
  isHydrating.value = true
  if (!loadFromLocalStorage()) {
    const first = createBlock('paragraph')
    blocks.value.push(first)
  }

  hydrateEditorDomFromState()

  nextTick(() => {
    isHydrating.value = false
    watch(blocks, scheduleAutosave, { deep: true })
    watch(article, scheduleAutosave, { deep: true })
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocumentClick)
  if (saveTimer) clearTimeout(saveTimer)
})

watch(() => article.title, () => {
  syncSlug()
})

// ─── Exports for parent ───────────────────────────────────────────────────
defineExpose({
  article,
  blocks,
  getPayload,
  saveDraft,
  publish,
})
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
