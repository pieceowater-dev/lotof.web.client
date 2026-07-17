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
  closedAt?: string | null;
};

export type OrdersFilter = {
  statuses?: string[];
  branchIds?: string[];
  search?: string;
  types?: string[];
  sourceTag?: string;
  createdFrom?: string;
  createdTo?: string;
  closedFrom?: string;
  closedTo?: string;
  page?: number;
  length?: string;
};

const ORDER_FILTER_VARS = `
  $statuses: [String!], $branchIds: [String!], $search: String, $types: [String!], $sourceTag: String,
  $createdFrom: String, $createdTo: String, $closedFrom: String, $closedTo: String
`;
const ORDER_FILTER_ARGS = `
  statuses: $statuses, branchIds: $branchIds, search: $search, types: $types, sourceTag: $sourceTag,
  createdFrom: $createdFrom, createdTo: $createdTo, closedFrom: $closedFrom, closedTo: $closedTo
`;

const OrdersDocument = /* GraphQL */ `
  query Orders($filter: DefaultFilterInput, ${ORDER_FILTER_VARS}) {
    orders(filter: $filter, ${ORDER_FILTER_ARGS}) {
      rows {
        id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt
      }
      info { count }
    }
  }
`;

function filterVars(params: OrdersFilter) {
  return {
    statuses: params.statuses?.length ? params.statuses : undefined,
    branchIds: params.branchIds?.length ? params.branchIds : undefined,
    search: params.search || undefined,
    types: params.types?.length ? params.types : undefined,
    sourceTag: params.sourceTag || undefined,
    createdFrom: params.createdFrom || undefined,
    createdTo: params.createdTo || undefined,
    closedFrom: params.closedFrom || undefined,
    closedTo: params.closedTo || undefined,
  };
}

export async function menuOrdersList(menuToken: string, namespaceSlug: string, params: OrdersFilter = {}): Promise<{ orders: MenuOrder[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orders: { rows: MenuOrder[]; info: { count: number } } }>(
      OrdersDocument,
      {
        filter: { pagination: { page: params.page || 1, length: params.length || 'FIFTY' } },
        ...filterVars(params),
      },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { orders: res.orders.rows, count: res.orders.info.count };
  }, namespaceSlug);
}

const OrdersSummaryDocument = /* GraphQL */ `
  query OrdersSummary(${ORDER_FILTER_VARS}) {
    ordersSummary(${ORDER_FILTER_ARGS}) {
      count
      totalAmount
    }
  }
`;

export type OrdersSummary = { count: number; totalAmount: number };

export async function menuOrdersSummary(menuToken: string, namespaceSlug: string, params: OrdersFilter = {}): Promise<OrdersSummary> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ ordersSummary: OrdersSummary }>(
      OrdersSummaryDocument,
      filterVars(params),
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.ordersSummary;
  }, namespaceSlug);
}
