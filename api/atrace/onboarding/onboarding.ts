import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh, resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceOnboardingStatus = 'pending' | 'approved' | 'rejected';

export type AtraceOnboardingRequest = {
  id: string;
  userId: string;
  postId?: string | null;
  postTitle?: string | null;
  username: string;
  email?: string | null;
  status: AtraceOnboardingStatus;
  requestedAt: string;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
};

const ONBOARDING_FIELDS = `
  id
  userId
  postId
  postTitle
  username
  email
  status
  requestedAt
  decidedByUserId
  decidedAt
`;

const REQUEST_ONBOARDING = /* GraphQL */ `
  mutation RequestOnboarding($input: RequestOnboardingInput!) {
    requestOnboarding(input: $input) { ${ONBOARDING_FIELDS} }
  }
`;

// No atrace token exists yet for this caller -- that's the whole point of
// this call -- so it authenticates with the hub token instead, same as
// atraceGetAppToken (see @hubAuth on the gateway side).
export async function atraceRequestOnboarding(
  hubToken: string,
  namespaceSlug: string,
  postId: string | undefined,
  username: string,
  email?: string
): Promise<AtraceOnboardingRequest | null> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ requestOnboarding: AtraceOnboardingRequest | null }>(
    REQUEST_ONBOARDING,
    { input: { postId: postId ?? null, username, email: email ?? null } },
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } }
  );
  return res.requestOnboarding;
}

async function headers(namespace: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespace, ...devHeaders };
}

const GET_ONBOARDING_REQUESTS = /* GraphQL */ `
  query GetOnboardingRequests($status: String) {
    getOnboardingRequests(status: $status) { ${ONBOARDING_FIELDS} }
  }
`;

export async function atraceGetOnboardingRequests(
  status?: AtraceOnboardingStatus,
  nsSlug?: string
): Promise<AtraceOnboardingRequest[]> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getOnboardingRequests: AtraceOnboardingRequest[] }>(
      GET_ONBOARDING_REQUESTS,
      { status: status ?? null },
      { headers: await headers(namespace) }
    );
    return response.getOnboardingRequests;
  }, namespace);
}

const DECIDE_ONBOARDING_REQUEST = /* GraphQL */ `
  mutation DecideOnboardingRequest($id: ID!, $approve: Boolean!) {
    decideOnboardingRequest(id: $id, approve: $approve) { ${ONBOARDING_FIELDS} }
  }
`;

export async function atraceDecideOnboardingRequest(
  id: string,
  approve: boolean,
  nsSlug?: string
): Promise<AtraceOnboardingRequest> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ decideOnboardingRequest: AtraceOnboardingRequest }>(
      DECIDE_ONBOARDING_REQUEST,
      { id, approve },
      { headers: await headers(namespace) }
    );
    return response.decideOnboardingRequest;
  }, namespace);
}
