export class DevhelmError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1,
  ) {
    super(message)
    this.name = 'DevhelmError'
  }
}

export class AuthError extends DevhelmError {
  constructor(message = 'Not authenticated. Run `devhelm auth login` first.') {
    super(message, 2)
    this.name = 'AuthError'
  }
}

export class ApiError extends DevhelmError {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`API error (${status}): ${message}`, 3)
    this.name = 'ApiError'
  }
}
