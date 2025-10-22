import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// Keep schema-agnostic (no codegen types required)
const AtraceCheckDocument = /* GraphQL */ `
  mutation AtraceCheck($input: CheckInput!) {
    check(input: $input) {
      id
      postId
      userId
      timestamp
      method
    }
  }
`;

export type AtraceCheckInput = {
  method: string; // GraphQL enum name, e.g., METHOD_QR_STATIC
  postId: string;
  secret: string;
};

export type AtraceCheckResult = {
  id: string;
  postId: string;
  userId: string;
  timestamp: number;
  method: string;
} | null;

export async function atraceCheck(
  atraceToken: string,
  namespaceSlug: string,
  input: AtraceCheckInput
): Promise<AtraceCheckResult> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ check: AtraceCheckResult }>(
    AtraceCheckDocument,
    { input },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      },
    },
  );
  return res.check || null;
}
