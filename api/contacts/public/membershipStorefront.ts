import { GraphQLClient } from 'graphql-request';
import { getApiBaseUrl } from '@/utils/api-base';
import { getDeviceHeaders } from '@/utils/device';
import { CookieKeys } from '@/utils/storageKeys';
import type { MembershipPlan, MembershipBrandSettings, ClientMembership } from '@/api/contacts/memberships';

// Unauthenticated reads for the public memberships storefront
// (/to/[namespace]/memberships). Only the Namespace header scopes the tenant;
// requestMembership / patronMemberships additionally carry a Patron bearer.
// Mirrors api/menu/public/storefront.ts.

export type { MembershipPlan, MembershipBrandSettings, ClientMembership };

export interface MembershipStorefront {
  brand: MembershipBrandSettings;
  plans: MembershipPlan[];
}

async function baseHeaders(namespaceSlug: string): Promise<Record<string, string>> {
  const patronToken = useCookie<string | null>(CookieKeys.PATRON_TOKEN).value;
  const dev = await getDeviceHeaders();
  const h: Record<string, string> = { Namespace: namespaceSlug, ...dev };
  if (patronToken) h.Authorization = `Bearer ${patronToken}`;
  return h;
}

async function client(namespaceSlug: string): Promise<GraphQLClient> {
  return new GraphQLClient(`${getApiBaseUrl('contacts')}/query`, {
    credentials: 'omit' as any,
    headers: (await baseHeaders(namespaceSlug)) as any,
  });
}

async function withMigrationRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 600): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const migrating = msg.includes('tenant migration in progress') || msg.includes('migration in progress');
      if (!migrating || attempt === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('unreachable');
}

const BRAND_FIELDS = `
  id name logoUrl coverImageUrl primaryColor secondaryColor welcomeMessage currencyCode
  socialLinks seoTitle seoDescription address city phone lat lng
  acceptRequests autoApproveRequests listedInCatalog
`;
const PLAN_FIELDS = `
  id name description price currency durationDays visitLimit freezeDaysAllowed
  color imageUrl category status listedOnStorefront sortOrder hasPin createdAt updatedAt
`;
const MEMBERSHIP_FIELDS = `
  id clientId membershipPlanId planNameSnapshot planPriceSnapshot currency status
  startDate endDate freezeUntil visitsTotal visitsUsed pricePaid source patronId
  requestNote rejectReason activatedAt cancelledAt createdAt updatedAt
`;

const STOREFRONT_QUERY = /* GraphQL */ `
  query MembershipStorefront {
    membershipStorefront {
      brand { ${BRAND_FIELDS} }
      plans { ${PLAN_FIELDS} }
    }
  }
`;

export async function getMembershipStorefront(namespaceSlug: string): Promise<MembershipStorefront> {
  const c = await client(namespaceSlug);
  const data = await withMigrationRetry(() =>
    c.request<{ membershipStorefront: MembershipStorefront | null }>(STOREFRONT_QUERY),
  );
  if (!data.membershipStorefront) throw new Error('storefront not available');
  return data.membershipStorefront;
}

export async function requestMembership(
  namespaceSlug: string,
  input: { membershipPlanId: string; name: string; phone: string; note?: string },
): Promise<ClientMembership> {
  const c = await client(namespaceSlug);
  const data = await c.request<{ requestMembership: ClientMembership }>(
    /* GraphQL */ `
      mutation RequestMembership($input: RequestMembershipInput!) {
        requestMembership(input: $input) { ${MEMBERSHIP_FIELDS} }
      }
    `,
    { input },
  );
  return data.requestMembership;
}

export async function getPatronMemberships(namespaceSlug: string): Promise<ClientMembership[]> {
  const c = await client(namespaceSlug);
  const data = await c.request<{ patronMemberships: ClientMembership[] }>(
    /* GraphQL */ `
      query PatronMemberships {
        patronMemberships { ${MEMBERSHIP_FIELDS} }
      }
    `,
  );
  return data.patronMemberships ?? [];
}
