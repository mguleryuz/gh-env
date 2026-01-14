# ghvars

Sync `.env` files and manage GitHub Actions secrets/variables from your `.env.example` template.

## Features

- **Sync** - Keep `.env` in sync with `.env.example` (add new vars, remove deprecated, preserve values)
- **Push** - Push secrets and variables to GitHub Actions
- **Pull** - Pull variables from GitHub to `.env`
- **Interactive** - Select which items to push with a nice TUI

## Installation

```bash
# In a Bun workspace
bun add ghvars

# Or install globally
bun add -g ghvars
```

## Quick Start

```bash
# Run interactive menu
ghvars

# Or use specific commands
ghvars sync          # Sync .env with .env.example
ghvars push          # Push all secrets & variables to GitHub
ghvars pull          # Pull variables from GitHub
```

## Configuration

### Annotating Sections

`ghvars` reads your `.env.example` to determine which variables are secrets vs variables. Use annotations on section headers:

```bash
# =============================================================================
# SETTINGS @variables
# =============================================================================

APP_NAME="My App"
LOG_LEVEL="info"

# =============================================================================
# CREDENTIALS @secrets
# =============================================================================

API_KEY=""
DATABASE_URL=""
```

| Annotation   | GitHub Target    | Visibility      |
| ------------ | ---------------- | --------------- |
| `@secrets`   | GitHub Secrets   | Hidden in logs  |
| `@variables` | GitHub Variables | Visible in logs |
| _(none)_     | Skipped          | Not pushed      |

### Section Header Formats

These are recognized as section headers:

```bash
# === SECTION NAME ===           # Decorated with ===
# SECTION NAME                   # ALL CAPS standalone
# SECTION NAME (description)     # With parenthetical note
# SECTION NAME @secrets          # With annotation
```

These are NOT sections (just sub-headers/comments):

```bash
# --- Database ---               # Sub-header with ---
# Some lowercase comment         # Regular comment
```

## Commands

### `ghvars` (no args)

Interactive menu with all options:

```
? What would you like to do?
  🔄 Sync .env with .env.example
  ⬆️  Push all secrets & variables to GitHub
  🎯 Push selected items (interactive)
  ⬇️  Pull variables from GitHub
```

### `ghvars sync`

Syncs `.env` with `.env.example`:

- Adds new variables from template
- Removes deprecated variables not in template
- Preserves existing values
- Updates structure (comments, sections, annotations)

```bash
ghvars sync

# Output:
# 📋 .env.example has 33 variables
#    (10 secrets, 23 variables)
#
# ✓ Added 2 new variable(s):
#    + NEW_VAR_1
#    + NEW_VAR_2
#
# 📝 Updated .env
#    31 preserved, 2 added, 0 removed
```

### `ghvars push`

Push secrets and variables to GitHub Actions.

```bash
ghvars push              # Push all
ghvars push -i           # Interactive selection
ghvars push -s           # Secrets only
ghvars push -v           # Variables only
```

Requires [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated.

### `ghvars pull`

Pull variables from GitHub to `.env`.

```bash
ghvars pull
```

> **Note:** Secrets cannot be pulled (GitHub security restriction).

### `ghvars init`

Create a template `.env.example` file:

```bash
ghvars init
```

## Example `.env.example`

```bash
# =============================================================================
# My App Configuration
# =============================================================================
# Use annotations on section headers:
#   @secrets   → pushed as GitHub Secrets (hidden)
#   @variables → pushed as GitHub Variables (visible)

# =============================================================================
# GENERAL @variables
# =============================================================================

APP_NAME="My App"
APP_ENV="development"
LOG_LEVEL="info"

# =============================================================================
# CREDENTIALS @secrets
# =============================================================================

# --- Database ---
DATABASE_URL=""

# --- API Keys ---
API_KEY=""
API_SECRET=""

# =============================================================================
# DEBUG @variables
# =============================================================================

DEBUG="false"
```

## Requirements

- [Bun](https://bun.sh/) runtime
- [GitHub CLI](https://cli.github.com/) for push/pull commands

## License

MIT
