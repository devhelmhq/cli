# DevHelm CLI

The official command-line interface for [DevHelm](https://devhelm.io) — manage uptime monitors, incidents, alert channels, and infrastructure as code from your terminal.

- **Monitoring as code** — define monitors in `devhelm.yml` and deploy them from CI or your terminal
- **Full API coverage** — monitors, incidents, alert channels, notification policies, environments, secrets, tags, resource groups, webhooks, dependencies, and status data
- **Multiple output formats** — table, JSON, or YAML for easy scripting and piping
- **Auth context model** — switch between environments with named contexts, or use `DEVHELM_API_TOKEN` for CI
- **Works with AI agents** — pair with the [DevHelm MCP server](https://github.com/devhelmhq/mcp-server) or [Agent Skill](https://github.com/devhelmhq/skill) for AI-driven monitoring workflows

## Quick Example

```bash
# Authenticate
$ devhelm auth login --token dh_live_...
Authenticated as you@company.com
Context 'default' saved to ~/.devhelm/contexts.json

# List your monitors
$ devhelm monitors list
┌────┬─────────────────────┬──────┬────────┬──────────────────────────┬──────────┐
│ ID │ NAME                │ TYPE │ STATUS │ URL                      │ INTERVAL │
├────┼─────────────────────┼──────┼────────┼──────────────────────────┼──────────┤
│ 1  │ Website Health      │ HTTP │ UP     │ https://example.com      │ 60       │
│ 2  │ API Endpoint        │ HTTP │ UP     │ https://api.example.com  │ 30       │
│ 3  │ DNS Check           │ DNS  │ UP     │ example.com              │ 300      │
└────┴─────────────────────┴──────┴────────┴──────────────────────────┴──────────┘

# Create a monitor
$ devhelm monitors create --name "Checkout API" --type HTTP --url https://api.example.com/checkout --frequency 60

# Scaffold a config file and validate it
$ devhelm init
Created devhelm.yml

$ devhelm validate
devhelm.yml: valid (3 monitors)
```

## Installation

```bash
npm install -g devhelm
```

Requires Node.js 18+.

## Authentication

The CLI resolves credentials in this order:

1. `--api-token` flag (highest priority)
2. `DEVHELM_API_TOKEN` environment variable
3. Active auth context from `~/.devhelm/contexts.json`

```bash
# Interactive login
devhelm auth login

# Or set a token directly
export DEVHELM_API_TOKEN=dh_live_...

# Manage multiple environments
devhelm auth context create staging --api-url https://staging-api.devhelm.io --token dh_test_...
devhelm auth context use staging
devhelm auth context list
```

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `devhelm init` | Scaffold a `devhelm.yml` configuration file |
| `devhelm validate [file]` | Validate a configuration file |
| `devhelm status` | Show dashboard overview |
| `devhelm version` | Print CLI version |

### Resources

Every resource supports `list`, `get`, `create`, `update`, and `delete` subcommands. Add `--output json` for machine-readable output.

| Resource | Commands | API Path |
|----------|----------|----------|
| `monitors` | list, get, create, update, delete, pause, resume, test, results | `/api/v1/monitors` |
| `maintenance-windows` | list, get, create, update, cancel | `/api/v1/maintenance-windows` |
| `incidents` | list, get, create, update, delete, resolve | `/api/v1/incidents` |
| `alert-channels` | list, get, create, update, delete, test | `/api/v1/alert-channels` |
| `notification-policies` | list, get, create, update, delete, test | `/api/v1/notification-policies` |
| `environments` | list, get, create, update, delete | `/api/v1/environments` |
| `secrets` | list, create, update, delete | `/api/v1/secrets` |
| `tags` | list, get, create, update, delete | `/api/v1/tags` |
| `resource-groups` | list, get, create, update, delete | `/api/v1/resource-groups` |
| `webhooks` | list, get, create, update, delete, test | `/api/v1/webhooks` |
| `api-keys` | list, get, create, delete, revoke | `/api/v1/api-keys` |
| `dependencies` | list, get, track, delete | `/api/v1/service-subscriptions` |
| `data services` | status, uptime | `/api/v1/services` |

### Global Flags

```
--output, -o   Output format: table, json, yaml (default: table)
--api-url      Override API base URL
--api-token    Override API token
--verbose, -v  Show verbose output
```

## AI Agents & Coding Assistants

DevHelm is designed to work seamlessly with AI coding agents:

- **[MCP Server](https://github.com/devhelmhq/mcp-server)** — full API access from Cursor, Claude Desktop, or any MCP-compatible client
- **[Agent Skill](https://github.com/devhelmhq/skill)** — structured instructions for Claude Code, Cursor, Codex, and other AI agents

```bash
# Install the MCP server (Python package on PyPI)
pip install devhelm-mcp-server
# or, no install required:
uvx devhelm-mcp-server

# Or add the skill to your project
npx skills add devhelmhq/skill
```

## Documentation

Full documentation at [docs.devhelm.io](https://docs.devhelm.io).

## Need Help?

- [Getting Started Guide](https://docs.devhelm.io/cli/quickstart)
- [GitHub Issues](https://github.com/devhelmhq/cli/issues)
- [Community Discussions](https://github.com/devhelmhq/cli/discussions)

## Development

```bash
git clone https://github.com/devhelmhq/cli.git
cd cli
npm install
npm run build

# Run in dev mode
node bin/dev.js version
node bin/dev.js monitors list

# Checks
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest
```

## License

MIT
