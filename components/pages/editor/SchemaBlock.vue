<script setup lang="ts">
// Structured data for search engines (schema.org): a form that shows nothing on the page. The server turns the
// fields into JSON-LD for LocalBusiness, Product, Review or Event.
import { useI18n } from '@/composables/useI18n'

interface Block { id: string; type: string; content: string; attrs: Record<string, any> }

const props = defineProps<{ block: Block; resolve: (src: string) => string }>()
const { t } = useI18n()
const attrs = computed(() => props.block.attrs)

const KINDS = ['LocalBusiness', 'Product', 'Review', 'Event'] as const
const BUSINESS_TYPES = ['LocalBusiness', 'Store', 'ElectronicsStore', 'AutoRepair', 'BeautySalon', 'HairSalon', 'Restaurant', 'CafeOrCoffeeShop', 'Dentist', 'MedicalClinic', 'SportsActivityLocation', 'ProfessionalService', 'HomeAndConstructionBusiness']
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const AVAILABILITY = ['InStock', 'OutOfStock', 'PreOrder', 'LimitedAvailability']
const ITEM_TYPES = ['LocalBusiness', 'Product', 'Service']

const kind = computed(() => String(attrs.value.kind || 'LocalBusiness'))
const set = (k: string, e: Event) => { attrs.value[k] = (e.target as HTMLInputElement | HTMLTextAreaElement).value }
const setHour = (day: string, e: Event) => {
  const hours = { ...(attrs.value.hours || {}) }
  const v = (e.target as HTMLInputElement).value
  if (v) hours[day] = v; else delete hours[day]
  attrs.value.hours = hours
}
const hour = (day: string) => String(attrs.value.hours?.[day] || '')
</script>

<template>
  <div class="py-1">
    <div class="pe-tray">
      <div class="pe-tray-title"><Icon name="lucide:badge-check" class="h-3.5 w-3.5" />{{ t('pages.editor.schema.title') }}</div>
      <p class="mb-3 text-xs text-slate-500 dark:text-neutral-400">{{ t('pages.editor.schema.hint') }}</p>

      <div class="mb-3 flex flex-wrap gap-2">
        <button v-for="k in KINDS" :key="k" type="button" class="pe-pill" :class="kind === k && 'pe-pill--on'" @click="attrs.kind = k">{{ t(`pages.editor.schema.kind_${k}`) }}</button>
      </div>

      <div v-if="kind === 'LocalBusiness'" class="grid gap-2">
        <div class="flex flex-wrap gap-1.5">
          <button v-for="b in BUSINESS_TYPES" :key="b" type="button" class="pe-pill" :class="(attrs.type || 'LocalBusiness') === b && 'pe-pill--on'" @click="attrs.type = b">{{ t(`pages.editor.schema.biz_${b}`) }}</button>
        </div>
        <input :value="attrs.name || ''" :placeholder="t('pages.editor.schema.name')" class="pe-field" @input="set('name', $event)">
        <div class="grid gap-2 sm:grid-cols-2">
          <input :value="attrs.phone || ''" :placeholder="t('pages.editor.schema.phone')" class="pe-field" @input="set('phone', $event)">
          <input :value="attrs.email || ''" :placeholder="t('pages.editor.schema.email')" class="pe-field" @input="set('email', $event)">
          <input :value="attrs.street || ''" :placeholder="t('pages.editor.schema.street')" class="pe-field sm:col-span-2" @input="set('street', $event)">
          <input :value="attrs.city || ''" :placeholder="t('pages.editor.schema.city')" class="pe-field" @input="set('city', $event)">
          <input :value="attrs.region || ''" :placeholder="t('pages.editor.schema.region')" class="pe-field" @input="set('region', $event)">
          <input :value="attrs.postalCode || ''" :placeholder="t('pages.editor.schema.postalCode')" class="pe-field" @input="set('postalCode', $event)">
          <input :value="attrs.country || ''" maxlength="2" :placeholder="t('pages.editor.schema.country')" class="pe-field" @input="set('country', $event)">
          <input :value="attrs.lat || ''" :placeholder="t('pages.editor.schema.lat')" class="pe-field" @input="set('lat', $event)">
          <input :value="attrs.lng || ''" :placeholder="t('pages.editor.schema.lng')" class="pe-field" @input="set('lng', $event)">
          <input :value="attrs.priceRange || ''" maxlength="30" :placeholder="t('pages.editor.schema.priceRange')" class="pe-field" @input="set('priceRange', $event)">
        </div>
        <div class="text-xs font-semibold text-slate-500 dark:text-neutral-400">{{ t('pages.editor.schema.hours') }}</div>
        <div class="grid gap-2 sm:grid-cols-4">
          <label v-for="d in DAYS" :key="d" class="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
            <span class="w-8">{{ t(`pages.editor.schema.day_${d}`) }}</span>
            <input :value="hour(d)" placeholder="09:00-18:00" class="pe-field !py-1.5 text-xs" @input="setHour(d, $event)">
          </label>
        </div>
        <textarea :value="attrs.sameAs || ''" rows="2" :placeholder="t('pages.editor.schema.sameAs')" class="pe-field" @input="set('sameAs', $event)" />
      </div>

      <div v-else-if="kind === 'Product'" class="grid gap-2">
        <input :value="attrs.name || ''" :placeholder="t('pages.editor.schema.productName')" class="pe-field" @input="set('name', $event)">
        <textarea :value="attrs.description || ''" rows="2" :placeholder="t('pages.editor.schema.description')" class="pe-field" @input="set('description', $event)" />
        <div class="grid gap-2 sm:grid-cols-3">
          <input :value="attrs.brand || ''" :placeholder="t('pages.editor.schema.brand')" class="pe-field" @input="set('brand', $event)">
          <input :value="attrs.sku || ''" :placeholder="t('pages.editor.schema.sku')" class="pe-field" @input="set('sku', $event)">
          <input :value="attrs.image || ''" :placeholder="t('pages.editor.schema.image')" class="pe-field" @input="set('image', $event)">
          <input :value="attrs.price || ''" :placeholder="t('pages.editor.schema.price')" class="pe-field" @input="set('price', $event)">
          <input :value="attrs.currency || ''" maxlength="3" :placeholder="t('pages.editor.schema.currency')" class="pe-field" @input="set('currency', $event)">
          <input :value="attrs.ratingValue || ''" :placeholder="t('pages.editor.schema.ratingValue')" class="pe-field" @input="set('ratingValue', $event)">
          <input :value="attrs.reviewCount || ''" :placeholder="t('pages.editor.schema.reviewCount')" class="pe-field" @input="set('reviewCount', $event)">
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="a in AVAILABILITY" :key="a" type="button" class="pe-pill" :class="attrs.availability === a && 'pe-pill--on'" @click="attrs.availability = a">{{ t(`pages.editor.schema.av_${a}`) }}</button>
        </div>
      </div>

      <div v-else-if="kind === 'Review'" class="grid gap-2">
        <div class="flex flex-wrap gap-1.5">
          <button v-for="i in ITEM_TYPES" :key="i" type="button" class="pe-pill" :class="(attrs.itemType || 'LocalBusiness') === i && 'pe-pill--on'" @click="attrs.itemType = i">{{ t(`pages.editor.schema.item_${i}`) }}</button>
        </div>
        <input :value="attrs.itemName || ''" :placeholder="t('pages.editor.schema.itemName')" class="pe-field" @input="set('itemName', $event)">
        <div class="grid gap-2 sm:grid-cols-3">
          <input :value="attrs.author || ''" :placeholder="t('pages.editor.schema.author')" class="pe-field" @input="set('author', $event)">
          <input :value="attrs.ratingValue || ''" :placeholder="t('pages.editor.schema.ratingValue')" class="pe-field" @input="set('ratingValue', $event)">
          <input :value="attrs.datePublished || ''" placeholder="2026-10-01" class="pe-field" @input="set('datePublished', $event)">
        </div>
        <textarea :value="attrs.reviewBody || ''" rows="3" :placeholder="t('pages.editor.schema.reviewBody')" class="pe-field" @input="set('reviewBody', $event)" />
      </div>

      <div v-else class="grid gap-2">
        <input :value="attrs.name || ''" :placeholder="t('pages.editor.schema.eventName')" class="pe-field" @input="set('name', $event)">
        <textarea :value="attrs.description || ''" rows="2" :placeholder="t('pages.editor.schema.description')" class="pe-field" @input="set('description', $event)" />
        <div class="grid gap-2 sm:grid-cols-2">
          <input :value="attrs.startDate || ''" placeholder="2026-11-01T18:00" class="pe-field" @input="set('startDate', $event)">
          <input :value="attrs.endDate || ''" placeholder="2026-11-01T20:00" class="pe-field" @input="set('endDate', $event)">
          <input :value="attrs.locationName || ''" :placeholder="t('pages.editor.schema.locationName')" class="pe-field" @input="set('locationName', $event)">
          <input :value="attrs.address || ''" :placeholder="t('pages.editor.schema.address')" class="pe-field" @input="set('address', $event)">
          <input :value="attrs.price || ''" :placeholder="t('pages.editor.schema.price')" class="pe-field" @input="set('price', $event)">
          <input :value="attrs.url || ''" :placeholder="t('pages.editor.schema.url')" class="pe-field" @input="set('url', $event)">
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="pe-pill" :class="attrs.attendance !== 'online' && 'pe-pill--on'" @click="attrs.attendance = 'offline'">{{ t('pages.editor.schema.offline') }}</button>
          <button type="button" class="pe-pill" :class="attrs.attendance === 'online' && 'pe-pill--on'" @click="attrs.attendance = 'online'">{{ t('pages.editor.schema.online') }}</button>
          <button type="button" class="pe-pill" :class="attrs.status === 'Cancelled' && 'pe-pill--on'" @click="attrs.status = attrs.status === 'Cancelled' ? 'Scheduled' : 'Cancelled'">{{ t('pages.editor.schema.cancelled') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
