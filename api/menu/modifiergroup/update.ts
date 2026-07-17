import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuModifierGroup } from '@/api/menu/modifiergroup/list';

export type UpdateModifierGroupInput = {
  id: string;
  name?: string;
  type?: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
};

const UpdateModifierGroupDocument = /* GraphQL */ `
  mutation UpdateModifierGroup($input: UpdateModifierGroupInput!) {
    updateModifierGroup(input: $input) { id name type minSelect maxSelect isRequired }
  }
`;

export async function menuUpdateModifierGroup(menuToken: string, namespaceSlug: string, input: UpdateModifierGroupInput): Promise<MenuModifierGroup> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateModifierGroup: MenuModifierGroup }>(
      UpdateModifierGroupDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateModifierGroup;
  }, namespaceSlug);
}
