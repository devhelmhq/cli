/** Terminal prompts (stderr, so stdout stays clean). Callers check for a TTY first. */
import {createInterface} from 'node:readline'

export async function promptLine(question: string): Promise<string> {
  const rl = createInterface({input: process.stdin, output: process.stderr})
  try {
    return (await new Promise<string>((resolve) => rl.question(question, resolve))).trim()
  } finally {
    rl.close()
  }
}

/** `y` / `yes` (any case) is yes; everything else, including Enter, is no. */
export async function promptYesNo(question: string): Promise<boolean> {
  return /^y(es)?$/i.test(await promptLine(question))
}
