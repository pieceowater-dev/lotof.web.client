import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuModifierOption } from '@/api/menu/modifieroption/list';

export type CreateModifierOptionInput = {
  groupId: string;
  name: string;
  price: number;
  sortOrder?: number;
};

const CreateModifierOptionDocument = /* GraphQL */ `
  mutation CreateModifierOption($input: CreateModifierOptionInput!) {
    createModifierOption(input: $input) { id groupId name price sortOrder }
  }
`;

export async function menuCreateModifierOption(menuToken: string, namespaceSlug: string, input: CreateModifierOptionInput): Promise<MenuModifierOption> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createModifierOption: MenuModifierOption }>(
      CreateModifierOptionDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createModifierOption;
  }, namespaceSlug);
}
