import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh, resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceMemberSalary = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  comment?: string;
  updatedAt: number;
  overtimeRateId?: string | null;
  penaltyRuleIds: string[];
};

const MEMBER_SALARY_FIELDS = `
  id
  userId
  amount
  currency
  comment
  updatedAt
  overtimeRateId
  penaltyRuleIds
`;

const GET_MEMBER_SALARY = `
  query GetMemberSalary($userId: ID) {
    getMemberSalary(input: { userId: $userId }) { ${MEMBER_SALARY_FIELDS} }
  }
`;

const SET_MEMBER_SALARY = `
  mutation SetMemberSalary($userId: ID!, $amount: Float!, $currency: String!, $comment: String, $overtimeRateId: ID, $penaltyRuleIds: [ID!]) {
    setMemberSalary(input: { userId: $userId, amount: $amount, currency: $currency, comment: $comment, overtimeRateId: $overtimeRateId, penaltyRuleIds: $penaltyRuleIds }) {
      ${MEMBER_SALARY_FIELDS}
    }
  }
`;

// userId omitted/undefined resolves to "my own salary" server-side.
// Returns null if no salary has been set yet for that member (the backend
// errors with "record not found" rather than returning null, since the
// schema's getMemberSalary is non-nullable -- treat that specific case as
// an empty state, not a failure).
export async function atraceGetMemberSalary(userId?: string, nsSlug?: string): Promise<AtraceMemberSalary | null> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    try {
      const devHeaders = await getDeviceHeaders();
      const response = await atraceClient.request<{ getMemberSalary: AtraceMemberSalary }>(
        GET_MEMBER_SALARY,
        { userId: userId ?? null },
        { headers: { Namespace: namespace, ...devHeaders } }
      );
      return response.getMemberSalary;
    } catch (e: any) {
      const notFound = e?.response?.errors?.some((err: any) =>
        String(err?.message || '').toLowerCase().includes('record not found')
      );
      if (notFound) return null;
      throw e;
    }
  }, namespace);
}

export async function atraceSetMemberSalary(
  userId: string,
  amount: number,
  currency: string,
  comment?: string,
  overtimeRateId?: string | null,
  penaltyRuleIds?: string[],
  nsSlug?: string
): Promise<AtraceMemberSalary> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ setMemberSalary: AtraceMemberSalary }>(
      SET_MEMBER_SALARY,
      {
        userId,
        amount,
        currency,
        comment: comment ?? null,
        overtimeRateId: overtimeRateId || null,
        penaltyRuleIds: penaltyRuleIds && penaltyRuleIds.length > 0 ? penaltyRuleIds : null,
      },
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.setMemberSalary;
  }, namespace);
}
