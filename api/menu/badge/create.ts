import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBadge } from '@/api/menu/badge/list';

export type CreateBadgeInput = {
  text: string;
  bgColor?: string;
  textColor?: string;
  icon?: string;
};

const CreateBadgeDocument = /* GraphQL */ `
  mutation CreateBadge($input: CreateBadgeInput!) {
    createBadge(input: $input) { id text bgColor textColor icon }
  }
`;

export async function menuCreateBadge(menuToken: string, namespaceSlug: string, input: CreateBadgeInput): Promise<MenuBadge> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createBadge: MenuBadge }>(
      CreateBadgeDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createBadge;
  }, namespaceSlug);
}
