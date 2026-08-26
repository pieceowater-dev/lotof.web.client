import { hubClient } from '../clients';
import {
  CatalogCategoriesDocument,
  CatalogBusinessesDocument,
  type CatalogCategoriesQuery,
  type CatalogBusinessesQuery,
  type CatalogBusinessesQueryVariables,
} from '@gql-hub';

// Public browse endpoints for the cross-tenant business catalog
// (lotof.hub.msvc.core's CatalogService, via hub.gtw) -- backs
// pages/catalog.vue, pages/stores.vue, pages/services.vue. Unauthenticated
// on purpose: no token is ever attached for these two calls.

export type CatalogCategory = NonNullable<CatalogCategoriesQuery['catalogCategories']>[number];
export type CatalogBusiness = NonNullable<CatalogBusinessesQuery['catalogBusinesses']>['rows'][number];

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const data = await hubClient.request<CatalogCategoriesQuery>(CatalogCategoriesDocument);
  return data.catalogCategories ?? [];
}

export async function getCatalogBusinesses(
  variables: CatalogBusinessesQueryVariables = {},
): Promise<{ rows: CatalogBusiness[]; count: number }> {
  const data = await hubClient.request<CatalogBusinessesQuery>(CatalogBusinessesDocument, variables);
  return {
    rows: data.catalogBusinesses?.rows ?? [],
    count: data.catalogBusinesses?.info?.count ?? 0,
  };
}
