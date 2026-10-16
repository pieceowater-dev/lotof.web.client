// How the editor edits the list-style section blocks. One generic form (components/pages/editor/ItemsBlock.vue)
// reads this table, so a new block type needs a renderer on the server and a line here.

export type FieldKind = 'text' | 'textarea' | 'image' | 'bool'
export interface FormField { key: string; kind: FieldKind }
export interface BlockForm {
  icon: string
  /** fields of the block itself (above the list) */
  fields?: FormField[]
  /** a list of items, each with these fields */
  items?: { fields: FormField[]; max: number }
  /** option pills of the block, e.g. map zoom */
  pills?: { key: string; values: string[] }
}

const t = (key: string): FormField => ({ key, kind: 'text' })
const area = (key: string): FormField => ({ key, kind: 'textarea' })

export const BLOCK_FORMS: Record<string, BlockForm> = {
  accordion: { icon: 'lucide:chevrons-up-down', items: { fields: [t('title'), area('text')], max: 24 } },
  tabs: { icon: 'lucide:panel-top', items: { fields: [t('title'), area('text')], max: 8 } },
  pricing: { icon: 'lucide:badge-dollar-sign', items: { fields: [t('name'), t('price'), t('period'), area('features'), t('buttonText'), t('buttonHref'), { key: 'highlight', kind: 'bool' }], max: 6 } },
  testimonials: { icon: 'lucide:message-square-quote', items: { fields: [area('text'), t('author'), t('role')], max: 12 } },
  stats: { icon: 'lucide:bar-chart-3', items: { fields: [t('value'), t('label')], max: 8 } },
  steps: { icon: 'lucide:list-ordered', items: { fields: [t('title'), area('text')], max: 12 } },
  logos: { icon: 'lucide:building-2', items: { fields: [{ key: 'src', kind: 'image' }, t('alt'), t('href')], max: 16 } },
  contacts: { icon: 'lucide:contact', fields: [t('title'), t('phone'), t('email'), t('address'), area('hours'), t('whatsapp'), t('telegram')] },
  map: { icon: 'lucide:map-pin', fields: [t('lat'), t('lng'), t('caption')], pills: { key: 'zoom', values: ['far', 'normal', 'near'] } },
};

export const BLOCK_FORM_TYPES = Object.keys(BLOCK_FORMS);

/** New block with something to start from. */
export function defaultAttrs(type: string): Record<string, any> {
  const f = BLOCK_FORMS[type];
  if (!f) return {};
  const out: Record<string, any> = {};
  if (f.items) out.items = [Object.fromEntries(f.items.fields.map(x => [x.key, x.kind === 'bool' ? false : '']))];
  return out;
}
