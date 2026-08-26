import { GraphQLClient } from 'graphql-request';
import { hubClient } from '../clients';
import { getApiBaseUrl } from '@/utils/api-base';
import {
  CatalogCategoriesDocument,
  CatalogTagsDocument,
  CatalogBusinessesDocument,
  CatalogReviewsDocument,
  CatalogFavoritesDocument,
  CatalogToggleFavoriteDocument,
  CatalogCreateReviewDocument,
  type CatalogCategoriesQuery,
  type CatalogTagsQuery,
  type CatalogBusinessesQuery,
  type CatalogBusinessesQueryVariables,
  type CatalogReviewsQuery,
  type CatalogFavoritesQuery,
  type CatalogToggleFavoriteMutation,
  type CatalogCreateReviewMutation,
} from '@gql-hub';

// Public browse endpoints for the cross-tenant business catalog
// (lotof.hub.msvc.core's CatalogService, via hub.gtw) -- backs
// pages/catalog.vue, pages/stores.vue, pages/services.vue. Unauthenticated
// on purpose: no token is ever attached for these calls.

export type CatalogCategory = NonNullable<CatalogCategoriesQuery['catalogCategories']>[number];
export type CatalogTag = NonNullable<CatalogTagsQuery['catalogTags']>[number];
export type CatalogBusiness = NonNullable<CatalogBusinessesQuery['catalogBusinesses']>['rows'][number];
export type CatalogReview = NonNullable<CatalogReviewsQuery['catalogReviews']>[number];

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const data = await hubClient.request<CatalogCategoriesQuery>(CatalogCategoriesDocument);
  return data.catalogCategories ?? [];
}

// The real, growing taxonomy (each tenant's own Menu category names,
// aggregated and normalized) -- this is what the Catalog's quick-filter
// chips use, not getCatalogCategories (the fixed 5-row business-type list).
export async function getCatalogTags(): Promise<CatalogTag[]> {
  const data = await hubClient.request<CatalogTagsQuery>(CatalogTagsDocument);
  return data.catalogTags ?? [];
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

export async function getCatalogReviews(businessId: string): Promise<CatalogReview[]> {
  const data = await hubClient.request<CatalogReviewsQuery>(CatalogReviewsDocument, { businessId });
  return data.catalogReviews ?? [];
}

// Favorites/reviews-authoring are @patronAuth-gated -- same reasoning as
// api/menu/public/patron.ts's getPatronMe: a standalone client with an
// explicit Patron Bearer token, never the shared hubClient (that one only
// ever carries the hub *User* token).
function patronClient(patronToken: string): GraphQLClient {
  return new GraphQLClient(`${getApiBaseUrl('hub')}/query`, {
    credentials: 'omit' as any,
    headers: { Authorization: `Bearer ${patronToken}` } as any,
  });
}

export async function getCatalogFavorites(patronToken: string): Promise<string[]> {
  const data = await patronClient(patronToken).request<CatalogFavoritesQuery>(CatalogFavoritesDocument);
  return data.catalogFavorites ?? [];
}

export async function toggleCatalogFavorite(patronToken: string, businessId: string): Promise<boolean> {
  const data = await patronClient(patronToken).request<CatalogToggleFavoriteMutation>(CatalogToggleFavoriteDocument, {
    businessId,
  });
  return data.catalogToggleFavorite;
}

export async function createCatalogReview(
  patronToken: string,
  businessId: string,
  rating: number,
  body: string,
): Promise<CatalogReview> {
  const data = await patronClient(patronToken).request<CatalogCreateReviewMutation>(CatalogCreateReviewDocument, {
    businessId,
    rating,
    body,
  });
  return data.catalogCreateReview;
}
