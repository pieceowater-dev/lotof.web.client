import { contactsClient, setContactsAppToken } from '../clients';
import { isReauthRequired, requestReauth } from '@/utils/reauth';

/** One authenticated Contacts GraphQL call for a namespace. */
export async function crmRequest<T>(
  token: string,
  namespace: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  setContactsAppToken(token);
  try {
    return await contactsClient.request<T>(query as any, variables, { headers: { Namespace: namespace } });
  } catch (e) {
    // A sensitive action wants a fresh Google sign-in: show the confirm prompt, then let the caller see the error.
    if (isReauthRequired(e)) requestReauth();
    throw e;
  }
}
