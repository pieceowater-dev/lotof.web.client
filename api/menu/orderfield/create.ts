import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import { ORDER_FIELD_FRAGMENT, type MenuOrderField, type OrderFieldDataType } from '@/api/menu/orderfield/list';

const CreateOrderFieldDocument = /* GraphQL */ `
  mutation CreateOrderField($input: CreateOrderFieldInput!) {
    createOrderField(input: $input) { ${ORDER_FIELD_FRAGMENT} }
  }
`;

export type OrderFieldInput = {
  label: string;
  dataType: OrderFieldDataType;
  isRequired: boolean;
  options: string[];
  viewOrder: number;
};

export async function menuCreateOrderField(menuToken: string, namespaceSlug: string, input: OrderFieldInput): Promise<MenuOrderField> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createOrderField: MenuOrderField }>(
      CreateOrderFieldDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createOrderField;
  }, namespaceSlug);
}
