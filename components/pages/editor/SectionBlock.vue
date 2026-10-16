<script setup lang="ts">
// Editing form of the section blocks: hero, columns, gallery, call to action. Everything is stored in block.attrs.
import { useI18n } from '@/composables/useI18n'

interface Block { id: string; type: string; content: string; attrs: Record<string, any> }

const props = defineProps<{
  block: Block
  upload: (file: File) => Promise<{ url: string }>
  resolve: (src: string) => string
}>()

const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const attrs = computed(() => props.block.attrs)

const listKey = computed(() => (props.block.type === 'gallery' ? 'images' : 'items'))
const items = computed<any[]>(() => (Array.isArray(attrs.value[listKey.value]) ? attrs.value[listKey.value] : []))
// a block saved without its list gets one on the first edit
const ensureList = () => { if (!Array.isArray(attrs.value[listKey.value])) attrs.value[listKey.value] = [] }
const setField = (o: Record<string, any>, k: string, e: Event) => { o[k] = (e.target as HTMLInputElement | HTMLTextAreaElement).value }

async function pick(file: File | undefined): Promise<string> {
  if (!file) return ''
  busy.value = true
  try { return (await props.upload(file)).url } catch (e: any) {
    toast.add({ title: t('common.error'), description: e?.message || undefined, color: 'red' })
    return ''
  } finally { busy.value = false }
}
async function onImage(target: Record<string, any>, key: string, e: Event) {
  const input = e.target as HTMLInputElement
  const url = await pick(input.files?.[0])
  input.value = ''
  if (url) target[key] = url
}
async function onGallery(e: Event) {
  const input = e.target as HTMLInputElement
  for (const f of Array.from(input.files || [])) {
    const url = await pick(f)
    if (url) { ensureList(); items.value.push({ src: url, alt: '' }) }
  }
  input.value = ''
}

const layouts = ['center', 'split', 'cover']
const colsOpts = ['2', '3', '4']
</script>

<template>
  <div class="py-1">
    <div class="pe-tray">
      <div class="pe-tray-title">
        <Icon :name="{ hero: 'lucide:panel-top', columns: 'lucide:columns-3', gallery: 'lucide:images', cta: 'lucide:megaphone' }[block.type] || 'lucide:layout'" class="h-3.5 w-3.5" />{{ t(`pages.editor.sec.${block.type}`) }}
      </div>

      <div v-if="block.type === 'hero'" class="grid gap-2">
        <input :value="attrs.title || ''" :placeholder="t('pages.editor.sec.title')" class="pe-field" @input="setField(attrs, 'title', $event)">
        <textarea :value="attrs.subtitle || ''" rows="2" :placeholder="t('pages.editor.sec.subtitle')" class="pe-field" @input="setField(attrs, 'subtitle', $event)" />
        <div class="grid gap-2 sm:grid-cols-2">
          <input :value="attrs.buttonText || ''" :placeholder="t('pages.editor.sec.button')" class="pe-field" @input="setField(attrs, 'buttonText', $event)">
          <input :value="attrs.buttonHref || ''" :placeholder="t('pages.editor.sec.link')" class="pe-field" @input="setField(attrs, 'buttonHref', $event)">
          <input :value="attrs.button2Text || ''" :placeholder="t('pages.editor.sec.button2')" class="pe-field" @input="setField(attrs, 'button2Text', $event)">
          <input :value="attrs.button2Href || ''" :placeholder="t('pages.editor.sec.link')" class="pe-field" @input="setField(attrs, 'button2Href', $event)">
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button v-for="l in layouts" :key="l" type="button" class="pe-pill" :class="(attrs.layout || 'center') === l && 'pe-pill--on'" @click="attrs.layout = l">{{ t(`pages.editor.sec.layout_${l}`) }}</button>
        </div>
        <div v-if="(attrs.layout || 'center') !== 'center'" class="flex items-center gap-3">
          <img v-if="attrs.image" :src="resolve(attrs.image)" alt="" class="h-16 w-24 rounded-xl object-cover">
          <label class="pe-pill pe-pill--on cursor-pointer">
            {{ busy ? '…' : attrs.image ? t('pages.editor.sec.replaceImage') : t('pages.editor.sec.addImage') }}
            <input type="file" accept="image/*" class="hidden" @change="onImage(attrs, 'image', $event)">
          </label>
          <button v-if="attrs.image" type="button" class="pe-pill pe-pill--danger" @click="attrs.image = ''">{{ t('pages.editor.sec.remove') }}</button>
        </div>
      </div>

      <div v-else-if="block.type === 'cta'" class="grid gap-2">
        <input :value="attrs.title || ''" :placeholder="t('pages.editor.sec.title')" class="pe-field" @input="setField(attrs, 'title', $event)">
        <textarea :value="attrs.text || ''" rows="2" :placeholder="t('pages.editor.sec.text')" class="pe-field" @input="setField(attrs, 'text', $event)" />
        <div class="grid gap-2 sm:grid-cols-2">
          <input :value="attrs.buttonText || ''" :placeholder="t('pages.editor.sec.button')" class="pe-field" @input="setField(attrs, 'buttonText', $event)">
          <input :value="attrs.buttonHref || ''" :placeholder="t('pages.editor.sec.link')" class="pe-field" @input="setField(attrs, 'buttonHref', $event)">
        </div>
      </div>

      <div v-else-if="block.type === 'columns'" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500 dark:text-neutral-400">{{ t('pages.editor.sec.cols') }}</span>
          <button v-for="n in colsOpts" :key="n" type="button" class="pe-pill" :class="String(attrs.cols || '3') === n && 'pe-pill--on'" @click="attrs.cols = n">{{ n }}</button>
        </div>
        <div v-for="(it, i) in items" :key="i" class="rounded-3xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]">
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">{{ t('pages.editor.sec.card', { n: i + 1 }) }}</span>
            <button type="button" class="pe-pill pe-pill--danger" @click="items.splice(i, 1)">{{ t('pages.editor.sec.remove') }}</button>
          </div>
          <div class="grid gap-2 sm:grid-cols-[5rem_1fr]">
            <input :value="it.icon || ''" maxlength="4" :placeholder="t('pages.editor.sec.icon')" class="pe-field text-center" @input="setField(it, 'icon', $event)">
            <input :value="it.title || ''" :placeholder="t('pages.editor.sec.title')" class="pe-field" @input="setField(it, 'title', $event)">
          </div>
          <textarea :value="it.text || ''" rows="2" :placeholder="t('pages.editor.sec.text')" class="pe-field mt-2" @input="setField(it, 'text', $event)" />
        </div>
        <button type="button" class="pe-pill pe-pill--on" @click="ensureList(); items.push({ icon: '', title: '', text: '' })">+ {{ t('pages.editor.sec.addCard') }}</button>
      </div>

      <div v-else-if="block.type === 'gallery'" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500 dark:text-neutral-400">{{ t('pages.editor.sec.cols') }}</span>
          <button v-for="n in colsOpts" :key="n" type="button" class="pe-pill" :class="String(attrs.cols || '3') === n && 'pe-pill--on'" @click="attrs.cols = n">{{ n }}</button>
        </div>
        <div v-if="items.length" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div v-for="(it, i) in items" :key="i" class="relative">
            <img :src="resolve(it.src)" alt="" class="aspect-[4/3] w-full rounded-2xl object-cover" style="aspect-ratio: 4 / 3">
            <button type="button" class="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white" :aria-label="t('pages.editor.sec.remove')" @click="items.splice(i, 1)">×</button>
            <input :value="it.alt || ''" :placeholder="t('pages.editor.sec.alt')" class="pe-field mt-1 !py-1 text-xs" @input="setField(it, 'alt', $event)">
          </div>
        </div>
        <label class="pe-pill pe-pill--on inline-flex cursor-pointer">
          {{ busy ? '…' : '+ ' + t('pages.editor.sec.addImages') }}
          <input type="file" accept="image/*" multiple class="hidden" @change="onGallery">
        </label>
      </div>
    </div>
  </div>
</template>
