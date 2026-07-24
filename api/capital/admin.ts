import { capitalClient, setGlobalAuthToken } from '@/api/clients';

export type CapitalAdmin = {
  id: string;
  userId: string;
  email?: string | null;
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
      email
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
      email
      role
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

const INVITE_CAPITAL_ADMIN_MUTATION = /* GraphQL */ `
  mutation InviteCapitalAdmin($email: String!, $role: Int!) {
    inviteCapitalAdmin(email: $email, role: $role) {
      id
      userId
      email
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
      email
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

export async function capitalInviteAdmin(token: string, email: string, role: number): Promise<CapitalAdmin> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ inviteCapitalAdmin: CapitalAdmin }>(INVITE_CAPITAL_ADMIN_MUTATION, { email, role });
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

export type AdminBillingInfo = {
  adminAccounts: {
    accounts: Array<{
      id: string;
      namespace: string;
      namespaceTitle?: string | null;
      namespaceSlug?: string | null;
      displayName: string;
      billingEmail: string;
      status: string;
      createdAt: string;
      owner?: {
        id: string;
        username: string;
        email: string;
      } | null;
      subscriptions?: {
        subscriptions: Array<{
          id: string;
          planId: string;
          status: string;
        }>;
      } | null;
    }>;
    total: number;
  };
  adminPlans: Array<{
    id: string;
    code: string;
    name: string;
    description?: string | null;
    applicationCode: string;
    currency: string;
    interval: string;
    amountCents: number;
    trialDays: number;
    status: string;
    metadataJson?: string | null;
  }>;
  adminInvoices: {
    invoices: Array<{
      id: string;
      accountId: string;
      number: string;
      status: string;
      totalCents: number;
      currency: string;
      issueDate: string;
      dueDate: string;
    }>;
    total: number;
  };
  adminSubscriptions: {
    subscriptions: Array<{
      id: string;
      accountId: string;
      planId: string;
      status: string;
      quantity: number;
      startsAt: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
    }>;
    total: number;
  };
};

const GET_ADMIN_BILLING_INFO_QUERY = /* GraphQL */ `
  query GetAdminBillingInfo($page: Int, $pageSize: Int, $namespace: String, $applicationCode: String) {
    adminAccounts(page: $page, pageSize: $pageSize, applicationCode: $applicationCode) {
      accounts {
        id
        namespace
        namespaceTitle
        namespaceSlug
        displayName
        billingEmail
        status
        createdAt
        owner {
          id
          username
          email
        }
        subscriptions {
          subscriptions {
            id
            planId
            status
          }
        }
      }
      total
    }
    adminPlans(applicationCode: $applicationCode) {
      id
      code
      name
      description
      applicationCode
      currency
      interval
      amountCents
      trialDays
      status
      metadataJson
    }
    adminInvoices(page: $page, pageSize: $pageSize, namespace: $namespace, applicationCode: $applicationCode) {
      invoices {
        id
        accountId
        number
        status
        totalCents
        currency
        issueDate
        dueDate
      }
      total
    }
    adminSubscriptions(page: $page, pageSize: $pageSize, namespace: $namespace, applicationCode: $applicationCode) {
      subscriptions {
        id
        accountId
        planId
        status
        quantity
        startsAt
        currentPeriodStart
        currentPeriodEnd
      }
      total
    }
  }
`;

export async function capitalGetAdminBillingInfo(
  token: string, 
  page: number = 1, 
  pageSize: number = 20, 
  namespace?: string, 
  applicationCode?: string
): Promise<AdminBillingInfo> {
  setGlobalAuthToken(token);
  return await capitalClient.request<AdminBillingInfo>(GET_ADMIN_BILLING_INFO_QUERY, { 
    page, 
    pageSize, 
    namespace: namespace || null,
    applicationCode: applicationCode || null
  });
}

export async function capitalCreatePlan(token: string, input: any) {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation CreatePlan($input: CreatePlanInput!) {
      createPlan(input: $input) {
        id
      }
    }
  `;
  return await capitalClient.request(mutation, { input });
}

export async function capitalUpdatePlan(token: string, id: string, input: any) {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation UpdatePlan($id: String!, $input: UpdatePlanInput!) {
      updatePlan(id: $id, input: $input) {
        id
      }
    }
  `;
  return await capitalClient.request(mutation, { id, input });
}

export async function capitalArchivePlan(token: string, id: string) {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation ArchivePlan($id: String!) {
      archivePlan(id: $id) {
        id
      }
    }
  `;
  return await capitalClient.request(mutation, { id });
}

export type ContactSettings = {
  phone?: string | null;
  whatsapp?: string | null;
  updatedAt?: string | null;
};

// contactSettings is @auth (any logged-in user, not namespace-scoped) --
// used both by the admin console editor and by any plans page showing the
// "contact us to subscribe" fallback.
export async function capitalGetContactSettings(token: string): Promise<ContactSettings | null> {
  setGlobalAuthToken(token);
  const query = /* GraphQL */ `
    query ContactSettings {
      contactSettings {
        phone
        whatsapp
        updatedAt
      }
    }
  `;
  const res = await capitalClient.request<{ contactSettings: ContactSettings | null }>(query);
  return res.contactSettings ?? null;
}

export async function capitalUpdateContactSettings(token: string, phone: string, whatsapp: string): Promise<ContactSettings> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation UpdateContactSettings($phone: String, $whatsapp: String) {
      updateContactSettings(phone: $phone, whatsapp: $whatsapp) {
        phone
        whatsapp
        updatedAt
      }
    }
  `;
  const res = await capitalClient.request<{ updateContactSettings: ContactSettings }>(mutation, { phone, whatsapp });
  return res.updateContactSettings;
}
