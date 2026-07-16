import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBadge } from '@/api/menu/badge/list';

export type UpdateBadgeInput = {
  id: string;
  text?: string;
  bgColor?: string;
  textColor?: string;
  icon?: string;
};

const UpdateBadgeDocument = /* GraphQL */ `
  mutation UpdateBadge($input: UpdateBadgeInput!) {
    updateBadge(input: $input) { id text bgColor textColor icon }
  }
`;

export async function menuUpdateBadge(menuToken: string, namespaceSlug: string, input: UpdateBadgeInput): Promise<MenuBadge> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateBadge: MenuBadge }>(
      UpdateBadgeDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateBadge;
  }, namespaceSlug);
}
