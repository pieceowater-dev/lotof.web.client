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
  discountAmount: number;
  discountType: string;
  discountValue: number;
  discountItemId?: string | null;
  paidAmount: number;
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
  participantUserId?: string;
  page?: number;
  length?: string;
};

const ORDER_FILTER_VARS = `
  $statuses: [String!], $branchIds: [String!], $search: String, $types: [String!], $sourceTag: String,
  $createdFrom: String, $createdTo: String, $closedFrom: String, $closedTo: String, $participantUserId: String
`;
const ORDER_FILTER_ARGS = `
  statuses: $statuses, branchIds: $branchIds, search: $search, types: $types, sourceTag: $sourceTag,
  createdFrom: $createdFrom, createdTo: $createdTo, closedFrom: $closedFrom, closedTo: $closedTo,
  participantUserId: $participantUserId
`;

const OrdersDocument = /* GraphQL */ `
  query Orders($filter: DefaultFilterInput, ${ORDER_FILTER_VARS}) {
    orders(filter: $filter, ${ORDER_FILTER_ARGS}) {
      rows {
        id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount discountType discountValue discountItemId paidAmount
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
    participantUserId: params.participantUserId || undefined,
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

// One grouped call for every status's count — replaces the previous
// pattern of one menuOrdersList call per status (7 concurrent requests on
// every poll tick).
const STATUS_COUNT_FILTER_VARS = `
  $branchIds: [String!], $search: String, $types: [String!], $sourceTag: String,
  $createdFrom: String, $createdTo: String, $closedFrom: String, $closedTo: String, $participantUserId: String
`;
const STATUS_COUNT_FILTER_ARGS = `
  branchIds: $branchIds, search: $search, types: $types, sourceTag: $sourceTag,
  createdFrom: $createdFrom, createdTo: $createdTo, closedFrom: $closedFrom, closedTo: $closedTo,
  participantUserId: $participantUserId
`;
const OrderStatusCountsDocument = /* GraphQL */ `
  query OrderStatusCounts(${STATUS_COUNT_FILTER_VARS}) {
    orderStatusCounts(${STATUS_COUNT_FILTER_ARGS}) {
      status
      count
    }
  }
`;

export async function menuOrderStatusCounts(menuToken: string, namespaceSlug: string, params: OrdersFilter = {}): Promise<Record<string, number>> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderStatusCounts: { status: string; count: number }[] }>(
      OrderStatusCountsDocument,
      filterVars(params),
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return Object.fromEntries(res.orderStatusCounts.map((c) => [c.status, c.count]));
  }, namespaceSlug);
}

// Combines orders + ordersSummary + orderStatusCounts into one request —
// these three are always refetched together (initial load, every live-update
// event/poll tick, branch/type filter changes, ...), so what used to be 3
// round trips per refresh is now 1. orderStatusCounts deliberately only
// references $branchIds/$types here (not the fuller search/date-range/
// sourceTag/participant vars, even though this one query declares them for
// orders/ordersSummary) — matching the status cards' existing "quick filter
// only" scope, unaffected by the "more filters" report panel.
const OrdersBundleDocument = /* GraphQL */ `
  query OrdersBundle($filter: DefaultFilterInput, ${ORDER_FILTER_VARS}) {
    orders(filter: $filter, ${ORDER_FILTER_ARGS}) {
      rows {
        id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount discountType discountValue discountItemId paidAmount
      }
      info { count }
    }
    ordersSummary(${ORDER_FILTER_ARGS}) {
      count
      totalAmount
    }
    orderStatusCounts(branchIds: $branchIds, types: $types) {
      status
      count
    }
  }
`;

export type OrdersBundle = {
  orders: MenuOrder[];
  count: number;
  summary: OrdersSummary;
  statusCounts: Record<string, number>;
};

export async function menuOrdersBundle(menuToken: string, namespaceSlug: string, params: OrdersFilter = {}): Promise<OrdersBundle> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{
      orders: { rows: MenuOrder[]; info: { count: number } };
      ordersSummary: OrdersSummary;
      orderStatusCounts: { status: string; count: number }[];
    }>(
      OrdersBundleDocument,
      {
        filter: { pagination: { page: params.page || 1, length: params.length || 'FIFTY' } },
        ...filterVars(params),
      },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return {
      orders: res.orders.rows,
      count: res.orders.info.count,
      summary: res.ordersSummary,
      statusCounts: Object.fromEntries(res.orderStatusCounts.map((c) => [c.status, c.count])),
    };
  }, namespaceSlug);
}
