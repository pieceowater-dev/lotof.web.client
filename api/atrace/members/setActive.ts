import type { Member } from '~/types/atrace'

export interface SetMemberActiveInput {
  userId: string
  isActive: boolean
}

export async function setMemberActive(
  namespaceSlug: string,
  input: SetMemberActiveInput,
  token?: string
): Promise<Member> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

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

  const response = await fetch(`/api/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables: {
        input: {
          userId: input.userId,
          isActive: input.isActive,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to set member active status: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Failed to set member active status')
  }

  return data.data.setMemberActive
}

export async function getActiveMembersCount(token?: string): Promise<number> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const query = `
    query GetActiveMembersCount {
      getActiveMembersCount
    }
  `

  const response = await fetch(`/api/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get active members count: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Failed to get active members count')
  }

  return data.data.getActiveMembersCount
}

export async function getActiveMembers(
  page: number = 1,
  pageSize: number = 20,
  token?: string
): Promise<Member[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const query = `
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

  const response = await fetch(`/api/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables: { page, pageSize },
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get active members: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Failed to get active members')
  }

  return data.data.getActiveMembers
}
