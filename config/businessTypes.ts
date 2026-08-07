export type BusinessType = 'restaurant_cafe' | 'retail' | 'services' | 'delivery_logistics' | 'other';

export type BusinessTypeOption = {
  value: BusinessType;
  icon: string;
  titleKey: string;
};

// Single source of truth for the business-type taxonomy used by every
// product's "Быстрая настройка" (Quick Setup) preset flow. Keep this list in
// sync (by value string) with the switch/case business-type validation in
// each product's backend preset registry -- there's no shared proto for this,
// it's a short fixed list passed around as a plain string.
export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { value: 'restaurant_cafe', icon: 'lucide:utensils', titleKey: 'onboarding.businessTypeRestaurantCafe' },
  { value: 'retail', icon: 'lucide:shopping-bag', titleKey: 'onboarding.businessTypeRetail' },
  { value: 'services', icon: 'lucide:scissors', titleKey: 'onboarding.businessTypeServices' },
  { value: 'delivery_logistics', icon: 'lucide:truck', titleKey: 'onboarding.businessTypeDeliveryLogistics' },
  { value: 'other', icon: 'lucide:shapes', titleKey: 'onboarding.businessTypeOther' },
];

export function isBusinessType(value: string | null | undefined): value is BusinessType {
  return !!value && BUSINESS_TYPES.some((o) => o.value === value);
}
