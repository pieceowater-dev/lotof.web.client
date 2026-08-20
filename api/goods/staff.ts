import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { GoodsStaffRole } from '@/composables/useGoodsStaffRole';

export type GoodsStaff = {
  id: string;
  userId: string;
  role: GoodsStaffRole;
};

const StaffListDocument = /* GraphQL */ `
  query Staff($filter: DefaultFilterInput) {
    staff(filter: $filter) {
      rows { id userId role }
      info { count }
    }
  }
`;

export async function goodsListStaff(goodsToken: string, namespaceSlug: string): Promise<{ staff: GoodsStaff[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ staff: { rows: GoodsStaff[]; info: { count: number } } }>(
      StaffListDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { staff: res.staff.rows, count: res.staff.info.count };
  }, namespaceSlug);
}

const CreateStaffDocument = /* GraphQL */ `
  mutation CreateStaff($input: CreateStaffInput!) {
    createStaff(input: $input) { id userId role }
  }
`;

export async function goodsCreateStaff(goodsToken: string, namespaceSlug: string, userId: string, role: GoodsStaffRole): Promise<GoodsStaff> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createStaff: GoodsStaff }>(
      CreateStaffDocument,
      { input: { userId, role } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createStaff;
  }, namespaceSlug);
}

const UpdateStaffRoleDocument = /* GraphQL */ `
  mutation UpdateStaffRole($input: UpdateStaffRoleInput!) {
    updateStaffRole(input: $input) { id userId role }
  }
`;

export async function goodsUpdateStaffRole(goodsToken: string, namespaceSlug: string, id: string, role: GoodsStaffRole): Promise<GoodsStaff> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateStaffRole: GoodsStaff }>(
      UpdateStaffRoleDocument,
      { input: { id, role } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateStaffRole;
  }, namespaceSlug);
}

const DeleteStaffDocument = /* GraphQL */ `
  mutation DeleteStaff($id: ID!) {
    deleteStaff(id: $id) { success }
  }
`;

export async function goodsDeleteStaff(goodsToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteStaff: { success: boolean } }>(
      DeleteStaffDocument,
      { id },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteStaff.success;
  }, namespaceSlug);
}

const SetPinDocument = /* GraphQL */ `
  mutation SetPin($pin: String!) {
    setPin(pin: $pin) { success }
  }
`;

export async function goodsSetPin(goodsToken: string, namespaceSlug: string, pin: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ setPin: { success: boolean } }>(
      SetPinDocument,
      { pin },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.setPin.success;
  }, namespaceSlug);
}

const VerifyPinDocument = /* GraphQL */ `
  mutation VerifyPin($pin: String!) {
    verifyPin(pin: $pin) { valid staffId lockedOut }
  }
`;

export type VerifyPinResult = { valid: boolean; staffId?: string | null; lockedOut: boolean };

export async function goodsVerifyPin(goodsToken: string, namespaceSlug: string, pin: string): Promise<VerifyPinResult> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ verifyPin: VerifyPinResult }>(
      VerifyPinDocument,
      { pin },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.verifyPin;
  }, namespaceSlug);
}
