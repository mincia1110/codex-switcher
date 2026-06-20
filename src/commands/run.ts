import { access, chmod, stat } from "node:fs/promises";
import path from "node:path";
import { accountConfigTomlPath } from "../account/paths.js";
import { readConfig, setDefaultAccount, touchLastUsed } from "../account/config.js";
import { resolveAccount, validateAccountName } from "../account/accounts.js";
import { runCodex, runPlainCodex } from "../codex/launcher.js";
import { syncDefaultCodexAuth, syncDefaultCodexAuthBestEffort } from "../codex/default-home.js";
import { ensureAllSharedSessions } from "../codex/shared-sessions.js";

export type RunInvocation = { name?: string; args: string[]; isolated: boolean };

export type RunCommandOptions = {
  isolated?: boolean;
};

export function parseRunInvocation(argv: string[]): RunInvocation {
  const runIndex = argv.indexOf("run");
  const tokens = runIndex >= 0 ? argv.slice(runIndex + 1) : [];
  const dashIndex = tokens.indexOf("--");
  if (dashIndex >= 0) {
    const beforeDash = tokens.slice(0, dashIndex);
    const filtered = beforeDash.filter((token) => token !== "--isolated");
    return { name: filtered[0], args: tokens.slice(dashIndex + 1), isolated: filtered.length !== beforeDash.length };
  }
  const filtered = tokens.filter((token) => token !== "--isolated");
  return { name: filtered[0], args: [], isolated: filtered.length !== tokens.length };
}

export async function runCommand(name: string | undefined, args: string[], options: RunCommandOptions = {}): Promise<void> {
  if (name) validateAccountName(name);
  const config = await readConfig();
  await ensureAllSharedSessions(Object.values(config.accounts));
  const account = resolveAccount(config, name);
  const sourceAuthPath = path.join(account.home, "auth.json");
  await validateRunSource(account.name, account.home, sourceAuthPath);

  if (options.isolated) {
    await access(accountConfigTomlPath(account.name));
    await touchLastUsed(account.name);
    const code = await runCodex(account.home, args);
    await syncDefaultCodexAuthBestEffort(account.home);
    process.exitCode = code;
    return;
  }

  await chmod(sourceAuthPath, 0o600);
  await syncDefaultCodexAuth(account.home, { appServerReset: "warn" });
  await setDefaultAccount(account.name);
  await touchLastUsed(account.name);
  const code = await runPlainCodex(args);
  process.exitCode = code;
}

async function validateRunSource(accountName: string, accountHome: string, sourceAuthPath: string): Promise<void> {
  try {
    await access(accountHome);
  } catch (error: any) {
    if (error?.code === "ENOENT") throw new Error(`Account home does not exist for ${accountName}: ${accountHome}`);
    throw error;
  }

  try {
    await stat(sourceAuthPath);
  } catch (error: any) {
    if (error?.code === "ENOENT") throw new Error(`Missing auth.json for ${accountName}. Run \`cxs login ${accountName}\` first.`);
    throw error;
  }
}
