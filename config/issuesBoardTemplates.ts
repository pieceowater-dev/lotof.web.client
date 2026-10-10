// Starter templates offered in the "Create board" dialog. A template is just
// a preset bundle of CreateBoard inputs (kanban columns + integration flags
// + an optional businessType that seeds matching task types server-side) —
// everything stays fully editable from Board settings afterwards, exactly as
// if the user had built the board by hand.
//
// Column labels are localized here at creation time (they're free text
// stored in the DB, not re-translated on read — same approach as the
// server-side task-type presets in lotof.issues.msvc.core/tasktype/preset).

export type BoardTemplateId = 'basic' | 'sales_funnel' | 'repairs';

type Locale = 'ru' | 'kk' | 'en';

interface TemplateColumn {
  key: string;
  label: Record<Locale, string>;
  is_terminal?: boolean;
  required?: boolean;
  maps_to?: string;
  // Funnel outcome marker for a terminal column — read by the funnel
  // analytics view to split closed deals into won vs lost. Stored as an
  // extra key in statuses_json; the backend round-trips it untouched.
  outcome?: 'won' | 'lost';
  color?: '' | 'blue' | 'green' | 'red' | 'yellow';
}

export interface BoardTemplate {
  id: BoardTemplateId;
  icon: string;
  titleKey: string;
  descKey: string;
  /** businessType passed to CreateBoard (seeds task types); '' = generic default. */
  businessType: string;
  integrationFlags?: Record<string, boolean>;
  columns: TemplateColumn[] | null; // null = let the server assign its default columns
}

const SALES_FUNNEL_COLUMNS: TemplateColumn[] = [
  { key: 'new_lead', label: { ru: 'Новый лид', kk: 'Жаңа лид', en: 'New lead' }, color: '' },
  { key: 'contacted', label: { ru: 'Связались', kk: 'Байланыстық', en: 'Contacted' }, color: 'blue' },
  { key: 'qualified', label: { ru: 'Квалифицирован', kk: 'Біліктілік', en: 'Qualified' }, color: 'blue' },
  { key: 'proposal', label: { ru: 'КП отправлено', kk: 'КҰ жіберілді', en: 'Proposal sent' }, color: 'yellow' },
  { key: 'negotiation', label: { ru: 'Переговоры', kk: 'Келіссөздер', en: 'Negotiation' }, color: 'yellow' },
  { key: 'won', label: { ru: 'Сделка', kk: 'Мәміле', en: 'Won' }, is_terminal: true, outcome: 'won', color: 'green' },
  { key: 'lost', label: { ru: 'Отказ', kk: 'Бас тарту', en: 'Lost' }, is_terminal: true, outcome: 'lost', color: 'red' },
];

// A repair shop's pipeline for lota Orders tasks: from intake to handing the
// device back. Mirrors the neutral order lifecycle but with the steps a
// technician actually tracks (diagnostics, price approval, waiting for a part).
const REPAIRS_COLUMNS: TemplateColumn[] = [
  { key: 'accepted', label: { ru: 'Принят', kk: 'Қабылданды', en: 'Accepted' }, color: '' },
  { key: 'diagnostics', label: { ru: 'Диагностика', kk: 'Диагностика', en: 'Diagnostics' }, color: 'blue' },
  { key: 'approval', label: { ru: 'Согласование цены', kk: 'Бағаны келісу', en: 'Price approval' }, color: 'yellow' },
  { key: 'waiting_part', label: { ru: 'Ждём запчасть', kk: 'Бөлшекті күтеміз', en: 'Waiting for a part' }, color: 'yellow' },
  { key: 'repair', label: { ru: 'В ремонте', kk: 'Жөндеуде', en: 'In repair' }, color: 'blue' },
  { key: 'ready', label: { ru: 'Готов к выдаче', kk: 'Берілуге дайын', en: 'Ready for pickup' }, color: 'green' },
  { key: 'handed_over', label: { ru: 'Выдан', kk: 'Берілді', en: 'Handed over' }, is_terminal: true, color: 'green' },
  { key: 'cancelled', label: { ru: 'Отказ клиента', kk: 'Клиенттің бас тартуы', en: 'Cancelled by customer' }, is_terminal: true, color: 'red' },
];

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'basic',
    icon: 'lucide:columns-3',
    titleKey: 'tasks.templateBasic',
    descKey: 'tasks.templateBasicDesc',
    businessType: '',
    columns: null,
  },
  {
    id: 'sales_funnel',
    icon: 'lucide:filter',
    titleKey: 'tasks.templateSalesFunnel',
    descKey: 'tasks.templateSalesFunnelDesc',
    businessType: 'sales',
    integrationFlags: { contacts: true },
    columns: SALES_FUNNEL_COLUMNS,
  },
  {
    id: 'repairs',
    icon: 'lucide:wrench',
    titleKey: 'tasks.templateRepairs',
    descKey: 'tasks.templateRepairsDesc',
    businessType: 'service_center',
    integrationFlags: { menu: true, contacts: true },
    columns: REPAIRS_COLUMNS,
  },
];

/** Name of the board the service-center onboarding creates, per locale. */
export const REPAIRS_BOARD_NAME: Record<Locale, string> = { ru: 'Ремонты', kk: 'Жөндеу', en: 'Repairs' };
export function repairsBoardName(locale: string | undefined): string {
  return REPAIRS_BOARD_NAME[normalizeLocale(locale)];
}

function normalizeLocale(locale: string | undefined): Locale {
  return locale === 'kk' || locale === 'en' ? locale : 'ru';
}

// Builds the extra CreateBoard payload fields for a template. Returns {} for
// the "basic" template so the call is byte-for-byte the old behavior.
export function boardTemplatePayload(
  templateId: BoardTemplateId,
  locale: string | undefined,
): { statuses?: string; integrationFlags?: string; businessType?: string; locale?: string } {
  const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl || tpl.id === 'basic') return {};

  const loc = normalizeLocale(locale);
  const payload: { statuses?: string; integrationFlags?: string; businessType?: string; locale?: string } = {};

  if (tpl.columns) {
    payload.statuses = JSON.stringify(
      tpl.columns.map((c) => ({
        key: c.key,
        label: c.label[loc],
        is_terminal: !!c.is_terminal,
        required: !!c.required,
        maps_to: c.maps_to || '',
        outcome: c.outcome || '',
        color: c.color || '',
      })),
    );
  }
  if (tpl.integrationFlags) payload.integrationFlags = JSON.stringify(tpl.integrationFlags);
  if (tpl.businessType) {
    payload.businessType = tpl.businessType;
    payload.locale = loc;
  }
  return payload;
}
