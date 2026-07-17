import { GraphQLClient } from 'graphql-request';
import { getDeviceHeaders } from '@/utils/device';
import { getApiBaseUrl } from '@/utils/api-base';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuCategory } from '@/api/menu/category/list';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuBadge } from '@/api/menu/badge/list';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

// Unauthenticated reads for the public storefront page (/to/[namespace]/menu).
// Every field these hit is intentionally free of @menuAuth on the backend —
// only the Namespace header is required to scope the tenant.

async function headers(namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespaceSlug, ...devHeaders };
}

// Resolve the base URL fresh on every call rather than reusing the shared
// module-level `menuClient` singleton — that client's URL is captured once
// at module-import time via getApiBaseUrl(), which needs an active request
// context (useRequestURL()) to resolve correctly. During SSR, module
// evaluation happens once per server process outside any request, so the
// singleton would silently freeze on the wrong (fallback siteUrl) host.
// This page is the only SSR-rendered consumer of the public storefront API,
// so the fix is scoped here rather than touching the shared ApiClient class.
async function freshClient(namespaceSlug: string): Promise<GraphQLClient> {
  return new GraphQLClient(`${getApiBaseUrl('menu')}/query`, {
    credentials: 'omit' as any,
    headers: (await headers(namespaceSlug)) as any,
  });
}

// A namespace's tenant schema is provisioned lazily on first access (see
// menu.msvc.core's ConfigTenants warmup) — a request landing during that
// brief window gets "tenant migration in progress, retry later" instead of
// data. Retrying a few times with a short delay rides through it instead of
// surfacing a hard error on what's usually just the very first page load.
async function withMigrationRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 600): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isMigrating = message.includes('tenant migration in progress');
      if (!isMigrating || attempt === attempts - 1) throw e;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('unreachable');
}

const StorefrontDocument = /* GraphQL */ `
  query Storefront {
    brandSettings {
      id name logoUrl primaryColor secondaryColor welcomeMessage currencyCode socialLinks logoAlt seoTitle seoDescription
    }
    branches(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id name address phone lat lng workingHours isActive city isPrimary slug }
    }
    categories(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id parentId name sortOrder isActive availableFrom availableTo availableDays }
    }
    badges(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id text bgColor textColor icon }
    }
    promoBanners(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id title description imageUrl imageAlt targetUrl startDate endDate isActive }
    }
  }
`;

export type StorefrontData = {
  brandSettings: MenuBrandSettings | null;
  branches: MenuBranch[];
  categories: MenuCategory[];
  badges: MenuBadge[];
  promoBanners: MenuPromoBanner[];
};

export async function getPublicStorefront(namespaceSlug: string): Promise<StorefrontData> {
  const client = await freshClient(namespaceSlug);
  const res = await withMigrationRetry(() => client.request<{
    brandSettings: MenuBrandSettings | null;
    branches: { rows: MenuBranch[] };
    categories: { rows: MenuCategory[] };
    badges: { rows: MenuBadge[] };
    promoBanners: { rows: MenuPromoBanner[] };
  }>(StorefrontDocument, {}));

  return {
    brandSettings: res.brandSettings,
    branches: res.branches.rows,
    categories: res.categories.rows.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    badges: res.badges.rows,
    promoBanners: res.promoBanners.rows.filter((b) => b.isActive),
  };
}

const PublicMenuItemsDocument = /* GraphQL */ `
  query PublicMenuItems($categoryId: String) {
    menuItems(categoryId: $categoryId, filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id categoryId name description price imageUrl isActive sortOrder imageAlt badgeIds excludedBranchIds modifierGroupIds }
    }
  }
`;

export async function getPublicMenuItems(namespaceSlug: string, categoryId: string): Promise<MenuItem[]> {
  const client = await freshClient(namespaceSlug);
  const res = await withMigrationRetry(() => client.request<{ menuItems: { rows: MenuItem[] } }>(
    PublicMenuItemsDocument,
    { categoryId }
  ));
  return res.menuItems.rows.filter((i) => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export type PublicModifierGroup = {
  id: string;
  name: string;
  type: string;
  minSelect: number;
  maxSelect?: number | null;
  isRequired: boolean;
};

export type PublicModifierOption = {
  id: string;
  groupId: string;
  name: string;
  price: number;
  sortOrder: number;
};

const PublicModifierGroupsDocument = /* GraphQL */ `
  query PublicModifierGroups {
    modifierGroups(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id name type minSelect maxSelect isRequired }
    }
  }
`;

export async function getPublicModifierGroups(namespaceSlug: string): Promise<PublicModifierGroup[]> {
  const client = await freshClient(namespaceSlug);
  const res = await withMigrationRetry(() => client.request<{ modifierGroups: { rows: PublicModifierGroup[] } }>(
    PublicModifierGroupsDocument,
    {}
  ));
  return res.modifierGroups.rows;
}

const PublicModifierOptionsDocument = /* GraphQL */ `
  query PublicModifierOptions($groupId: String!) {
    modifierOptions(groupId: $groupId) {
      rows { id groupId name price sortOrder }
    }
  }
`;

export async function getPublicModifierOptions(namespaceSlug: string, groupId: string): Promise<PublicModifierOption[]> {
  const client = await freshClient(namespaceSlug);
  const res = await withMigrationRetry(() => client.request<{ modifierOptions: { rows: PublicModifierOption[] } }>(
    PublicModifierOptionsDocument,
    { groupId }
  ));
  return res.modifierOptions.rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export type PublicOrderItemModifierInput = {
  modifierOptionId: string;
  name: string;
  priceAtPurchase: number;
};

export type PublicOrderItemInput = {
  menuItemId: string;
  name: string;
  priceAtPurchase: number;
  quantity: number;
  modifiers?: PublicOrderItemModifierInput[];
};

export type PublicOrderInput = {
  branchId?: string;
  phone: string;
  customerName?: string;
  type: 'delivery' | 'pickup';
  deliveryAddress?: string;
  comment?: string;
  sourceTag?: string;
  totalAmount: number;
  items: PublicOrderItemInput[];
};

const CreatePublicOrderDocument = /* GraphQL */ `
  mutation CreatePublicOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id number status
    }
  }
`;

export async function submitPublicOrder(namespaceSlug: string, input: PublicOrderInput): Promise<{ id: string; number: number; status: string }> {
  const client = await freshClient(namespaceSlug);
  const res = await client.request<{ createOrder: { id: string; number: number; status: string } }>(
    CreatePublicOrderDocument,
    {
      input: {
        branchId: input.branchId,
        phone: input.phone,
        customerName: input.customerName,
        type: input.type,
        deliveryAddress: input.deliveryAddress,
        comment: input.comment,
        sourceTag: input.sourceTag,
        totalAmount: input.totalAmount,
        items: input.items,
      },
    }
  );
  return res.createOrder;
}
