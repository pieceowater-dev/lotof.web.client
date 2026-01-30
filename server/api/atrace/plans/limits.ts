export default defineEventHandler(async (event) => {
  const { namespace } = event.context.params || {}

  if (!namespace) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Namespace is required',
    })
  }

  try {
    const query = `
      query GetPlanLimits {
        getPlanLimits {
          maxPosts
          maxEmployees
        }
      }
    `

    const response = await $fetch(`${process.env.ATRACE_GTW_URL || 'http://localhost:8080'}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getHeader(event, 'authorization') || '',
      },
      body: { query },
    })

    if (response.errors) {
      throw new Error(response.errors[0]?.message || 'Failed to fetch plan limits')
    }

    // Transform response to expected format
    const limits = response.data?.getPlanLimits || {}

    return {
      max_posts: limits.maxPosts,
      max_employees: limits.maxEmployees,
    }
  } catch (error) {
    console.error('Error fetching plan limits:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch plan limits',
    })
  }
})
