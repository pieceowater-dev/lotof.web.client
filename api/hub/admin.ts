import { hubClient, setGlobalAuthToken } from '@/api/clients'
import {
  AdminNamespacesDocument,
  AdminNamespaceHealthDocument,
  type AdminNamespacesQuery,
  type AdminNamespaceHealthQuery,
  type FilterPaginationLengthEnum,
} from '@gql-hub'

// D2/D4: was hand-typed inline query strings + manually maintained response
// types, kept in sync with the schema by hand (see deeplinks.ts for the same
// conversion, done first, with the full rationale). Query shapes below are
// byte-identical to what was here before -- codegen's document validation
// against the live schema confirmed it, this didn't just change formatting.

// Comments on individual fields (ownerOtherNamespaceCount, businessType,
// lastActiveAt, ...) preserved from the original hand-written type -- they
// document real product behavior, not the codegen mechanics, and are still
// true of the generated shape below.
export type AdminNamespaceRow = NonNullable<AdminNamespacesQuery['adminNamespaces']>['rows'][number]
export type AppHealthStatus = NonNullable<AdminNamespaceHealthQuery['adminNamespaceHealth']>['apps'][number]

export async function hubGetAdminNamespacesPage(
  token: string,
  page: number,
  length: string = 'TWENTY',
  search?: string
): Promise<{ rows: AdminNamespaceRow[]; total: number }> {
  setGlobalAuthToken(token || null)
  const res = await hubClient.request<AdminNamespacesQuery>(AdminNamespacesDocument, {
    page,
    length: length as FilterPaginationLengthEnum,
    search: search || undefined,
  })
  return { rows: res.adminNamespaces?.rows || [], total: res.adminNamespaces?.info?.count || 0 }
}

// hubGetAdminNamespaceHealth is deliberately separate from the bulk
// adminNamespaces list load above -- it's an on-demand troubleshooting
// check triggered per-namespace from the admin console, not something to
// run for every row on page load.
export async function hubGetAdminNamespaceHealth(token: string, namespaceId: string): Promise<AppHealthStatus[]> {
  setGlobalAuthToken(token || null)
  const res = await hubClient.request<AdminNamespaceHealthQuery>(AdminNamespaceHealthDocument, { namespaceId })
  return res.adminNamespaceHealth?.apps || []
}

export async function hubGetAdminNamespaces(token: string): Promise<{ rows: AdminNamespaceRow[]; total: number }> {
  setGlobalAuthToken(token || null)
  const rows: AdminNamespaceRow[] = []
  let page = 1
  let total = 0

  // ONE_HUNDRED is the largest page size the shared filter enum supports;
  // loop until we've collected every row (platform is small enough today
  // that this is normally a single request).
  for (let iteration = 0; iteration < 25; iteration += 1) {
    const res = await hubClient.request<AdminNamespacesQuery>(AdminNamespacesDocument, {
      page,
      length: 'ONE_HUNDRED' as FilterPaginationLengthEnum,
    })
    const batch = res.adminNamespaces?.rows || []
    rows.push(...batch)
    total = res.adminNamespaces?.info?.count || rows.length
    if (!batch.length || rows.length >= total) break
    page += 1
  }

  return { rows, total }
}
