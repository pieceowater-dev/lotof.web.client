export default defineEventHandler(async (event) => {
  const { namespace } = event.context.params || {}
  const query = getQuery(event)

  if (!namespace) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Namespace is required',
    })
  }

  try {
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 20

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

    const response = await $fetch(`${process.env.ATRACE_GTW_URL || 'http://localhost:8080'}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getHeader(event, 'authorization') || '',
      },
      body: {
        query: graphqlQuery,
        variables: { page, pageSize },
      },
    })

    if (response.errors) {
      throw new Error(response.errors[0]?.message || 'Failed to fetch members')
    }

    return response.data?.getActiveMembers || []
  } catch (error) {
    console.error('Error fetching members:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch members',
    })
  }
})
