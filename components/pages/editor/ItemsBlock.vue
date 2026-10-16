<script setup lang="ts">
// Form of the list-style section blocks (accordion, tabs, pricing, testimonials, stats, steps, logos, contacts, map).
// What each block asks for is described in utils/pagesBlockForms.ts.
import { useI18n } from '@/composables/useI18n'
import { BLOCK_FORMS, type FormField } from '@/utils/pagesBlockForms'

interface Block { id: string; type: string; content: string; attrs: Record<string, any> }

const props = defineProps<{
  block: Block
  upload: (file: File) => Promise<{ url: string }>
  resolve: (src: string) => string
}>()
const { t } = useI18n()
const toast = useToast()
const form = computed(() => BLOCK_FORMS[props.block.type])
const attrs = computed(() => props.block.attrs)
const items = computed<any[]>(() => (Array.isArray(attrs.value.items) ? attrs.value.items : []))
const busy = ref(false)

const label = (f: FormField) => t(`pages.editor.f.${f.key}`)
const setText = (o: Record<string, any>, k: string, e: Event) => { o[k] = (e.target as HTMLInputElement | HTMLTextAreaElement).value }

function addItem() {
  const f = form.value?.items
  if (!f || items.value.length >= f.max) return
  if (!Array.isArray(attrs.value.items)) attrs.value.items = []
  attrs.value.items.push(Object.fromEntries(f.fields.map(x => [x.key, x.kind === 'bool' ? false : ''])))
}

async function onImage(target: Record<string, any>, key: string, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  try { target[key] = (await props.upload(file)).url } catch (err: any) {
    toast.add({ title: t('common.error'), description: err?.message || undefined, color: 'red' })
  } finally { busy.value = false }
}
</script>

<template>
  <div v-if="form" class="py-1">
    <div class="pe-tray">
      <div class="pe-tray-title"><Icon :name="form.icon" class="h-3.5 w-3.5" />{{ t(`pages.editor.sec.${block.type}`) }}</div>

      <div v-if="form.fields" class="grid gap-2 sm:grid-cols-2">
        <template v-for="f in form.fields" :key="f.key">
          <textarea v-if="f.kind === 'textarea'" :value="attrs[f.key] || ''" rows="2" :placeholder="label(f)" class="pe-field sm:col-span-2" @input="setText(attrs, f.key, $event)" />
          <input v-else :value="attrs[f.key] || ''" :placeholder="label(f)" class="pe-field" @input="setText(attrs, f.key, $event)">
        </template>
      </div>

      <div v-if="form.pills" class="mt-2 flex flex-wrap items-center gap-2">
        <button v-for="v in form.pills.values" :key="v" type="button" class="pe-pill" :class="(attrs[form.pills.key] || 'normal') === v && 'pe-pill--on'" @click="attrs[form.pills.key] = v">{{ t(`pages.editor.f.${form.pills.key}_${v}`) }}</button>
      </div>

      <div v-if="form.items" class="space-y-3">
        <div v-for="(it, i) in items" :key="i" class="rounded-3xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]">
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">{{ t('pages.editor.sec.card', { n: i + 1 }) }}</span>
            <button type="button" class="pe-pill pe-pill--danger" @click="items.splice(i, 1)">{{ t('pages.editor.sec.remove') }}</button>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <template v-for="f in form.items.fields" :key="f.key">
              <textarea v-if="f.kind === 'textarea'" :value="it[f.key] || ''" rows="2" :placeholder="label(f)" class="pe-field sm:col-span-2" @input="setText(it, f.key, $event)" />
              <label v-else-if="f.kind === 'bool'" class="pe-pill w-fit cursor-pointer" :class="it[f.key] && 'pe-pill--on'">
                <input v-model="it[f.key]" type="checkbox" class="hidden">{{ label(f) }}
              </label>
              <div v-else-if="f.kind === 'image'" class="flex items-center gap-2 sm:col-span-2">
                <img v-if="it[f.key]" :src="resolve(it[f.key])" alt="" class="h-10 w-16 rounded-lg object-contain">
                <input :value="it[f.key] || ''" :placeholder="label(f)" class="pe-field flex-1" @input="setText(it, f.key, $event)">
                <label class="pe-pill pe-pill--on cursor-pointer">{{ busy ? '…' : t('pages.editor.sec.addImage') }}<input type="file" accept="image/*" class="hidden" @change="onImage(it, f.key, $event)"></label>
              </div>
              <input v-else :value="it[f.key] || ''" :placeholder="label(f)" class="pe-field" @input="setText(it, f.key, $event)">
            </template>
          </div>
        </div>
        <button v-if="items.length < form.items.max" type="button" class="pe-pill pe-pill--on" @click="addItem">+ {{ t('pages.editor.sec.addCard') }}</button>
      </div>
    </div>
  </div>
</template>
