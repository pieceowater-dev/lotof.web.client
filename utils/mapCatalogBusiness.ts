import type { MockBusiness } from '@/utils/mockCatalog';
import type { CatalogBusiness, CatalogCategory } from '@/api/hub/catalog';
import { maskProfanity } from '@/utils/profanityFilter';

// Real catalog data (lotof.hub.msvc.core, via hub.gtw's catalogBusinesses/
// catalogCategories) has no price-tier/distance -- neither has a real
// source yet. rating/reviews DO have a real source now (avgRating/
// reviewCount, computed server-side from Review rows) -- this maps it onto
// the same MockBusiness shape BusinessCard.vue already renders, leaving
// price-tier/distance undefined (BusinessCard hides a field rather than
// showing a fabricated value) and picking a stable-per-business color from
// a small palette so cards still look visually distinct without inventing
// per-business colors.

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

// The tenant's own public storefront route depends on which lota product the
// catalog row was synced from: lota Contacts memberships («абонементы») live
// at /to/<slug>/memberships, everything else (lota Menu) at /to/<slug>/menu.
// `source` is a recent field -- read it defensively so this keeps working
// against a hub schema/codegen that predates it (falls back to MENU).
function storefrontPath(business: CatalogBusiness): string {
  const source = (business as { source?: string }).source;
  if (source === 'CONTACTS') return `/to/${business.namespaceSlug}/memberships`;
  return `/to/${business.namespaceSlug}/menu`;
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
    to: storefrontPath(business),
    // reviewCount gates rating, not the other way around -- a business with
    // zero reviews has avgRating 0 from the DB, which is a real value, not
    // "no rating yet", so checking it alone would show "0" on every fresh
    // card instead of hiding the row entirely (BusinessCard.vue already
    // hides rating when it's undefined).
    rating: business.reviewCount > 0 ? Math.round(business.avgRating * 10) / 10 : undefined,
    reviews: business.reviewCount > 0 ? business.reviewCount : undefined,
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
    // Key on namespace + source so a tenant that runs both lota Menu and
    // lota Contacts memberships shows one card per product, not one total.
    const key = `${b.namespaceSlug}:${(b as { source?: string }).source || 'MENU'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(b);
  }
  return result;
}
