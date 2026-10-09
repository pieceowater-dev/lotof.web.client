import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const UpdateOrderCustomFieldsDocument = /* GraphQL */ `
  mutation UpdateOrderCustomFields($orderId: ID!, $customFields: String!) {
    updateOrderCustomFields(orderId: $orderId, customFields: $customFields) { id customFields }
  }
`;

export async function menuUpdateOrderCustomFields(
  menuToken: string,
  namespaceSlug: string,
  orderId: string,
  customFields: string
): Promise<{ id: string; customFields: string }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderCustomFields: { id: string; customFields: string } }>(
      UpdateOrderCustomFieldsDocument,
      { orderId, customFields },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderCustomFields;
  }, namespaceSlug);
}
