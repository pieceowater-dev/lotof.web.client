import type { BusinessType } from '@/config/businessTypes';
import type { StatusLabels } from '@/utils/orderStatusLabels';

// Each business type calls the stages of an order differently. A preset is
// just a set of custom names: the order lifecycle itself never changes, and
// anything not listed here (or a type with no preset at all) keeps the neutral
// default names. Applied automatically at onboarding, editable afterwards in
// Settings -> Statuses.

type Locale = 'ru' | 'kk' | 'en';

const PRESETS: Partial<Record<BusinessType, Record<Locale, StatusLabels>>> = {
  restaurant_cafe: {
    ru: { IN_PREPARATION: 'Готовится', READY: 'Готов', DELIVERING: 'В пути', COMPLETED: 'Завершён' },
    kk: { IN_PREPARATION: 'Дайындалуда', READY: 'Дайын', DELIVERING: 'Жолда', COMPLETED: 'Аяқталды' },
    en: { IN_PREPARATION: 'Preparing', READY: 'Ready', DELIVERING: 'On the way', COMPLETED: 'Completed' },
  },
  retail: {
    ru: { ACCEPTED: 'Принят', IN_PREPARATION: 'Комплектуется', READY: 'Готов к выдаче', DELIVERING: 'В пути', COMPLETED: 'Выдан' },
    kk: { ACCEPTED: 'Қабылданды', IN_PREPARATION: 'Жиналуда', READY: 'Берілуге дайын', DELIVERING: 'Жолда', COMPLETED: 'Берілді' },
    en: { ACCEPTED: 'Accepted', IN_PREPARATION: 'Being packed', READY: 'Ready for pickup', DELIVERING: 'On the way', COMPLETED: 'Handed over' },
  },
  service_center: {
    ru: { NEW: 'Принят в ремонт', ACCEPTED: 'Диагностика', IN_PREPARATION: 'В ремонте', READY: 'Готов к выдаче', COMPLETED: 'Выдан', CANCELLED: 'Отказ клиента' },
    kk: { NEW: 'Жөндеуге қабылданды', ACCEPTED: 'Диагностика', IN_PREPARATION: 'Жөндеуде', READY: 'Берілуге дайын', COMPLETED: 'Берілді', CANCELLED: 'Клиенттің бас тартуы' },
    en: { NEW: 'Received', ACCEPTED: 'Diagnostics', IN_PREPARATION: 'In repair', READY: 'Ready for pickup', COMPLETED: 'Handed over', CANCELLED: 'Cancelled by customer' },
  },
  delivery_logistics: {
    ru: { ACCEPTED: 'Принят', IN_PREPARATION: 'Комплектуется', READY: 'Готов к отправке', DELIVERING: 'В пути', COMPLETED: 'Доставлен' },
    kk: { ACCEPTED: 'Қабылданды', IN_PREPARATION: 'Жиналуда', READY: 'Жіберуге дайын', DELIVERING: 'Жолда', COMPLETED: 'Жеткізілді' },
    en: { ACCEPTED: 'Accepted', IN_PREPARATION: 'Being packed', READY: 'Ready to ship', DELIVERING: 'On the way', COMPLETED: 'Delivered' },
  },
};

/** Business types that have their own status names, in picker order. */
export const STATUS_PRESET_TYPES: BusinessType[] = ['restaurant_cafe', 'retail', 'service_center', 'delivery_logistics'];

export function orderStatusPreset(businessType: string | null | undefined, locale: string | undefined): StatusLabels {
  const byLocale = PRESETS[businessType as BusinessType];
  if (!byLocale) return {};
  const loc: Locale = locale === 'kk' || locale === 'en' ? locale : 'ru';
  return { ...byLocale[loc] };
}
