import { access, chmod, stat } from "node:fs/promises";
import path from "node:path";
import { defaultCodexAppServerControlSocketPath, defaultCodexAuthJsonPath, defaultCodexConfigTomlPath } from "../account/paths.js";
import { readConfig, setDefaultAccount, touchLastUsed } from "../account/config.js";
import { resolveAccount, validateAccountName } from "../account/accounts.js";
import { syncDefaultCodexAuth } from "../codex/default-home.js";
import { ensureAllSharedSessions } from "../codex/shared-sessions.js";

export type SyncCommandOptions = {
  dryRun?: boolean;
};

export async function syncCommand(name: string | undefined, options: SyncCommandOptions = {}): Promise<void> {
  if (name) validateAccountName(name);

  const config = await readConfig();
  await ensureAllSharedSessions(Object.values(config.accounts));
  const account = resolveAccount(config, name);
  const sourceAuthPath = path.join(account.home, "auth.json");

  await validateSyncSource(account.name, account.home, sourceAuthPath);

  if (options.dryRun) {
    printDryRun(account.name, sourceAuthPath, config.defaultAccount !== account.name);
    return;
  }

  await chmod(sourceAuthPath, 0o600);
  await syncDefaultCodexAuth(account.home, { appServerReset: "warn" });
  await ensureAllSharedSessions(Object.values(config.accounts));
  await setDefaultAccount(account.name);
  await touchLastUsed(account.name);
  console.log(`Synced ${account.name} to ${defaultCodexAuthJsonPath()} for plain codex.`);
}

async function validateSyncSource(accountName: string, accountHome: string, sourceAuthPath: string): Promise<void> {
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

function printDryRun(accountName: string, sourceAuthPath: string, willSetDefault: boolean): void {
  console.log("Dry run: no files will be modified.");
  console.log(`Selected account: ${accountName}`);
  console.log(`Source auth: ${sourceAuthPath}`);
  console.log(`Destination auth: ${defaultCodexAuthJsonPath()}`);
  console.log(`Destination config: ${defaultCodexConfigTomlPath()}`);
  console.log(`App-server control socket: ${defaultCodexAppServerControlSocketPath()}`);
  console.log(`Default account update: ${willSetDefault ? `will set to ${accountName}` : "already default"}`);
}
