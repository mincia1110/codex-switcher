import { access } from "node:fs/promises";
import { accountConfigTomlPath } from "../account/paths.js";
import { readConfig, touchLastUsed } from "../account/config.js";
import { resolveAccount, validateAccountName } from "../account/accounts.js";
import { runCodex } from "../codex/launcher.js";
import { syncDefaultCodexAuthBestEffort } from "../codex/default-home.js";
import { ensureAllSharedSessions } from "../codex/shared-sessions.js";

export type RunInvocation = { name?: string; args: string[] };

export function parseRunInvocation(argv: string[]): RunInvocation {
  const runIndex = argv.indexOf("run");
  const tokens = runIndex >= 0 ? argv.slice(runIndex + 1) : [];
  const dashIndex = tokens.indexOf("--");
  if (dashIndex >= 0) {
    const beforeDash = tokens.slice(0, dashIndex);
    return { name: beforeDash[0], args: tokens.slice(dashIndex + 1) };
  }
  return { name: tokens[0], args: [] };
}

export async function runCommand(name: string | undefined, args: string[]): Promise<void> {
  if (name) validateAccountName(name);
  const config = await readConfig();
  await ensureAllSharedSessions(Object.values(config.accounts));
  const account = resolveAccount(config, name);
  await access(account.home);
  await access(accountConfigTomlPath(account.name));
  await touchLastUsed(account.name);
  const code = await runCodex(account.home, args);
  await syncDefaultCodexAuthBestEffort(account.home);
  process.exitCode = code;
}
