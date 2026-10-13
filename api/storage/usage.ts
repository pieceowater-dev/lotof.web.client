import { menuClient, tasksClient, goodsClient, plansClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import { crmRequest } from '@/api/contacts/crmRequest';

// How much of a plan's storage quota a namespace uses, per app. The quota is
// the plan's `storage_mb` limit; limitBytes 0 means the plan sets none.
export type StorageApp = 'menu' | 'issues' | 'goods' | 'plans' | 'contacts';
export type StorageUsage = { usedBytes: number; files: number; limitBytes: number };

const QUERY = `query StorageUsage { storageUsage { usedBytes files limitBytes } }`;

export async function fetchStorageUsage(app: StorageApp, token: string, ns: string): Promise<StorageUsage> {
  const dev = await getDeviceHeaders();
  const req = async (client: { request: (...a: any[]) => Promise<any> }, header: string): Promise<StorageUsage> =>
    (await client.request(QUERY, undefined, { headers: { [header]: `Bearer ${token}`, Namespace: ns, ...dev } })).storageUsage;
  switch (app) {
    case 'menu': return menuRequestWithRefresh(() => req(menuClient, 'MenuAuthorization'), ns);
    case 'issues': return tasksRequestWithRefresh(() => req(tasksClient, 'IssuesAuthorization'), ns);
    case 'goods': return goodsRequestWithRefresh(() => req(goodsClient, 'GoodsAuthorization'), ns);
    case 'contacts': return (await crmRequest<{ storageUsage: StorageUsage }>(token, ns, QUERY)).storageUsage;
    default: return req(plansClient, 'PlansAuthorization');
  }
}
