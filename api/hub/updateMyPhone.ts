import { hubClient, setGlobalAuthToken } from '../clients';
import { hubMe } from './me';
import { UpdateMyPhoneDocument, type UpdateMyPhoneMutation } from '@gql-hub';

export async function hubUpdateMyPhone(token: string, phone: string): Promise<UpdateMyPhoneMutation['updateUser']> {
  setGlobalAuthToken(token);

  // username is a required input field on updateUser -- fetch the current
  // one so a phone-only update doesn't clobber it.
  const currentUser = await hubMe(token);

  const data = await hubClient.request<UpdateMyPhoneMutation>(UpdateMyPhoneDocument, {
    id: currentUser.id,
    username: currentUser.username,
    phone,
  });
  return data.updateUser;
}

// Combined save for the profile settings form, where both fields are edited
// together in one submission -- avoids the two-sequential-mutation race the
// dedicated phone-only/username-only helpers would otherwise have.
export async function hubUpdateProfile(
  token: string,
  input: { id: string; username: string; phone: string }
): Promise<UpdateMyPhoneMutation['updateUser']> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<UpdateMyPhoneMutation>(UpdateMyPhoneDocument, input);
  return data.updateUser;
}
