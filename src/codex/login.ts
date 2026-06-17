import { mkdir, writeFile } from "node:fs/promises";
import { accountConfigTomlPath, accountHome } from "../account/paths.js";
import { runCodex } from "./launcher.js";
import { ensureSharedHistory, ensureSharedSessions } from "./shared-sessions.js";

export async function prepareCodexHome(name: string): Promise<string> {
  const home = accountHome(name);
  await mkdir(home, { recursive: true, mode: 0o700 });
  await ensureSharedSessions(home);
  await ensureSharedHistory(home);
  await mkdir(`${home}/logs`, { recursive: true });
  await writeFile(accountConfigTomlPath(name), 'cli_auth_credentials_store = "file"\n', { mode: 0o600 });
  return home;
}

export async function runCodexLogin(name: string): Promise<number> {
  const home = await prepareCodexHome(name);
  return await runCodex(home, ["login"]);
}
