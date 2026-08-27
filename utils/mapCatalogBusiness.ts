import type { MockBusiness } from '@/utils/mockCatalog';
import type { CatalogBusiness, CatalogCategory } from '@/api/hub/catalog';
import { maskProfanity } from '@/utils/profanityFilter';

// Real catalog data (lotof.hub.msvc.core, via hub.gtw's catalogBusinesses/
// catalogCategories) has no rating/reviews/price-tier/distance/gradient --
// none of that has a real source yet. This maps it onto the same
// MockBusiness shape BusinessCard.vue already renders, leaving those fields
// undefined (BusinessCard hides them rather than showing a fabricated
// number) and picking a stable-per-business color from a small palette so
// cards still look visually distinct without inventing per-business colors.

const PALETTE: Array<{ gradient: string; iconColor: string }> = [
  { gradient: 'from-amber-200 to-orange-100', iconColor: 'text-amber-700' },
  { gradient: 'from-rose-200 to-pink-100', iconColor: 'text-rose-700' },
  { gradient: 'from-blue-200 to-indigo-100', iconColor: 'text-blue-700' },
  { gradient: 'from-lime-200 to-yellow-100', iconColor: 'text-lime-700' },
  { gradient: 'from-violet-200 to-fuchsia-100', iconColor: 'text-violet-700' },
  { gradient: 'from-teal-200 to-emerald-100', iconColor: 'text-teal-700' },
];

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function toDisplayBusiness(business: CatalogBusiness, categories: CatalogCategory[]): MockBusiness {
  const category = categories.find((c) => c.id === business.categoryId);
  const { gradient, iconColor } = paletteFor(business.id);

  return {
    key: business.id,
    // Tenant-entered, unmoderated -- masked here rather than at write time
    // so nothing stored needs a migration if the word list changes.
    name: maskProfanity(business.name),
    icon: category?.icon || 'lucide:store',
    gradient,
    iconColor,
    // badge is a promo/status label on mock cards (e.g. "Новинка") -- city
    // isn't that, so it's left unset here rather than repurposing the slot.
    logoUrl: business.logoUrl || undefined,
    to: `/to/${business.namespaceSlug}/menu`,
  };
}

// One MenuBusiness row = one Branch (see hub.msvc.core's catalog schema), so
// a brand with several branches would otherwise show up as several
// near-identical cards. The storefront itself (pages/to/[namespace]/menu)
// already handles picking a branch once a Patron gets there -- the Catalog
// only needs one card per brand. Keeps the first (most recently synced,
// since ListBusinesses orders by created_at desc) branch per namespace.
export function dedupeByBrand(businesses: CatalogBusiness[]): CatalogBusiness[] {
  const seen = new Set<string>();
  const result: CatalogBusiness[] = [];
  for (const b of businesses) {
    if (seen.has(b.namespaceSlug)) continue;
    seen.add(b.namespaceSlug);
    result.push(b);
  }
  return result;
}
