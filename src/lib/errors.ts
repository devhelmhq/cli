/**
 * Error taxonomy for the DevHelm CLI (P4 — see
 * `mono/cowork/design/040-codegen-policies.md`).
 *
 *   DevhelmValidationError → exit 4 — local schema mismatch (request/response
 *                                     validation, YAML parse, missing config)
 *   DevhelmApiError        → exit 11 — HTTP 4xx/5xx from the API. Carries
 *                                      `status`, `code`, `requestId`
 *   DevhelmTransportError  → exit 12 — network failure (DNS, timeout, TLS)
 *
 * Sub-types may extend any of the three roots; their exit code defaults to
 * the root's. CLI-only operational sentinels (CHANGES_PENDING,
 * PARTIAL_FAILURE) live alongside but are NOT error classes — they are
 * normal program-flow signals from `plan` / `deploy`.
 */

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  VALIDATION: 4,
  CHANGES_PENDING: 10,
  API: 11,
  TRANSPORT: 12,
  PARTIAL_FAILURE: 13,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]

/** Umbrella class — every typed CLI error inherits from this. */
export class DevhelmError extends Error {
  constructor(
    message: string,
    public exitCode: number = EXIT_CODES.GENERAL,
  ) {
    super(message)
    this.name = 'DevhelmError'
  }
}

/**
 * Local validation failed before, or instead of, an HTTP exchange. Examples:
 * malformed YAML, a Zod-validated request body that doesn't match the spec,
 * or a missing API token (precondition for talking to the API at all).
 */
export class DevhelmValidationError extends DevhelmError {
  constructor(message: string) {
    super(message, EXIT_CODES.VALIDATION)
    this.name = 'DevhelmValidationError'
  }
}

export interface DevhelmApiErrorOptions {
  /** Coarse machine-readable category from `ErrorResponse.code`. */
  code?: string
  /**
   * Per-request id from the API's `X-Request-Id` response header
   * (mirrored in `ErrorResponse.requestId`). Always include this when
   * filing a support ticket.
   */
  requestId?: string
  /** Human-readable detail extracted from the response body, if any. */
  detail?: string
  /** Raw parsed body for debugging non-conforming responses. */
  rawBody?: unknown
}

/**
 * The API returned a non-2xx response. Always carries the HTTP status code;
 * `code` and `requestId` are populated when the server returns the canonical
 * `ErrorResponse` envelope (the standard for every DevHelm API endpoint).
 */
export class DevhelmApiError extends DevhelmError {
  readonly status: number
  readonly code: string | undefined
  readonly requestId: string | undefined
  readonly detail: string | undefined
  readonly rawBody: unknown

  constructor(message: string, status: number, options?: DevhelmApiErrorOptions) {
    super(message, EXIT_CODES.API)
    this.name = 'DevhelmApiError'
    this.status = status
    this.code = options?.code
    this.requestId = options?.requestId
    this.detail = options?.detail
    this.rawBody = options?.rawBody
  }
}

/** 401 or 403 from the API. Surfaced separately for ergonomics. */
export class DevhelmAuthError extends DevhelmApiError {
  constructor(message: string, status: number, options?: DevhelmApiErrorOptions) {
    super(message, status, options)
    this.name = 'DevhelmAuthError'
  }
}

/** 404 from the API. */
export class DevhelmNotFoundError extends DevhelmApiError {
  constructor(message: string, status: number, options?: DevhelmApiErrorOptions) {
    super(message, status, options)
    this.name = 'DevhelmNotFoundError'
  }
}

/**
 * The HTTP request never produced a server response — DNS failure, connection
 * refused, TLS handshake failure, request/read timeout, etc. Wraps the
 * underlying fetch/network error on `cause`.
 */
export class DevhelmTransportError extends DevhelmError {
  constructor(message: string, options?: {cause?: unknown}) {
    super(message, EXIT_CODES.TRANSPORT)
    this.name = 'DevhelmTransportError'
    if (options?.cause !== undefined) {
      ;(this as {cause?: unknown}).cause = options.cause
    }
  }
}
