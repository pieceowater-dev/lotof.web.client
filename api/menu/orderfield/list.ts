import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type OrderFieldDataType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT';

export type MenuOrderField = {
  id: string;
  label: string;
  dataType: OrderFieldDataType;
  isRequired: boolean;
  options: string[];
  viewOrder: number;
  isActive: boolean;
};

export const ORDER_FIELD_FRAGMENT = 'id label dataType isRequired options viewOrder isActive';

const OrderFieldsDocument = /* GraphQL */ `
  query OrderFields($filter: DefaultFilterInput, $onlyActive: Boolean) {
    orderFields(filter: $filter, onlyActive: $onlyActive) {
      rows { ${ORDER_FIELD_FRAGMENT} }
      info { count }
    }
  }
`;

export async function menuOrderFieldsList(
  menuToken: string,
  namespaceSlug: string,
  opts: { onlyActive?: boolean } = {}
): Promise<{ fields: MenuOrderField[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderFields: { rows: MenuOrderField[]; info: { count: number } } }>(
      OrderFieldsDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } }, onlyActive: opts.onlyActive ?? false },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { fields: res.orderFields.rows, count: res.orderFields.info.count };
  }, namespaceSlug);
}
