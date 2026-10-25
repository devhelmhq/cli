# bundles — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateBundleRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `files` | Map<string, string> | ✓ |  | Path to UTF-8 text. Paths are relative to the bundle root |
| `entrypoint` | string |  | ✓ | File that runs. Omit when the map is already the import closure |
| `runtimeId` | string |  | ✓ | Runtime used to refuse imports. Omit for the newest runtime that can run |

## `BundleDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `digest` | string | ✓ |  | Closure digest, sha256:<hex>. Same files always return this value |
| `uploadDigest` | string | ✓ |  | Digest of every file that was sent, before import closure |
| `files` | string[] | ✓ |  | Files in the import closure |
| `keys` | string[] | ✓ |  | Secret names detected in the closure |
| `size` | integer (int64) | ✓ |  | Uncompressed closure size in bytes |

## `BundleCheckResultDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `findings` | Finding[] | ✓ |  | Problems found in the supplied source files |

