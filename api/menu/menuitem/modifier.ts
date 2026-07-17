import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const AddModifierToItemDocument = /* GraphQL */ `
  mutation AddModifierToItem($input: AddModifierToItemInput!) {
    addModifierToItem(input: $input) { success }
  }
`;

const RemoveModifierFromItemDocument = /* GraphQL */ `
  mutation RemoveModifierFromItem($input: RemoveModifierFromItemInput!) {
    removeModifierFromItem(input: $input) { success }
  }
`;

export async function menuAddModifierToItem(menuToken: string, namespaceSlug: string, menuItemId: string, modifierGroupId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addModifierToItem: { success: boolean } }>(
      AddModifierToItemDocument,
      { input: { menuItemId, modifierGroupId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addModifierToItem.success;
  }, namespaceSlug);
}

export async function menuRemoveModifierFromItem(menuToken: string, namespaceSlug: string, menuItemId: string, modifierGroupId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeModifierFromItem: { success: boolean } }>(
      RemoveModifierFromItemDocument,
      { input: { menuItemId, modifierGroupId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeModifierFromItem.success;
  }, namespaceSlug);
}
