# DevHelm CLI

The official command-line interface for [DevHelm](https://devhelm.io) — manage monitors, deployments, and infrastructure as code.

## Installation

```bash
npm install -g devhelm
```

## Quick Start

```bash
# Authenticate
devhelm auth login

# List monitors
devhelm monitors list

# Validate a configuration file
devhelm validate devhelm.yml

# Deploy monitors from config
devhelm deploy
```

## Authentication

The CLI resolves credentials in this order:

1. `DEVHELM_API_TOKEN` environment variable (highest priority)
2. Active auth context from `~/.devhelm/contexts.json`

```bash
# Interactive login (creates a "default" context)
devhelm auth login

# Manage multiple contexts
devhelm auth context create staging --api-url https://api.devhelm.io --token sk_...
devhelm auth context use staging
devhelm auth context list
```

## Commands

| Command | Description |
|---------|-------------|
| `devhelm version` | Print CLI version |
| `devhelm monitors list` | List all monitors |
| `devhelm monitors get <id>` | Get monitor details |
| `devhelm validate [file]` | Validate devhelm.yml |
| `devhelm deploy` | Deploy configuration |
| `devhelm status` | Show deployment status |

Run `devhelm --help` for the full command list.

## Development

```bash
git clone https://github.com/devhelmhq/cli.git
cd cli
npm install
npm run build

# Run in dev mode
node bin/dev.js version
node bin/dev.js monitors list

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## License

MIT
