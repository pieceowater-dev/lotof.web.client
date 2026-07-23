import { hubClient, setGlobalAuthToken } from '@/api/clients';

export type AdminDeepLinkCategory = {
  id: string;
  name: string;
  createdAt: string | null;
};

export type AdminDeepLink = {
  id: string;
  code: string;
  categoryId: string | null;
  target: string;
  label: string | null;
  clickCount: number;
  registrationCount: number;
  appInstallCount: number;
  createdAt: string | null;
};

const CATEGORIES_QUERY = /* GraphQL */ `
  query AdminDeepLinkCategories {
    adminDeepLinkCategories {
      id
      name
      createdAt
    }
  }
`;

const LINKS_QUERY = /* GraphQL */ `
  query AdminDeepLinks($categoryId: ID) {
    adminDeepLinks(categoryId: $categoryId) {
      id
      code
      categoryId
      target
      label
      clickCount
      registrationCount
      appInstallCount
      createdAt
    }
  }
`;

const CREATE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation CreateDeepLinkCategory($input: CreateDeepLinkCategoryInput!) {
    createDeepLinkCategory(input: $input) { id name createdAt }
  }
`;

const UPDATE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation UpdateDeepLinkCategory($id: ID!, $input: UpdateDeepLinkCategoryInput!) {
    updateDeepLinkCategory(id: $id, input: $input) { id name createdAt }
  }
`;

const DELETE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation DeleteDeepLinkCategory($id: ID!) {
    deleteDeepLinkCategory(id: $id)
  }
`;

const CREATE_LINK_MUTATION = /* GraphQL */ `
  mutation CreateDeepLink($input: CreateDeepLinkInput!) {
    createDeepLink(input: $input) {
      id code categoryId target label clickCount registrationCount appInstallCount createdAt
    }
  }
`;

const UPDATE_LINK_MUTATION = /* GraphQL */ `
  mutation UpdateDeepLink($id: ID!, $input: UpdateDeepLinkInput!) {
    updateDeepLink(id: $id, input: $input) {
      id code categoryId target label clickCount registrationCount appInstallCount createdAt
    }
  }
`;

const DELETE_LINK_MUTATION = /* GraphQL */ `
  mutation DeleteDeepLink($id: ID!) {
    deleteDeepLink(id: $id)
  }
`;

export async function hubListDeepLinkCategories(token: string): Promise<AdminDeepLinkCategory[]> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ adminDeepLinkCategories: AdminDeepLinkCategory[] }>(CATEGORIES_QUERY);
  return res.adminDeepLinkCategories || [];
}

export async function hubListDeepLinks(token: string, categoryId?: string | null): Promise<AdminDeepLink[]> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ adminDeepLinks: AdminDeepLink[] }>(LINKS_QUERY, { categoryId: categoryId || null });
  return res.adminDeepLinks || [];
}

export async function hubCreateDeepLinkCategory(token: string, name: string): Promise<AdminDeepLinkCategory> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ createDeepLinkCategory: AdminDeepLinkCategory }>(CREATE_CATEGORY_MUTATION, { input: { name } });
  return res.createDeepLinkCategory;
}

export async function hubUpdateDeepLinkCategory(token: string, id: string, name: string): Promise<AdminDeepLinkCategory> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ updateDeepLinkCategory: AdminDeepLinkCategory }>(UPDATE_CATEGORY_MUTATION, { id, input: { name } });
  return res.updateDeepLinkCategory;
}

export async function hubDeleteDeepLinkCategory(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ deleteDeepLinkCategory: boolean }>(DELETE_CATEGORY_MUTATION, { id });
  return res.deleteDeepLinkCategory;
}

export async function hubCreateDeepLink(
  token: string,
  input: { categoryId?: string | null; target: string; label?: string | null }
): Promise<AdminDeepLink> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ createDeepLink: AdminDeepLink }>(CREATE_LINK_MUTATION, { input });
  return res.createDeepLink;
}

export async function hubUpdateDeepLink(
  token: string,
  id: string,
  input: { categoryId?: string | null; target: string; label?: string | null }
): Promise<AdminDeepLink> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ updateDeepLink: AdminDeepLink }>(UPDATE_LINK_MUTATION, { id, input });
  return res.updateDeepLink;
}

export async function hubDeleteDeepLink(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token || null);
  const res = await hubClient.request<{ deleteDeepLink: boolean }>(DELETE_LINK_MUTATION, { id });
  return res.deleteDeepLink;
}
