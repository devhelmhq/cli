# runtime-profiles — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `RuntimeProfileDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string | ✓ |  | Runtime environment identifier |
| `nodeVersion` | string | ✓ |  | Node version available to checks |
| `playwrightVersion` | string | ✓ |  | Playwright version available to checks |
| `status` | string | ✓ |  | Runtime support status |
| `eolAt` | string (date-time) |  | ✓ | When runtime support ends |
| `availableAt` | string (date-time) |  | ✓ | When this runtime became available |
| `deprecatedAt` | string (date-time) |  | ✓ | When this runtime was deprecated; null while current |
| `packages` | Map<string, string> |  | ✓ | Pinned npm packages available to checks |
| `nodeBuiltins` | string[] |  | ✓ | Node built-in modules available to checks |
| `reservedBindings` | string[] |  | ✓ | Environment bindings this runtime reads |
| `browser` | any |  | ✓ |  |
| `platformDefault` | boolean | ✓ |  | Whether new checks use this runtime when none is pinned |
| `regions` | RuntimeRegionAvailability[] | ✓ |  | Whether each region can run this runtime |

