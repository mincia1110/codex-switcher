#!/bin/zsh
set -u

failures=0

section() {
  printf "\n== %s ==\n" "$1"
}

pass() {
  printf "PASS %-28s %s\n" "$1" "$2"
}

warn() {
  printf "WARN %-28s %s\n" "$1" "$2"
}

fail() {
  printf "FAIL %-28s %s\n" "$1" "$2"
  failures=$((failures + 1))
}

check_command() {
  local name="$1"
  local required="${2:-required}"
  local cmd_path
  cmd_path="$(command -v "$name" 2>/dev/null || true)"

  if [[ -n "$cmd_path" ]]; then
    pass "$name" "$cmd_path"
  elif [[ "$required" == "optional" ]]; then
    warn "$name" "not found"
  else
    fail "$name" "not found"
  fi
}

check_version() {
  local label="$1"
  shift
  local output
  output="$("$@" 2>/dev/null | head -n 1 || true)"
  if [[ -n "$output" ]]; then
    pass "$label" "$output"
  else
    warn "$label" "version unavailable"
  fi
}

section "Host"
pass "hostname" "$(hostname)"
pass "user" "$USER"
pass "home" "$HOME"

section "PATH"
if [[ ":$PATH:" == *":/opt/homebrew/bin:"* ]]; then
  pass "/opt/homebrew/bin" "present"
else
  warn "/opt/homebrew/bin" "missing from PATH"
fi

section "Commands"
for cmd in brew git gh node pnpm tmux rg fd jq tree bat uv fzf htop wget curl rsync wakeonlan ssh; do
  check_command "$cmd"
done
check_command tailscale optional
check_command codex optional
check_command cxs optional

section "Versions"
command -v brew >/dev/null 2>&1 && check_version brew brew --version
command -v gh >/dev/null 2>&1 && check_version gh gh --version
command -v node >/dev/null 2>&1 && check_version node node --version
command -v pnpm >/dev/null 2>&1 && check_version pnpm pnpm --version
command -v cxs >/dev/null 2>&1 && check_version cxs cxs --version
command -v codex >/dev/null 2>&1 && check_version codex codex --version

section "Directories"
for dir in "$HOME/dev/personal" "$HOME/dev/lab" "$HOME/dev/work" "$HOME/services" "$HOME/scripts" "$HOME/var/hermes"; do
  if [[ -d "$dir" ]]; then
    pass "$dir" "exists"
  else
    warn "$dir" "missing"
  fi
done

section "cxs"
if command -v cxs >/dev/null 2>&1; then
  cxs doctor || failures=$((failures + 1))
else
  warn "cxs doctor" "skipped"
fi

section "Tailscale"
if command -v tailscale >/dev/null 2>&1; then
  tailscale status --peers=false 2>/dev/null || warn "tailscale status" "not logged in or daemon unavailable"
elif [[ -d "/Applications/Tailscale.app" ]]; then
  pass "Tailscale.app" "/Applications/Tailscale.app"
  if [[ -f "/Applications/Tailscale.app/Contents/Info.plist" ]]; then
    version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' /Applications/Tailscale.app/Contents/Info.plist 2>/dev/null || true)"
    [[ -n "$version" ]] && pass "Tailscale.app version" "$version"
  fi
  warn "tailscale CLI" "not installed in PATH; use the app's Install Tailscale CLI action if CLI status checks are needed"
else
  warn "tailscale" "not installed"
fi

section "Summary"
if [[ "$failures" -eq 0 ]]; then
  pass "environment" "no required check failures"
else
  fail "environment" "$failures required check(s) failed"
fi

exit "$failures"
