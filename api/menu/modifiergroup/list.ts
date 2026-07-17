import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuModifierGroup = {
  id: string;
  name: string;
  type: string;
  minSelect: number;
  maxSelect?: number | null;
  isRequired: boolean;
};

const ModifierGroupsDocument = /* GraphQL */ `
  query ModifierGroups($filter: DefaultFilterInput) {
    modifierGroups(filter: $filter) {
      rows { id name type minSelect maxSelect isRequired }
      info { count }
    }
  }
`;

export async function menuModifierGroupsList(menuToken: string, namespaceSlug: string): Promise<{ groups: MenuModifierGroup[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ modifierGroups: { rows: MenuModifierGroup[]; info: { count: number } } }>(
      ModifierGroupsDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { groups: res.modifierGroups.rows, count: res.modifierGroups.info.count };
  }, namespaceSlug);
}
