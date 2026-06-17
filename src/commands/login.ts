import { validateAccountName } from "../account/accounts.js";
import { chmodAuthFile, detectEmailFromAuth } from "../account/auth.js";
import { accountHome } from "../account/paths.js";
import { readConfig, upsertAccount } from "../account/config.js";
import { prepareCodexHome, runCodexLogin } from "../codex/login.js";

export async function loginCommand(name: string): Promise<void> {
  validateAccountName(name);
  const home = await prepareCodexHome(name);
  const code = await runCodexLogin(name);
  if (code !== 0) { process.exitCode = code; return; }
  await chmodAuthFile(name);
  const existing = (await readConfig()).accounts[name];
  const email = await detectEmailFromAuth(name);
  await upsertAccount({ name, home: accountHome(name), email: email ?? existing?.email, createdAt: existing?.createdAt ?? new Date().toISOString(), lastUsedAt: new Date().toISOString() });
  console.log(`Logged in Codex account ${name} at ${home}`);
}
