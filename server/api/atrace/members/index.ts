export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  try {
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 20

    const atraceUrl = process.env.ATRACE_GTW_URL || 'http://localhost:8080'
    const token = getCookie(event, 'auth_token') || getHeader(event, 'authorization') || ''

    const graphqlQuery = `
      query GetActiveMembers($page: Int!, $pageSize: Int!) {
        getActiveMembers(page: $page, pageSize: $pageSize) {
          id
          userId
          isActive
          createdAt
          updatedAt
        }
      }
    `

    const response = await $fetch(`${atraceUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: {
        query: graphqlQuery,
        variables: { page, pageSize },
      },
    } as any)

    if ((response as any).errors) {
      return { error: (response as any).errors[0]?.message || 'Failed to fetch members' }
    }

    return { members: (response as any).data?.getActiveMembers || [] }
  } catch (error) {
    console.error('Error fetching members:', error)
    return { error: error instanceof Error ? error.message : 'Failed to fetch members' }
  }
})
