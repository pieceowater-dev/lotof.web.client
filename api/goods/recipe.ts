import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsRecipeItem = { id: string; goodId: string; unitId: string; quantityPerUnit: number };
export type GoodsRecipe = { id: string; menuItemId: string; name: string; isActive: boolean; items: GoodsRecipeItem[] };

const RECIPE_FIELDS = `id menuItemId name isActive items { id goodId unitId quantityPerUnit }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query Recipes($filter: DefaultFilterInput) {
    recipes(filter: $filter) { rows { ${RECIPE_FIELDS} } info { count } }
  }
`;

export async function goodsListRecipes(token: string, ns: string): Promise<GoodsRecipe[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ recipes: { rows: GoodsRecipe[] } }>(
      ListDocument, { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: headers(token, ns, dev) }
    );
    return res.recipes.rows;
  }, ns);
}

const SetDocument = /* GraphQL */ `
  mutation SetRecipe($input: SetRecipeInput!) {
    setRecipe(input: $input) { ${RECIPE_FIELDS} }
  }
`;

export type SetRecipeInput = { menuItemId: string; name: string; items: { goodId: string; unitId: string; quantityPerUnit: number }[] };

export async function goodsSetRecipe(token: string, ns: string, input: SetRecipeInput): Promise<GoodsRecipe> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ setRecipe: GoodsRecipe }>(SetDocument, { input }, { headers: headers(token, ns, dev) });
    return res.setRecipe;
  }, ns);
}

const DeleteDocument = /* GraphQL */ `mutation DeleteRecipe($id: ID!) { deleteRecipe(id: $id) { success } }`;

export async function goodsDeleteRecipe(token: string, ns: string, id: string): Promise<boolean> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteRecipe: { success: boolean } }>(DeleteDocument, { id }, { headers: headers(token, ns, dev) });
    return res.deleteRecipe.success;
  }, ns);
}
