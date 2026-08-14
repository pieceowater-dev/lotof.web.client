import { hubClient, setGlobalAuthToken } from '@/api/clients'

export type AdminNamespaceRow = {
  id: string
  title: string
  slug: string
  createdAt: string | null
  leadSource: string | null
  ownerInfo: { username: string; email: string; phone?: string | null } | null
  memberInfos: Array<{ id: string; username: string; email: string; phone?: string | null }> | null
  apps: Array<{ id: string; namespaceID: string; appBundle: string }> | null
  // How many OTHER namespaces this namespace's owner is also a member of.
  // 0 (or null before the field existed) = "Компания": they only ever run
  // this one namespace. >0 = "Сотрудник": an auto-created personal
  // namespace whose owner immediately joined someone else's instead, so
  // this one sits unused.
  ownerOtherNamespaceCount: number | null
  // The other namespace(s) the owner actually belongs to, when
  // ownerOtherNamespaceCount > 0 -- i.e. which company they work for.
  ownerEmployerNamespaces: Array<{ id: string; title: string; slug: string }> | null
  // The namespace whose referral link (see /people) this signup came
  // through, null if it wasn't referred.
  referredByNamespace: { id: string; title: string; slug: string } | null
}

const ADMIN_NAMESPACES_QUERY = /* GraphQL */ `
  query AdminNamespaces($page: Int!, $length: FilterPaginationLengthEnum!, $search: String) {
    adminNamespaces(filter: { search: $search, pagination: { page: $page, length: $length } }) {
      rows {
        id
        title
        slug
        createdAt
        leadSource
        ownerInfo {
          username
          email
          phone
        }
        memberInfos {
          id
          username
          email
          phone
        }
        apps {
          id
          namespaceID
          appBundle
        }
        ownerOtherNamespaceCount
        ownerEmployerNamespaces {
          id
          title
          slug
        }
        referredByNamespace {
          id
          title
          slug
        }
      }
      info {
        count
      }
    }
  }
`

export async function hubGetAdminNamespacesPage(
  token: string,
  page: number,
  length: string = 'TWENTY',
  search?: string
): Promise<{ rows: AdminNamespaceRow[]; total: number }> {
  setGlobalAuthToken(token || null)
  const res = await hubClient.request<{ adminNamespaces: { rows: AdminNamespaceRow[]; info: { count: number } } }>(
    ADMIN_NAMESPACES_QUERY,
    { page, length, search: search || undefined }
  )
  return { rows: res.adminNamespaces?.rows || [], total: res.adminNamespaces?.info?.count || 0 }
}

export type AppHealthStatus = {
  appBundle: string
  reachable: boolean
  schemaReady: boolean
  appliedVersion: string | null
  targetVersion: string | null
  error: string | null
}

const ADMIN_NAMESPACE_HEALTH_QUERY = /* GraphQL */ `
  query AdminNamespaceHealth($namespaceId: ID!) {
    adminNamespaceHealth(namespaceId: $namespaceId) {
      apps {
        appBundle
        reachable
        schemaReady
        appliedVersion
        targetVersion
        error
      }
    }
  }
`

// hubGetAdminNamespaceHealth is deliberately separate from the bulk
// adminNamespaces list load above -- it's an on-demand troubleshooting
// check triggered per-namespace from the admin console, not something to
// run for every row on page load.
export async function hubGetAdminNamespaceHealth(token: string, namespaceId: string): Promise<AppHealthStatus[]> {
  setGlobalAuthToken(token || null)
  const res = await hubClient.request<{ adminNamespaceHealth: { apps: AppHealthStatus[] } }>(
    ADMIN_NAMESPACE_HEALTH_QUERY,
    { namespaceId }
  )
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
    const res = await hubClient.request<{ adminNamespaces: { rows: AdminNamespaceRow[]; info: { count: number } } }>(
      ADMIN_NAMESPACES_QUERY,
      { page, length: 'ONE_HUNDRED' }
    )
    const batch = res.adminNamespaces?.rows || []
    rows.push(...batch)
    total = res.adminNamespaces?.info?.count || rows.length
    if (!batch.length || rows.length >= total) break
    page += 1
  }

  return { rows, total }
}
