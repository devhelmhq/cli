import {Args, Flags} from '@oclif/core'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function parseUuid(input: string): Promise<string> {
  if (!UUID_RE.test(input)) {
    throw new Error(
      `Invalid UUID format: got '${input}', expected xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
    )
  }
  return input
}

async function parseUrl(input: string): Promise<string> {
  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('not HTTP(S)')
    }
  } catch {
    throw new Error(
      `Invalid URL: got '${input}', expected a valid HTTP(S) URL`,
    )
  }
  return input
}

export function uuidArg(options: {description: string; required?: true}) {
  return Args.string({...options, required: true as const, parse: parseUuid})
}

export function uuidFlag(options: {description: string; required?: boolean}) {
  return Flags.string({...options, parse: parseUuid})
}

export function urlFlag(options: {description: string; required?: boolean}) {
  return Flags.string({...options, parse: parseUrl})
}
