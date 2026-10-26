# Writing code checks

One check = one entry file + one `devhelm.yml` entry (or one
`devhelm_monitor` resource, or one SDK `monitors.create` call).

## Entry files

- **Browser (`BROWSER`):** a Playwright test using `page`.
- **Multi-step API (`MULTI_STEP_API`):** a Playwright test using `request`.
- One `test()` per file is the norm. Several `test()` blocks still make one
  check; the run fails if any of them fails.
- Helpers are fine: relative imports, `tsconfig` `paths`, JSON imports. The
  CLI bundles the whole import closure. Limits: 256 files, 5 MB.
- Refused at `validate`: symlinks, dotfiles and `.env` files, imports outside
  the repo root, packages that aren't in the runtime catalog.

```bash
devhelm runtimes list
devhelm runtimes show <runtime-id>
```

## Configuration from the environment

Each monitor runs in **one** environment. Its variables and secrets arrive as
`process.env.*`:

```ts
const base = process.env.BASE_URL ?? 'https://staging.example.com'
await page.goto(`${base}/login`)
await page.getByLabel('Email').fill(process.env.LOGIN_EMAIL ?? '')
await page.getByLabel('Password').fill(process.env.LOGIN_PASSWORD ?? '')
```

The secret keys a check needs are scanned from the code. List what is missing
per environment and give the human the fix commands:

```bash
devhelm monitors secret-requests list "Login"
devhelm secrets values set LOGIN_PASSWORD --env staging --value-stdin
```

Never pass a value as an argument and never handle it yourself.

## Files nothing imports

Fixtures read at runtime (CSV, JSON read with `fs`) go in `include`:

```yaml
code: { entrypoint: synthetics/orders.spec.ts, include: [synthetics/fixtures/*.json] }
```

## Logged-in journeys (sessions)

Put the login in `auth.setup.ts` next to the entry file, or name it with
`session: { setupFile: auth.setup.ts }`. DevHelm runs the setup, keeps the
session and reuses it across runs.

```bash
devhelm monitors sessions list "Dashboard"
devhelm monitors sessions renew "Dashboard"
```

## `@devhelm/synthetics`

Bundled in every runtime, no install needed:

| Call | Returns | Use |
|---|---|---|
| `email.address({label})` | an address leased to this run | Sign-up, invites, password reset |
| `email.wait({to, subject?, from?, timeoutMs, receivedAfter?})` | `{id, subject, from, text, html, otp?, links[]}` | Read the code or the magic link |
| `webhook.wait({inbox, match?, timeoutMs})` | the received request | Payment or provider callbacks |

A wait that times out fails the run with a named step, so don't wrap it in
retries or sleeps.

## Waiting well

- Prefer `await expect(locator).toBeVisible()` and `toHaveURL()` to
  `waitForTimeout`.
- Use `getByRole` / `getByLabel` / `getByTestId`; avoid CSS chains that
  break on a redesign.
- Keep a journey short: the default timeout is 90 s (browser) or 30 s (API).

## Change, test, publish

`devhelm deploy` handles this. By hand, for one monitor:

```bash
devhelm monitors revisions create "Checkout" --code synthetics/checkout.spec.ts
devhelm monitors revisions test "Checkout" <revision-id>
devhelm monitors publish "Checkout" --revision <revision-id> --require-tested
devhelm monitors revisions diff "Checkout" <revision-id>
```
