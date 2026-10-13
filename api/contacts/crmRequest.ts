import { contactsClient, setContactsAppToken } from '../clients';

/** One authenticated Contacts GraphQL call for a namespace. */
export async function crmRequest<T>(
  token: string,
  namespace: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  setContactsAppToken(token);
  return contactsClient.request<T>(query as any, variables, { headers: { Namespace: namespace } });
}
