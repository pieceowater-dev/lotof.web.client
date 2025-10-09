import { hubClient, setGlobalAuthToken } from '../clients';
import { MeDocument, type MeQuery } from '@gql-hub';

export async function hubMe(token: string): Promise<NonNullable<MeQuery['me']>> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<MeQuery>(MeDocument);
  if (!data.me) throw new Error('User not found in me query response');
  return data.me;
}