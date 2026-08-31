import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

// Admin (back-office) membership API for lota Contacts. Hand-written gql
// against contactsClient (ContactsAuthorization header), same style as
// api/contacts/loyalty.ts. Public storefront + patron calls live in
// api/contacts/public/membershipStorefront.ts.

export type MembershipPlanStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type ClientMembershipStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'FROZEN'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REJECTED';

export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  durationDays: number;
  visitLimit: number;
  freezeDaysAllowed: number;
  color: string;
  imageUrl: string;
  category: string;
  status: MembershipPlanStatus;
  listedOnStorefront: boolean;
  sortOrder: number;
  hasPin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientMembership {
  id: string;
  clientId: string;
  membershipPlanId: string;
  planNameSnapshot: string;
  planPriceSnapshot: string;
  currency: string;
  status: ClientMembershipStatus;
  startDate: string;
  endDate: string;
  freezeUntil: string;
  visitsTotal: number;
  visitsUsed: number;
  pricePaid: string;
  source: 'ADMIN' | 'STOREFRONT';
  patronId: string;
  requestNote: string;
  rejectReason: string;
  activatedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipVisit {
  id: string;
  clientMembershipId: string;
  checkedInAt: string;
  checkedInBy: string;
  note: string;
}

export interface MembershipBrandSettings {
  id: string;
  name: string;
  logoUrl: string;
  coverImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  currencyCode: string;
  socialLinks: string;
  seoTitle: string;
  seoDescription: string;
  address: string;
  city: string;
  phone: string;
  lat: number;
  lng: number;
  acceptRequests: boolean;
  autoApproveRequests: boolean;
  listedInCatalog: boolean;
}

const PLAN_FIELDS = `
  id name description price currency durationDays visitLimit freezeDaysAllowed
  color imageUrl category status listedOnStorefront sortOrder hasPin createdAt updatedAt
`;

const MEMBERSHIP_FIELDS = `
  id clientId membershipPlanId planNameSnapshot planPriceSnapshot currency status
  startDate endDate freezeUntil visitsTotal visitsUsed pricePaid source patronId
  requestNote rejectReason activatedAt cancelledAt createdAt updatedAt
`;

const BRAND_FIELDS = `
  id name logoUrl coverImageUrl primaryColor secondaryColor welcomeMessage currencyCode
  socialLinks seoTitle seoDescription address city phone lat lng
  acceptRequests autoApproveRequests listedInCatalog
`;

function withToken(token: string) {
  if (token) setContactsAppToken(token);
}

// ── Plans ────────────────────────────────────────────────────────────────

export async function listMembershipPlans(
  token: string,
  opts: { search?: string; page?: number; length?: number } = {},
): Promise<{ rows: MembershipPlan[]; count: number }> {
  withToken(token);
  const query = gql`
    query MembershipPlans($filter: DefaultFilterInput) {
      membershipPlans(filter: $filter) {
        rows { ${PLAN_FIELDS} }
        info { count }
      }
    }
  `;
  const data = await contactsClient.request<{ membershipPlans: { rows: MembershipPlan[]; info: { count: number } } }>(
    query,
    {
      filter: {
        search: opts.search || undefined,
        pagination: { page: opts.page || 1, length: lengthEnum(opts.length || 100) },
      },
    },
  );
  return { rows: data.membershipPlans.rows, count: data.membershipPlans.info.count };
}

export interface MembershipPlanInput {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  durationDays?: number;
  visitLimit?: number;
  freezeDaysAllowed?: number;
  color?: string;
  imageUrl?: string;
  category?: string;
  status?: MembershipPlanStatus;
  listedOnStorefront?: boolean;
  sortOrder?: number;
  pin?: string;
}

export async function createMembershipPlan(token: string, input: MembershipPlanInput): Promise<MembershipPlan> {
  withToken(token);
  const query = gql`
    mutation CreateMembershipPlan($input: CreateMembershipPlanInput!) {
      createMembershipPlan(input: $input) { ${PLAN_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ createMembershipPlan: MembershipPlan }>(query, { input });
  return data.createMembershipPlan;
}

export async function updateMembershipPlan(
  token: string,
  input: MembershipPlanInput & { id: string; clearPin?: boolean },
): Promise<MembershipPlan> {
  withToken(token);
  const query = gql`
    mutation UpdateMembershipPlan($input: UpdateMembershipPlanInput!) {
      updateMembershipPlan(input: $input) { ${PLAN_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ updateMembershipPlan: MembershipPlan }>(query, { input });
  return data.updateMembershipPlan;
}

export async function deleteMembershipPlan(token: string, id: string): Promise<boolean> {
  withToken(token);
  const query = gql`
    mutation DeleteMembershipPlan($id: ID!) {
      deleteMembershipPlan(id: $id) { success }
    }
  `;
  const data = await contactsClient.request<{ deleteMembershipPlan: { success: boolean } }>(query, { id });
  return data.deleteMembershipPlan.success;
}

// ── Issued memberships ──────────────────────────────────────────────────

export async function listClientMemberships(
  token: string,
  opts: { clientId?: string; status?: ClientMembershipStatus; membershipPlanId?: string } = {},
): Promise<ClientMembership[]> {
  withToken(token);
  const query = gql`
    query ClientMemberships($clientId: ID, $status: ClientMembershipStatus, $membershipPlanId: ID) {
      clientMemberships(clientId: $clientId, status: $status, membershipPlanId: $membershipPlanId) {
        rows { ${MEMBERSHIP_FIELDS} }
      }
    }
  `;
  const data = await contactsClient.request<{ clientMemberships: { rows: ClientMembership[] } }>(query, opts);
  return data.clientMemberships.rows;
}

export async function listMembershipRequests(token: string): Promise<ClientMembership[]> {
  withToken(token);
  const query = gql`
    query MembershipRequests {
      membershipRequests { rows { ${MEMBERSHIP_FIELDS} } }
    }
  `;
  const data = await contactsClient.request<{ membershipRequests: { rows: ClientMembership[] } }>(query);
  return data.membershipRequests.rows;
}

export async function issueClientMembership(
  token: string,
  input: { clientId: string; membershipPlanId: string; startDate?: string; pricePaid?: string; note?: string },
): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation IssueClientMembership($input: IssueClientMembershipInput!) {
      issueClientMembership(input: $input) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ issueClientMembership: ClientMembership }>(query, { input });
  return data.issueClientMembership;
}

export async function approveClientMembership(
  token: string,
  input: { id: string; startDate?: string; pricePaid?: string },
): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation ApproveClientMembership($input: ApproveClientMembershipInput!) {
      approveClientMembership(input: $input) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ approveClientMembership: ClientMembership }>(query, { input });
  return data.approveClientMembership;
}

export async function rejectClientMembership(token: string, id: string, reason: string): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation RejectClientMembership($input: RejectClientMembershipInput!) {
      rejectClientMembership(input: $input) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ rejectClientMembership: ClientMembership }>(query, {
    input: { id, reason },
  });
  return data.rejectClientMembership;
}

export async function cancelClientMembership(token: string, id: string): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation CancelClientMembership($id: ID!) {
      cancelClientMembership(id: $id) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ cancelClientMembership: ClientMembership }>(query, { id });
  return data.cancelClientMembership;
}

export async function freezeClientMembership(token: string, id: string, untilDate: string): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation FreezeClientMembership($input: FreezeClientMembershipInput!) {
      freezeClientMembership(input: $input) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ freezeClientMembership: ClientMembership }>(query, {
    input: { id, untilDate },
  });
  return data.freezeClientMembership;
}

export async function unfreezeClientMembership(token: string, id: string): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation UnfreezeClientMembership($id: ID!) {
      unfreezeClientMembership(id: $id) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ unfreezeClientMembership: ClientMembership }>(query, { id });
  return data.unfreezeClientMembership;
}

export async function recordMembershipVisit(
  token: string,
  input: { clientMembershipId: string; pin?: string; note?: string },
): Promise<ClientMembership> {
  withToken(token);
  const query = gql`
    mutation RecordMembershipVisit($input: RecordMembershipVisitInput!) {
      recordMembershipVisit(input: $input) { ${MEMBERSHIP_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ recordMembershipVisit: ClientMembership }>(query, { input });
  return data.recordMembershipVisit;
}

// ── Brand settings ─────────────────────────────────────────────────────

export async function getMembershipBrandSettings(token: string): Promise<MembershipBrandSettings | null> {
  withToken(token);
  const query = gql`
    query MembershipBrandSettings {
      membershipBrandSettings { ${BRAND_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ membershipBrandSettings: MembershipBrandSettings | null }>(query);
  return data.membershipBrandSettings;
}

export async function upsertMembershipBrandSettings(
  token: string,
  input: Partial<Omit<MembershipBrandSettings, 'id'>>,
): Promise<MembershipBrandSettings> {
  withToken(token);
  const query = gql`
    mutation UpsertMembershipBrandSettings($input: UpsertMembershipBrandSettingsInput!) {
      upsertMembershipBrandSettings(input: $input) { ${BRAND_FIELDS} }
    }
  `;
  const data = await contactsClient.request<{ upsertMembershipBrandSettings: MembershipBrandSettings }>(query, {
    input,
  });
  return data.upsertMembershipBrandSettings;
}

function lengthEnum(n: number): string {
  const allowed = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const names = [
    'TEN', 'FIFTEEN', 'TWENTY', 'TWENTY_FIVE', 'THIRTY', 'THIRTY_FIVE', 'FORTY', 'FORTY_FIVE',
    'FIFTY', 'FIFTY_FIVE', 'SIXTY', 'SIXTY_FIVE', 'SEVENTY', 'SEVENTY_FIVE', 'EIGHTY',
    'EIGHTY_FIVE', 'NINETY', 'NINETY_FIVE', 'ONE_HUNDRED',
  ];
  let best = 0;
  for (let i = 0; i < allowed.length; i++) if (allowed[i] <= n) best = i;
  return names[best];
}
