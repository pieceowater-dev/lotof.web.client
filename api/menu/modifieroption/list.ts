import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuModifierOption = {
  id: string;
  groupId: string;
  name: string;
  price: number;
  sortOrder: number;
};

const ModifierOptionsDocument = /* GraphQL */ `
  query ModifierOptions($groupId: String!) {
    modifierOptions(groupId: $groupId) {
      rows { id groupId name price sortOrder }
    }
  }
`;

export async function menuModifierOptionsList(menuToken: string, namespaceSlug: string, groupId: string): Promise<MenuModifierOption[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ modifierOptions: { rows: MenuModifierOption[] } }>(
      ModifierOptionsDocument,
      { groupId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.modifierOptions.rows;
  }, namespaceSlug);
}
