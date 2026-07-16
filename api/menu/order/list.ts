import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuOrder = {
  id: string;
  number: number;
  branchId?: string | null;
  clientId?: string | null;
  type: string;
  status: string;
  phone: string;
  customerName?: string | null;
  deliveryAddress?: string | null;
  deliveryAt?: string | null;
  comment?: string | null;
  sourceTag?: string | null;
  totalAmount: number;
  createdAt: string;
};

export type OrdersFilter = {
  statuses?: string[];
  branchIds?: string[];
  search?: string;
  page?: number;
  length?: string;
};

const OrdersDocument = /* GraphQL */ `
  query Orders($filter: DefaultFilterInput, $statuses: [String!], $branchIds: [String!], $search: String) {
    orders(filter: $filter, statuses: $statuses, branchIds: $branchIds, search: $search) {
      rows {
        id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt
      }
      info { count }
    }
  }
`;

export async function menuOrdersList(menuToken: string, namespaceSlug: string, params: OrdersFilter = {}): Promise<{ orders: MenuOrder[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orders: { rows: MenuOrder[]; info: { count: number } } }>(
      OrdersDocument,
      {
        filter: { pagination: { page: params.page || 1, length: params.length || 'FIFTY' } },
        statuses: params.statuses?.length ? params.statuses : undefined,
        branchIds: params.branchIds?.length ? params.branchIds : undefined,
        search: params.search || undefined,
      },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { orders: res.orders.rows, count: res.orders.info.count };
  }, namespaceSlug);
}
