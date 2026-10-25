/**
 * Errors for the DevHelm CLI.
 *
 * The typed errors are the SDK's (`@devhelm/sdk`): one class per
 * `ErrorResponse` category, each carrying every field. This module adds
 * only what is CLI-specific: the process exit codes, the frozen category →
 * exit mapping (doc 32 D-2, via the SDK's `exitCodeForCategory`), and the
 * few exits that are not a category (a wait deadline, an interrupt).
 *
 *   validation, blocked, not_found        → 4
 *   auth, permission, ownership           → 17
 *   plan, quota                           → 16
 *   confirmation_required                 → 15
 *   conflict                              → 18
 *   gone                                  → 20
 *   rate_limit, platform                  → 11 (19 while admitting a run)
 *   transport                             → 12
 */
import {
  DevhelmError,
  ValidationError,
  BlockedError,
  AuthError,
  PermissionError,
  OwnershipError,
  PlanLimitError,
  QuotaError,
  RateLimitError,
  ConflictError,
  ConfirmationRequiredError,
  NotFoundError,
  GoneError,
  PlatformError,
  TransportError,
  WaitTimeoutError,
  ERROR_CATEGORIES,
  exitCodeForCategory,
  type ErrorCategory,
  type ErrorEntry,
  type ErrorFields,
  type ErrorNext,
  type JsonObject,
  type JsonValue,
} from '@devhelm/sdk'

export {
  DevhelmError, ValidationError, BlockedError, AuthError, PermissionError, OwnershipError, PlanLimitError,
  QuotaError, RateLimitError, ConflictError, ConfirmationRequiredError, NotFoundError, GoneError, PlatformError,
  TransportError, WaitTimeoutError, ERROR_CATEGORIES, exitCodeForCategory,
}
export type {ErrorCategory, ErrorEntry, ErrorFields, ErrorNext, JsonObject, JsonValue}

/** Pre-1.12 names used across the CLI. */
export {ValidationError as DevhelmValidationError, TransportError as DevhelmTransportError}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  USAGE: 2,
  VALIDATION: 4,
  CHANGES_PENDING: 10,
  API: 11,
  TRANSPORT: 12,
  PARTIAL_FAILURE: 13,
  CHECK_FAILED: 14,
  CONFIRMATION_REQUIRED: 15,
  PLAN: 16,
  PERMISSION: 17,
  CONFLICT: 18,
  NO_VERDICT: 19,
  GONE: 20,
  INTERRUPTED: 130,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]

export function isErrorCategory(value: string): value is ErrorCategory {
  return (ERROR_CATEGORIES as readonly string[]).includes(value)
}

/**
 * An error whose exit is not its category's: a run that is still going
 * when `--timeout` passes is 19, an interrupt is 130, a re-thrown oclif
 * error keeps its own code.
 */
export class CliExitError extends DevhelmError {
  readonly exit: number

  constructor(message: string, category: ErrorCategory, exit: number, fields: ErrorFields = {}) {
    super(message, {...fields, message, category, code: fields.code ?? 'CLI_EXIT'})
    this.name = 'CliExitError'
    this.exit = exit
  }
}

/** Platform codes raised while admitting or executing a run. */
const RUN_ADMISSION_CODES = new Set(['RUNTIME_UNAVAILABLE', 'NO_SEAT', 'RUN_START_DEADLINE'])

/** Process exit code for an error (D-2). */
export function exitCodeOf(err: DevhelmError): number {
  if (err instanceof CliExitError) return err.exit
  if (err instanceof WaitTimeoutError) return EXIT_CODES.NO_VERDICT
  // A platform refusal while admitting a run is "no verdict", not an API failure (D-2).
  if (err.category === 'platform' && RUN_ADMISSION_CODES.has(err.code)) return EXIT_CODES.NO_VERDICT
  return exitCodeForCategory(err.category)
}

type CategoryClass = new (message: string, fields?: ErrorFields) => DevhelmError

const CATEGORY_CLASSES: Readonly<Record<ErrorCategory, CategoryClass>> = {
  validation: ValidationError,
  blocked: BlockedError,
  auth: AuthError,
  permission: PermissionError,
  ownership: OwnershipError,
  plan: PlanLimitError,
  quota: QuotaError,
  rate_limit: RateLimitError,
  conflict: ConflictError,
  confirmation_required: ConfirmationRequiredError,
  not_found: NotFoundError,
  gone: GoneError,
  platform: PlatformError,
  transport: TransportError,
}

/** The SDK class for a category. */
export function errorForCategory(message: string, category: ErrorCategory, fields: ErrorFields = {}): DevhelmError {
  return new CATEGORY_CLASSES[category](message, fields)
}

/** Client-side `NO_TOKEN` (validation, exit 4), with the fork-PR hint in CI. */
export function noTokenError(): ValidationError {
  const forkPr = process.env.GITHUB_EVENT_NAME === 'pull_request'
  const hint = forkPr
    ? ' Pull requests from forks get no repository secrets: run `devhelm validate` (offline) there instead.'
    : ''
  return new ValidationError(
    `No API token configured. Set DEVHELM_API_TOKEN or run \`devhelm auth login\`.${hint}`,
    {code: 'NO_TOKEN', next: {command: 'devhelm auth login', docs: null}},
  )
}

/** oclif's handler reads `oclif.exit`, `code`, `ref` and `suggestions` (bin/ uses it for every command). */
export function forOclif(err: DevhelmError): Error & {oclif: {exit: number}; ref?: string; suggestions?: string[]} {
  return Object.assign(new Error(err.message), {
    name: err.name,
    stack: err.stack,
    code: err.code,
    oclif: {exit: exitCodeOf(err)},
    ref: err.requestId ? `request ${err.requestId}` : undefined,
    suggestions: err.next?.command ? [err.next.command] : undefined,
  })
}
