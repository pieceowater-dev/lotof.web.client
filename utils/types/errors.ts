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

function extractRawMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  // Check for GraphQL response structure: response.errors[0].message
  if (typeof e === 'object' && e !== null) {
    const obj = e as any
    if (obj.response?.errors && Array.isArray(obj.response.errors) && obj.response.errors.length > 0) {
      return obj.response.errors[0]?.message || ''
    }
  }

  if (isGraphQLError(e)) return e.message
  return ''
}

// grpc-go client errors are formatted as "rpc error: code = X desc = Y".
// Every backend error crosses this wire format, whether it's an
// intentional, human-authored business message (status.Error(codes.AlreadyExists, "..."))
// or a raw, unwrapped exception (a bare Go `error` defaults to codes.Unknown).
// The code tells them apart far more reliably than the text does.
const GRPC_WRAPPER_RE = /^rpc error: code = (\w+) desc = ([\s\S]*)$/
const TECHNICAL_GRPC_CODES = new Set(['Unknown', 'Internal', 'DataLoss', 'Unavailable'])

// Backstop patterns for raw driver/runtime errors that leak through even
// outside the rpc wrapper (client-side exceptions, or a technical detail
// that slipped through under a "safe" code).
const TECHNICAL_PATTERNS = [
  /SQLSTATE/i,
  /^ERROR:\s/, // raw postgres driver error text, e.g. "ERROR: cached plan..."
  /panic:/i,
  /goroutine \d+/,
  /\.go:\d+/,
  /context deadline exceeded/i,
  /connection refused/i,
  /\bEOF\b/,
  /^(Type|Reference|Syntax)Error/,
  /Cannot read propert/i,
  /fetch failed/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /Unexpected token/i,
  /is not a function/i,
  /is not defined/i,
]

function isTechnicalDetail(raw: string): boolean {
  const grpcMatch = raw.match(GRPC_WRAPPER_RE)
  if (grpcMatch) {
    const [, code, desc] = grpcMatch
    if (TECHNICAL_GRPC_CODES.has(code)) return true
    return TECHNICAL_PATTERNS.some((p) => p.test(desc))
  }
  return TECHNICAL_PATTERNS.some((p) => p.test(raw))
}

// Never show raw backend/runtime internals (SQLSTATE codes, Go panics,
// stack traces, bare "rpc error: code = Unknown desc = ...") to end users —
// they're meaningless and alarming. The detail is never lost though: it's
// always sent to the console here, so it's still one devtools tab away.
// Returns '' when the message is either absent or judged technical, so the
// existing `getErrorMessage(e) || 'contextual fallback'` pattern used at
// every call site activates and shows a specific, friendly message instead.
export function getErrorMessage(e: unknown): string {
  const raw = extractRawMessage(e)
  if (!raw) return ''
  if (isTechnicalDetail(raw)) {
    console.error('[app] technical error (hidden from UI):', raw, e)
    return ''
  }
  return raw
}
