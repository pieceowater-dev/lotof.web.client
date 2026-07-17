import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuModifierGroup } from '@/api/menu/modifiergroup/list';

export type CreateModifierGroupInput = {
  name: string;
  type: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
};

const CreateModifierGroupDocument = /* GraphQL */ `
  mutation CreateModifierGroup($input: CreateModifierGroupInput!) {
    createModifierGroup(input: $input) { id name type minSelect maxSelect isRequired }
  }
`;

export async function menuCreateModifierGroup(menuToken: string, namespaceSlug: string, input: CreateModifierGroupInput): Promise<MenuModifierGroup> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createModifierGroup: MenuModifierGroup }>(
      CreateModifierGroupDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createModifierGroup;
  }, namespaceSlug);
}
