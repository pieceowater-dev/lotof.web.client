import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuModifierOption } from '@/api/menu/modifieroption/list';

export type UpdateModifierOptionInput = {
  id: string;
  name?: string;
  price?: number;
  sortOrder?: number;
};

const UpdateModifierOptionDocument = /* GraphQL */ `
  mutation UpdateModifierOption($input: UpdateModifierOptionInput!) {
    updateModifierOption(input: $input) { id groupId name price sortOrder }
  }
`;

export async function menuUpdateModifierOption(menuToken: string, namespaceSlug: string, input: UpdateModifierOptionInput): Promise<MenuModifierOption> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateModifierOption: MenuModifierOption }>(
      UpdateModifierOptionDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateModifierOption;
  }, namespaceSlug);
}
