export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  AUTH: 2,
  API: 3,
  VALIDATION: 4,
  NOT_FOUND: 5,
  CHANGES_PENDING: 10,
  PARTIAL_FAILURE: 11,
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
