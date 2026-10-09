import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import { ORDER_FIELD_FRAGMENT, type MenuOrderField } from '@/api/menu/orderfield/list';
import type { OrderFieldInput } from '@/api/menu/orderfield/create';

const UpdateOrderFieldDocument = /* GraphQL */ `
  mutation UpdateOrderField($input: UpdateOrderFieldInput!) {
    updateOrderField(input: $input) { ${ORDER_FIELD_FRAGMENT} }
  }
`;

// A full save: the backend treats every omitted field as "reset", so callers
// always send the whole definition.
export async function menuUpdateOrderField(
  menuToken: string,
  namespaceSlug: string,
  id: string,
  input: OrderFieldInput & { isActive: boolean }
): Promise<MenuOrderField> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderField: MenuOrderField }>(
      UpdateOrderFieldDocument,
      { input: { id, ...input } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderField;
  }, namespaceSlug);
}
