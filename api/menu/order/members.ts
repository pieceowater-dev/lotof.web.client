import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuOrderMember = {
  id: string;
  orderId: string;
  userId: string;
  role: string;
};

const OrderMembersDocument = /* GraphQL */ `
  query OrderMembers($orderId: String!) {
    orderMembers(orderId: $orderId) {
      rows { id orderId userId role }
    }
  }
`;

export async function menuOrderMembers(menuToken: string, namespaceSlug: string, orderId: string): Promise<MenuOrderMember[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderMembers: { rows: MenuOrderMember[] } }>(
      OrderMembersDocument,
      { orderId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.orderMembers.rows;
  }, namespaceSlug);
}

const AddOrderMemberDocument = /* GraphQL */ `
  mutation AddOrderMember($input: AddOrderMemberInput!) {
    addOrderMember(input: $input) { id orderId userId role }
  }
`;

export async function menuAddOrderMember(menuToken: string, namespaceSlug: string, orderId: string, userId: string, role: string): Promise<MenuOrderMember> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addOrderMember: MenuOrderMember }>(
      AddOrderMemberDocument,
      { input: { orderId, userId, role } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addOrderMember;
  }, namespaceSlug);
}

const RemoveOrderMemberDocument = /* GraphQL */ `
  mutation RemoveOrderMember($id: ID!) {
    removeOrderMember(id: $id) { success }
  }
`;

export async function menuRemoveOrderMember(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeOrderMember: { success: boolean } }>(
      RemoveOrderMemberDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeOrderMember.success;
  }, namespaceSlug);
}
