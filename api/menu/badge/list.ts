import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuBadge = {
  id: string;
  text: string;
  bgColor: string;
  textColor: string;
  icon?: string | null;
};

const BadgesDocument = /* GraphQL */ `
  query Badges($filter: DefaultFilterInput) {
    badges(filter: $filter) {
      rows { id text bgColor textColor icon }
      info { count }
    }
  }
`;

export async function menuBadgesList(menuToken: string, namespaceSlug: string): Promise<{ badges: MenuBadge[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ badges: { rows: MenuBadge[]; info: { count: number } } }>(
      BadgesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { badges: res.badges.rows, count: res.badges.info.count };
  }, namespaceSlug);
}
