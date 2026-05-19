import { capitalClient, setGlobalAuthToken } from '@/api/clients';

export type CapitalAdmin = {
  id: string;
  userId: string;
  role: number;
  invitedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

const CAPITAL_ADMINS_QUERY = /* GraphQL */ `
  query CapitalAdmins {
    capitalAdmins {
      id
      userId
      role
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

const CAPITAL_ADMIN_BY_USER_ID_QUERY = /* GraphQL */ `
  query CapitalAdminByUserId($userId: String!) {
    capitalAdminByUserId(userId: $userId) {
      id
      userId
      role
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

const INVITE_CAPITAL_ADMIN_MUTATION = /* GraphQL */ `
  mutation InviteCapitalAdmin($userId: String!, $role: Int!) {
    inviteCapitalAdmin(userId: $userId, role: $role) {
      id
      userId
      role
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

const CHANGE_CAPITAL_ADMIN_ROLE_MUTATION = /* GraphQL */ `
  mutation ChangeCapitalAdminRole($id: String!, $role: Int!) {
    changeCapitalAdminRole(id: $id, role: $role) {
      id
      userId
      role
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

const REMOVE_CAPITAL_ADMIN_MUTATION = /* GraphQL */ `
  mutation RemoveCapitalAdmin($id: String!) {
    removeCapitalAdmin(id: $id)
  }
`;

export async function capitalListAdmins(token: string): Promise<CapitalAdmin[]> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ capitalAdmins: CapitalAdmin[] }>(CAPITAL_ADMINS_QUERY);
  return res.capitalAdmins ?? [];
}

export async function capitalGetAdminByUserId(token: string, userId: string): Promise<CapitalAdmin | null> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ capitalAdminByUserId: CapitalAdmin | null }>(CAPITAL_ADMIN_BY_USER_ID_QUERY, { userId });
  return res.capitalAdminByUserId ?? null;
}

export async function capitalInviteAdmin(token: string, userId: string, role: number): Promise<CapitalAdmin> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ inviteCapitalAdmin: CapitalAdmin }>(INVITE_CAPITAL_ADMIN_MUTATION, { userId, role });
  return res.inviteCapitalAdmin;
}

export async function capitalChangeAdminRole(token: string, id: string, role: number): Promise<CapitalAdmin> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ changeCapitalAdminRole: CapitalAdmin }>(CHANGE_CAPITAL_ADMIN_ROLE_MUTATION, { id, role });
  return res.changeCapitalAdminRole;
}

export async function capitalRemoveAdmin(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ removeCapitalAdmin: boolean }>(REMOVE_CAPITAL_ADMIN_MUTATION, { id });
  return !!res.removeCapitalAdmin;
}
