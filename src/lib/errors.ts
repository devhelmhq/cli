import {ApiRequestError} from './api-client.js'

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

export function handleApiError(error: unknown): never {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      throw new AuthError(`Authentication failed: ${error.message}`)
    }

    if (error.status === 404) {
      throw new DevhelmError(error.message, EXIT_CODES.NOT_FOUND)
    }

    throw new DevhelmError(error.message, EXIT_CODES.API)
  }

  throw error
}
