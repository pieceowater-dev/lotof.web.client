import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsCategory = {
  id: string;
  parentId?: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const CategoriesDocument = /* GraphQL */ `
  query Categories($filter: DefaultFilterInput) {
    categories(filter: $filter) {
      rows { id parentId name sortOrder isActive }
      info { count }
    }
  }
`;

export async function goodsListCategories(goodsToken: string, namespaceSlug: string): Promise<{ categories: GoodsCategory[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ categories: { rows: GoodsCategory[]; info: { count: number } } }>(
      CategoriesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { categories: res.categories.rows, count: res.categories.info.count };
  }, namespaceSlug);
}

const CreateCategoryDocument = /* GraphQL */ `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) { id parentId name sortOrder isActive }
  }
`;

export async function goodsCreateCategory(
  goodsToken: string,
  namespaceSlug: string,
  input: { name: string; parentId?: string; sortOrder: number },
): Promise<GoodsCategory> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createCategory: GoodsCategory }>(
      CreateCategoryDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createCategory;
  }, namespaceSlug);
}

const DeleteCategoryDocument = /* GraphQL */ `mutation DeleteCategory($id: ID!) { deleteCategory(id: $id) { success } }`;

export async function goodsDeleteCategory(goodsToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteCategory: { success: boolean } }>(
      DeleteCategoryDocument, { id }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteCategory.success;
  }, namespaceSlug);
}
