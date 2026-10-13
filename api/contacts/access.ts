import { crmRequest } from './crmRequest';

// Which capabilities (e.g. "contacts.client.export") the caller has, so the
// interface can hide what the server would refuse anyway.
export async function contactsCan(token: string, ns: string, permissions: string[]): Promise<Record<string, boolean>> {
  const data = await crmRequest<{ contactsCan: Array<{ permission: string; allowed: boolean }> }>(
    token, ns,
    `query ContactsCan($permissions: [String!]!) { contactsCan(permissions: $permissions) { permission allowed } }`,
    { permissions },
  );
  return Object.fromEntries((data.contactsCan || []).map((r) => [r.permission, r.allowed]));
}
