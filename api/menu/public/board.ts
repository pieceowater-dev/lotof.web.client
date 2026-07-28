import { GraphQLClient } from 'graphql-request';
import { getDeviceHeaders } from '@/utils/device';
import { getApiBaseUrl } from '@/utils/api-base';

// Public, unauthenticated Kitchen Display Board — a read-only fetch of open
// orders (kitchenBoard on menu.gtw), no @menuAuth. Same freshClient-per-call
// pattern as api/menu/public/storefront.ts, since this page can also be
// SSR-rendered on first load.

async function headers(namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespaceSlug, ...devHeaders };
}

async function freshClient(namespaceSlug: string): Promise<GraphQLClient> {
  return new GraphQLClient(`${getApiBaseUrl('menu')}/query`, {
    credentials: 'omit' as any,
    headers: (await headers(namespaceSlug)) as any,
  });
}

export type BoardOrderItem = { name: string; quantity: number };
export type BoardOrder = {
  id: string;
  number: number;
  type: string;
  status: string;
  tableTag?: string | null;
  createdAt: string;
  items: BoardOrderItem[];
};

const KitchenBoardDocument = /* GraphQL */ `
  query KitchenBoard($branchId: String) {
    kitchenBoard(branchId: $branchId) {
      id number type status tableTag createdAt
      items { name quantity }
    }
  }
`;

export async function getKitchenBoard(namespaceSlug: string, branchId?: string): Promise<BoardOrder[]> {
  const client = await freshClient(namespaceSlug);
  const res = await client.request<{ kitchenBoard: BoardOrder[] }>(KitchenBoardDocument, { branchId });
  return res.kitchenBoard;
}
