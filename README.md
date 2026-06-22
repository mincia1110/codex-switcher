# Codex Switcher (`cxs`)

CLI-only Codex account switcher for WSL/Ubuntu. `cxs` stores multiple Codex accounts under per-account homes, then syncs the selected account into the default Codex home before launching plain `codex`.

This is **not** a Desktop switcher. `cxs run` and `cxs sync` sync the selected account auth into `~/.codex` so plain `codex`, Codex App remote projects, and user-level Codex provider config all agree on the active account. `cxs run --isolated` and a running `cxs switch` session still use per-account `CODEX_HOME` isolation.

## Core model

```text
~/.cxs/
  config.json
  accounts/
    personal/
      config.toml
      auth.json
      history.jsonl
      sessions/ -> ~/.cxs/shared/sessions
      logs/
  shared/
    sessions/
  cache/
    usage.json
```

By default, `cxs run <account>` first syncs that account to `~/.codex`, then launches plain `codex` without `CODEX_HOME`. This means your global `~/.codex/config.toml` settings, including custom model providers, remain active.

Isolated mode is still available:

```bash
cxs run --isolated <account>
```

## Security rules

- No access token, refresh token, id token, or account id is written to `~/.cxs/config.json` or `~/.cxs/cache/usage.json`.
- Usage cache stores only usage snapshots and never auth secrets or identifiers.
- The canonical per-account `auth.json` stays inside each account home; `~/.codex/auth.json` is only the last-run account copy used by plain `codex`.
- Resume sessions are shared through `~/.cxs/shared/sessions`; per-account `sessions` paths are symlinks so `/resume` can see sessions across `cxs` accounts without sharing account credentials.
- After a launched Codex session exits, or when `cxs sync` is run explicitly, that account's `auth.json` is copied to `~/.codex/auth.json` with mode `0600`, `~/.codex/config.toml` is set to `cli_auth_credentials_store = "file"`, and any stale default app-server control socket is removed so plain `codex` does not reuse a remote app-server session from another account.
- `auth.json` is chmodded to `0600` when possible.
- `cxs doctor` reports permission/setup problems.

## Install

```bash
npm install
npm run build
npm pack
npm install -g ./codex-switcher-0.1.0.tgz
```

For a repeatable local global install, use:

```bash
bash scripts/install-global.sh
```

Avoid `npm link` for a machine-level `cxs` install. `npm link` leaves
`/opt/homebrew/lib/node_modules/codex-switcher` pointing at the development
checkout, so moving or breaking the workspace also breaks `/opt/homebrew/bin/cxs`.
Installing from `npm pack` copies the built package into the global npm prefix
and keeps the CLI independent from the repo working tree.

Requirements:

- Node.js 20+
- WSL2/Ubuntu or Linux shell
- `codex` available on `PATH`, or set `CXS_CODEX_BIN=/absolute/path/to/codex`
- `script` from util-linux (used by the `/status` usage fallback)

## Commands

### Login

```bash
cxs login personal
```

Creates `~/.cxs/accounts/personal`, writes `config.toml` with:

```toml
cli_auth_credentials_store = "file"
```

Then runs:

```bash
CODEX_HOME=~/.cxs/accounts/personal codex login
```

### List

```bash
cxs list
```

Shows account, masked email, default marker, and last-used time.

### Use

```bash
cxs use work
```

Sets the default account only. Does not run Codex.

### Run

```bash
cxs run
cxs run personal
cxs run work -- exec "review this diff"
cxs run -- exec "use default account"
cxs run --isolated work
```

By default, syncs the selected account to `~/.codex`, sets it as the `cxs` default account, then runs the real plain `codex` process. `CODEX_HOME` is removed from the launched process environment so plain Codex uses `~/.codex`.

This keeps account switching compatible with user-level Codex config such as custom providers in `~/.codex/config.toml`.

Before launching Codex, `cxs` merges registered account session directories into `~/.cxs/shared/sessions` and replaces each account's `sessions` directory with a symlink to that shared directory. This lets `codex resume` and `/resume` show previous sessions from other `cxs` accounts. Authentication remains per-account in `~/.cxs/accounts/<account>/auth.json`; the selected account is copied to `~/.codex/auth.json` for active use.

If your shell has `CODEX_HOME` set, plain `codex` launched outside `cxs run` will use that directory instead of `~/.codex`. Run `unset CODEX_HOME` in that shell to let plain `codex` use the synced account.

`cxs` removes `CODEX_HOME` only for the launched `codex` child process. It does not modify your shell environment.

Before `cxs run` launches plain Codex, it removes the default app-server control socket. Without that, plain `codex` can attach to a persistent remote app-server that still has a previous account cached.

`cxs run --isolated <account>` keeps the previous behavior: it runs `codex` with `CODEX_HOME=~/.cxs/accounts/<account>`, then best-effort syncs that account back to `~/.codex` after Codex exits. Use isolated mode when you intentionally want account-local Codex config instead of the global `~/.codex/config.toml`.

If you intentionally keep a default Codex remote-control/app-server session alive, running `cxs run` or a running `cxs switch` may disconnect future plain `codex` launches from that server so the synced local account can take effect.

### Sync

```bash
cxs sync
cxs sync work
cxs sync work --dry-run
```

Syncs the selected account auth to `~/.codex` without launching Codex. If no account is provided, `cxs sync` uses the current default account. A successful `cxs sync work` also sets `work` as the default account so `cxs list` and plain `codex` reflect the same intended account.

This is useful on a Mac mini or remote SSH host before using plain `codex`, a Codex App SSH remote project, or another remote app-server flow where the default Codex home needs to match a specific account.

`sync` is not a Desktop switcher. It does not modify Chrome profiles, Codex Desktop internal auth, or web state. It only manages `~/.codex/auth.json` and `~/.codex/config.toml` for plain Codex CLI compatibility.

Like post-`run` syncing, `cxs sync` removes the default app-server control socket. Existing persistent remote app-server sessions may be detached so future plain `codex` launches can use the synced local account.

`--dry-run` prints the selected account, source and destination paths, app-server control socket target, and planned default-account update without copying auth, editing config, removing sockets, or printing token values.

### Switch

```bash
cxs switch
cxs switch --no-run
cxs switch --scan
cxs switch --sort quota
cxs switch --sort recent
cxs switch --sort name
```

Uses `@clack/prompts` to select an account. By default it sets the selected account as default and runs `codex`. `--no-run` changes the default only.

When `switch` launches Codex, the selected account is also synced to `~/.codex` after that Codex session exits. `--no-run` only changes the `cxs` default account and does not touch `~/.codex`.

The switcher shows usage from the cache first. If the cache is stale or missing, it tries a quick backend refresh (5s timeout). Usage failures are never fatal — the UI continues to work and shows `?` for unavailable quotas.

### Usage

```bash
cxs usage              # provider chain: backend API → /status scrape → local log → cache
cxs usage --refresh    # allow slower backend + /status refresh (12s timeout)
cxs usage --scan       # rescan local usage logs only (no network)
cxs usage --json       # print UsageSnapshot JSON
```

`cxs usage` queries usage in this priority order:

1. **Backend API** — uses `auth.json` `access_token` + `account_id` to call the ChatGPT backend usage endpoint. Fastest and most accurate for 5h/weekly windows.
2. **Status scrape** — if the backend fails, launches an isolated Codex session via `script -qfec`, sends `/status`, and parses `5h limit` / `Weekly limit` from the output.
3. **Local log** — scans `~/.cxs/accounts/<account>/sessions/**/*.jsonl` and `logs/**/*.jsonl` for `rate_limits` / `rateLimits` objects with `primary` and `secondary` usage windows.
4. **Cache** — falls back to the last successful snapshot stored in `~/.cxs/cache/usage.json`.
5. **Unknown** — if everything fails, shows `?` and preserves the error reason without blocking other operations.

Security notes:
- `access_token` and `account_id` are never written to cache or config.
- The cache stores only `UsageSnapshot` fields: account, email, plan, usageSource, fiveHour, weekly, fetchedAt.
- The `assertNoSecrets` guard rejects any write that contains token-shaped strings.

### Repair sessions

```bash
cxs repair-sessions
```

Repairs shared `sessions/`, `history.jsonl`, and `session_index.jsonl` links across `~/.codex` and all configured `cxs` account homes. This is safe to run after Codex CLI/Desktop rewrites session metadata files and before checking resume/session lists.

### Doctor

```bash
cxs doctor
```

Checks:

- Node.js >= 20
- codex binary exists
- `script` binary exists (required for `/status` fallback)
- `~/.cxs` root
- config validity
- default account validity
- account home/config/auth files
- auth permissions
- sessions/logs readability
- usage cache path

### Redacted diagnostics export

```bash
cxs export --redacted
cxs export --redacted --output /tmp/cxs-diagnostics.json
```

Exports a JSON diagnostics bundle containing runtime metadata, account setup metadata, auth file existence/mode, sessions/logs directory status, and usage-cache metadata.

The bundle intentionally redacts raw emails and never reads or emits `auth.json` token values. Output files are written with mode `0600` when possible.

### Shell completion

```bash
# bash
cxs completion bash > ~/.local/share/cxs/completion.bash
source ~/.local/share/cxs/completion.bash

# zsh
cxs completion zsh > ~/.local/share/cxs/_cxs
fpath=(~/.local/share/cxs $fpath)
autoload -Uz compinit && compinit
```

## Development

```bash
npm install
npm test
npm run build
node dist/main.js --help
```

## WSL smoke test with fake Codex

```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/bin"
cat > "$TMP/bin/codex" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "login" ]; then
  mkdir -p "$CODEX_HOME"
  printf '{"user":{"email":"person@example.com"}}
' > "$CODEX_HOME/auth.json"
  exit 0
fi
printf 'FAKE_CODEX_HOME=%s ARGS=%s
' "$CODEX_HOME" "$*"
EOF
chmod +x "$TMP/bin/codex"

HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js login personal
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js run personal -- exec 'hello world'
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js run -- exec default
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js sync personal
test -f "$TMP/home/.codex/auth.json"
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js sync personal --dry-run
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js usage --scan --json
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js doctor
```

## Explicit non-goals

- No PowerShell dependency.
- No Codex Desktop integration.
- Codex Desktop internal auth state, Chrome profiles, and web state are not modified directly.
- For plain Codex CLI compatibility, the selected account's `auth.json` can be explicitly synced to `~/.codex/auth.json`.
- No automatic `--best` account selection in MVP.

## Remaining improvements

- Optional `CXS_CODEX_BIN` documentation expansion and config-level override.
- Optional encrypted vault after MVP.
- `assertNoSecrets` could additionally block `accountId`/`account_id` from cache/config writes.
