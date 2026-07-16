import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const AddBadgeToItemDocument = /* GraphQL */ `
  mutation AddBadgeToItem($input: AddBadgeToItemInput!) {
    addBadgeToItem(input: $input) { success }
  }
`;

const RemoveBadgeFromItemDocument = /* GraphQL */ `
  mutation RemoveBadgeFromItem($input: RemoveBadgeFromItemInput!) {
    removeBadgeFromItem(input: $input) { success }
  }
`;

export async function menuAddBadgeToItem(menuToken: string, namespaceSlug: string, menuItemId: string, badgeId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addBadgeToItem: { success: boolean } }>(
      AddBadgeToItemDocument,
      { input: { menuItemId, badgeId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addBadgeToItem.success;
  }, namespaceSlug);
}

export async function menuRemoveBadgeFromItem(menuToken: string, namespaceSlug: string, menuItemId: string, badgeId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeBadgeFromItem: { success: boolean } }>(
      RemoveBadgeFromItemDocument,
      { input: { menuItemId, badgeId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeBadgeFromItem.success;
  }, namespaceSlug);
}
