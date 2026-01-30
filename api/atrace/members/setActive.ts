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
  const response = await fetch(`/api/atrace/members/setActive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: input.userId,
      isActive: input.isActive,
      namespaceSlug,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to set member active status: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

export async function getActiveMembersCount(token?: string): Promise<number> {
  const response = await fetch(`/api/atrace/members/count`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`Failed to get active members count: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data.count
}

export async function getActiveMembers(
  page: number = 1,
  pageSize: number = 20,
  token?: string
): Promise<Member[]> {
  const query = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })

  const response = await fetch(`/api/atrace/members?${query}`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`Failed to get active members: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data.members
}
