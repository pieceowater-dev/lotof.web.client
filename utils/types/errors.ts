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
  // graphql-request's ClientError, when the response never reached the
  // GraphQL layer at all (a proxy/rate-limiter rejection, a 500 from the
  // gateway itself, ...), formats its .message as this plus a raw
  // `{"response":{...},"request":{...}}` dump of the whole request —
  // variables and all. Never fit to show as-is; isRateLimitError below
  // carves out 429 specifically for a friendlier, actionable message.
  /^GraphQL Error \(Code: \d+\)/,
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

// "You're authenticated but not allowed to do this" — distinct from a
// technical failure. Backend directives/services phrase these in plain,
// grep-able English regardless of the caller's locale (see
// MenuAuthDirective, staff.svc.go's owner-protection checks, and the
// order-status role scoping in order.ctrl.go), so callers can reliably
// recognize the *kind* of error even though the raw wording is never
// itself fit to show a user.
const PERMISSION_PATTERNS = [
  /^forbidden:/i,
  /does not have access/i,
  /permission denied/i,
  /not authorized/i,
  /not allowed to/i,
]

export function isPermissionError(e: unknown): boolean {
  const raw = extractRawMessage(e)
  if (!raw) return false
  const grpcMatch = raw.match(GRPC_WRAPPER_RE)
  const desc = grpcMatch ? grpcMatch[2] : raw
  return PERMISSION_PATTERNS.some((p) => p.test(desc))
}

// graphql-request's ClientError for an HTTP 429 (rate limited before the
// request ever reached the GraphQL layer — no `response.errors`, just a
// bare status) always starts with this exact prefix.
export function isRateLimitError(e: unknown): boolean {
  const raw = extractRawMessage(e)
  return /^GraphQL Error \(Code: 429\)/.test(raw)
}

// Never show raw backend/runtime internals (SQLSTATE codes, Go panics,
// stack traces, bare "rpc error: code = Unknown desc = ...") to end users —
// they're meaningless and alarming. The detail is never lost though: it's
// always sent to the console here, so it's still one devtools tab away.
// Returns '' when the message is either absent or judged technical, so the
// existing `getErrorMessage(e) || 'contextual fallback'` pattern used at
// every call site activates and shows a specific, friendly message instead.
//
// `t`, when passed, is the caller's own already-resolved useI18n().t (never
// call useI18n() in here — this runs inside async catch blocks, after an
// await, where Vue's composable-injection context is no longer reliably
// available). With it, a permission error resolves to a proper localized
// "you don't have access" message instead of being silently swallowed down
// to the caller's generic fallback text, which would otherwise misdescribe
// *why* the action failed.
export function getErrorMessage(e: unknown, t?: (key: string) => string): string {
  const raw = extractRawMessage(e)
  if (!raw) return ''
  if (isPermissionError(e)) {
    console.error('[app] permission error (hidden from UI):', raw, e)
    return t ? (t('common.permissionDenied') || '') : ''
  }
  if (isRateLimitError(e)) {
    console.error('[app] rate-limited (hidden from UI):', raw, e)
    return t ? (t('common.rateLimited') || '') : ''
  }
  if (isTechnicalDetail(raw)) {
    console.error('[app] technical error (hidden from UI):', raw, e)
    return ''
  }
  return raw
}
