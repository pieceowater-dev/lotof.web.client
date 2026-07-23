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
