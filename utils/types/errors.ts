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
  if (isGraphQLError(e)) return e.message
  return 'Unexpected error'
}
