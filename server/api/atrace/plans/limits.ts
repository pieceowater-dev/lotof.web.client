export default defineEventHandler(async (event) => {
  try {
    const atraceUrl = process.env.ATRACE_GTW_URL || 'http://localhost:8081'
    const token = getCookie(event, 'auth_token') || getHeader(event, 'authorization') || ''

    const query = `
      query GetPlanLimits {
        getPlanLimits {
          maxPosts
          maxEmployees
        }
      }
    `

    const response = await $fetch(`${atraceUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: { query },
    } as any)

    if ((response as any).errors) {
      return { error: (response as any).errors[0]?.message || 'Failed to fetch plan limits' }
    }

    const limits = (response as any).data?.getPlanLimits || {}

    return {
      max_posts: limits.maxPosts,
      max_employees: limits.maxEmployees,
    }
  } catch (error) {
    console.error('Error fetching plan limits:', error)
    return { error: error instanceof Error ? error.message : 'Failed to fetch plan limits' }
  }
})
