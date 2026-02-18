export interface GraphQLErrorLike {
  message: string
  code?: string
  response?: unknown
}

export interface NetworkErrorLike {
  type: 'network'
  status?: number
  statusText?: string
}

export interface ValidationErrorLike {
  type: 'validation'
  field?: string
  message: string
}

export type ApiError = GraphQLErrorLike | NetworkErrorLike | ValidationErrorLike | Error

export function isGraphQLError(error: unknown): error is GraphQLErrorLike {
  return typeof error === 'object' && error !== null && 'message' in (error as any)
}

export function isNetworkError(error: unknown): error is NetworkErrorLike {
  return typeof error === 'object' && error !== null && (error as any).type === 'network'
}

export function getErrorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  
  // Check for GraphQL response structure: response.errors[0].message
  if (typeof e === 'object' && e !== null) {
    const obj = e as any
    if (obj.response?.errors && Array.isArray(obj.response.errors) && obj.response.errors.length > 0) {
      return obj.response.errors[0]?.message || 'GraphQL error'
    }
  }
  
  if (isGraphQLError(e)) return e.message
  return 'Unexpected error'
}
