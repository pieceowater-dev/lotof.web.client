export default defineEventHandler(async (event) => {
  const { userId, isActive, namespaceSlug } = await readBody(event)

  if (!userId || !namespaceSlug) {
    return { error: 'Missing userId or namespaceSlug' }
  }

  try {
    const query = `
      mutation SetMemberActive($input: SetMemberActiveInput!) {
        setMemberActive(input: $input) {
          id
          userId
          isActive
          createdAt
          updatedAt
        }
      }
    `

    const atraceUrl = process.env.ATRACE_GTW_URL || 'http://localhost:8080'
    
    // Get token from cookie or Authorization header
    let token = getHeader(event, 'authorization') || ''
    if (!token) {
      token = getCookie(event, 'auth_token') || ''
    }

    const response = await $fetch(`${atraceUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: {
        query,
        variables: {
          input: {
            userId,
            isActive,
          },
        },
      },
    } as any)

    if ((response as any).errors) {
      return { error: (response as any).errors[0]?.message || 'Failed to set member active status' }
    }

    return (response as any).data?.setMemberActive || {}
  } catch (error) {
    console.error('Error setting member active:', error)
    return { error: error instanceof Error ? error.message : 'Failed to set member active status' }
  }
})
