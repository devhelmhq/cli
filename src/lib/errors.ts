export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  AUTH: 2,
  API: 3,
  VALIDATION: 4,
  NOT_FOUND: 5,
} as const

export class DevhelmError extends Error {
  constructor(
    message: string,
    public exitCode: number = EXIT_CODES.GENERAL,
  ) {
    super(message)
    this.name = 'DevhelmError'
  }
}

export class AuthError extends DevhelmError {
  constructor(message = 'Not authenticated. Run `devhelm auth login` first.') {
    super(message, EXIT_CODES.AUTH)
    this.name = 'AuthError'
  }
}

export class ValidationError extends DevhelmError {
  constructor(message: string) {
    super(message, EXIT_CODES.VALIDATION)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DevhelmError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found.`, EXIT_CODES.NOT_FOUND)
    this.name = 'NotFoundError'
  }
}

/**
 * Converts raw API errors into structured DevhelmError with proper exit codes.
 * Imported by checkedFetch in api-client.ts — this is the single error-handling boundary.
 */
export function handleApiError(error: unknown): never {
  // Avoid circular import: check by name rather than instanceof
  if (error && typeof error === 'object' && 'status' in error) {
    const apiErr = error as {status: number; message: string}
    if (apiErr.status === 401 || apiErr.status === 403) {
      throw new AuthError(`Authentication failed: ${apiErr.message}`)
    }

    if (apiErr.status === 404) {
      throw new DevhelmError(apiErr.message, EXIT_CODES.NOT_FOUND)
    }

    throw new DevhelmError(apiErr.message, EXIT_CODES.API)
  }

  if (error instanceof Error) {
    throw new DevhelmError(error.message, EXIT_CODES.GENERAL)
  }

  throw new DevhelmError(String(error), EXIT_CODES.GENERAL)
}
