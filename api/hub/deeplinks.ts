import { hubClient, setGlobalAuthToken } from '@/api/clients';
import {
  AdminDeepLinkCategoriesDocument,
  AdminDeepLinksDocument,
  CreateDeepLinkCategoryDocument,
  UpdateDeepLinkCategoryDocument,
  DeleteDeepLinkCategoryDocument,
  CreateDeepLinkDocument,
  UpdateDeepLinkDocument,
  DeleteDeepLinkDocument,
  type AdminDeepLinkCategoriesQuery,
  type AdminDeepLinksQuery,
  type CreateDeepLinkCategoryMutation,
  type UpdateDeepLinkCategoryMutation,
  type DeleteDeepLinkCategoryMutation,
  type CreateDeepLinkMutation,
  type UpdateDeepLinkMutation,
  type DeleteDeepLinkMutation,
} from '@gql-hub';

// D2/D4: was hand-typed inline query strings + manually maintained response
// types (AdminDeepLinkCategory/AdminDeepLink) kept in sync with the schema
// by hand. Converted to typed-document-node (api/hub/queries|mutations/*.gql
// + codegen), same pattern as me.ts/updateMe.ts/catalog.ts -- the query/
// mutation shapes below are byte-identical to what was here before, only the
// source of truth moved from this file to the .gql documents + generated
// types, so a real schema drift now fails typecheck instead of silently
// mismatching at runtime like admin.ts/bootstrap.ts/peopleBootstrap.ts still
// can (checked for drift 2026-09-11, found none yet -- but nothing enforces
// that staying true going forward the way this file's imports now do).

export type AdminDeepLinkCategory = NonNullable<AdminDeepLinkCategoriesQuery['adminDeepLinkCategories']>[number];
export type AdminDeepLink = NonNullable<AdminDeepLinksQuery['adminDeepLinks']>[number];

export async function hubListDeepLinkCategories(token: string): Promise<AdminDeepLinkCategory[]> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<AdminDeepLinkCategoriesQuery>(AdminDeepLinkCategoriesDocument);
  return res.adminDeepLinkCategories || [];
}

export async function hubListDeepLinks(token: string, categoryId?: string | null): Promise<AdminDeepLink[]> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<AdminDeepLinksQuery>(AdminDeepLinksDocument, { categoryId: categoryId || null });
  return res.adminDeepLinks || [];
}

export async function hubCreateDeepLinkCategory(token: string, name: string): Promise<AdminDeepLinkCategory> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<CreateDeepLinkCategoryMutation>(CreateDeepLinkCategoryDocument, { input: { name } });
  return res.createDeepLinkCategory;
}

export async function hubUpdateDeepLinkCategory(token: string, id: string, name: string): Promise<AdminDeepLinkCategory> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<UpdateDeepLinkCategoryMutation>(UpdateDeepLinkCategoryDocument, { id, input: { name } });
  return res.updateDeepLinkCategory;
}

export async function hubDeleteDeepLinkCategory(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<DeleteDeepLinkCategoryMutation>(DeleteDeepLinkCategoryDocument, { id });
  return res.deleteDeepLinkCategory;
}

export async function hubCreateDeepLink(
  token: string,
  input: { categoryId?: string | null; target: string; label?: string | null }
): Promise<AdminDeepLink> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<CreateDeepLinkMutation>(CreateDeepLinkDocument, { input });
  return res.createDeepLink;
}

export async function hubUpdateDeepLink(
  token: string,
  id: string,
  input: { categoryId?: string | null; target: string; label?: string | null }
): Promise<AdminDeepLink> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<UpdateDeepLinkMutation>(UpdateDeepLinkDocument, { id, input });
  return res.updateDeepLink;
}

export async function hubDeleteDeepLink(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<DeleteDeepLinkMutation>(DeleteDeepLinkDocument, { id });
  return res.deleteDeepLink;
}
