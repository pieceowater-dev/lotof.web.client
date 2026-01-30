export default defineEventHandler(async (event) => {
  try {
    const atraceUrl = process.env.ATRACE_GTW_URL || 'http://localhost:8080'
    const token = getCookie(event, 'auth_token') || getHeader(event, 'authorization') || ''

    const query = `
      query GetActiveMembersCount {
        getActiveMembersCount
      }
    `

    const response = await $fetch(`${atraceUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: {
        query,
      },
    } as any)

    if ((response as any).errors) {
      return { error: (response as any).errors[0]?.message || 'Failed to get active members count' }
    }

    return { count: (response as any).data?.getActiveMembersCount || 0 }
  } catch (error) {
    console.error('Error getting active members count:', error)
    return { error: error instanceof Error ? error.message : 'Failed to get active members count' }
  }
})
