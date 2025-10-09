import { hubClient, setGlobalAuthToken } from '../clients';
import { hubMe } from './me';
import { MutateMeDocument, type MutateMeMutation } from '@gql-hub';

export async function hubUpdateMe(token: string, username: string): Promise<MutateMeMutation['updateUser']> {
  setGlobalAuthToken(token);

  // Fetch current user ID
  const currentUser = await hubMe(token);
  const userId = currentUser.id;

  const data = await hubClient.request<MutateMeMutation>(MutateMeDocument, { id: userId, username });
  return data.updateUser;
}
