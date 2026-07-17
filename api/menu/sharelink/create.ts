import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuShareLink } from '@/api/menu/sharelink/list';

export type CreateShareLinkInput = {
  branchId?: string;
  label: string;
  sourceTag: string;
};

const CreateShareLinkDocument = /* GraphQL */ `
  mutation CreateShareLink($input: CreateShareLinkInput!) {
    createShareLink(input: $input) { id branchId label sourceTag createdAt }
  }
`;

export async function menuCreateShareLink(menuToken: string, namespaceSlug: string, input: CreateShareLinkInput): Promise<MenuShareLink> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createShareLink: MenuShareLink }>(
      CreateShareLinkDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createShareLink;
  }, namespaceSlug);
}
