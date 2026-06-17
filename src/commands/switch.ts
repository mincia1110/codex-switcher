import type { AccountSortMode } from "../account/accounts.js";
import { getAccountsArray } from "../account/accounts.js";
import { readConfig, setDefaultAccount, touchLastUsed } from "../account/config.js";
import { readUsageCache, writeUsageCache } from "../usage/cache.js";
import { fetchAllUsage } from "../usage/fetch-usage.js";
import { scanAllAccounts } from "../usage/scanner.js";
import { chooseAccount } from "../ui/switcher.js";
import { runCodex } from "../codex/launcher.js";
import { syncDefaultCodexAuthBestEffort } from "../codex/default-home.js";
import { ensureAllSharedSessions } from "../codex/shared-sessions.js";

export async function switchCommand(options: { noRun?: boolean; sort?: AccountSortMode; scan?: boolean }): Promise<void> {
  const config = await readConfig();
  const accounts = getAccountsArray(config);
  if (accounts.length === 0) throw new Error("No accounts configured. Run `cxs login <name>`.");
  await ensureAllSharedSessions(accounts);
  const cache = await readUsageCache();
  const usage = options.scan
    ? await scanAllAccounts(accounts)
    : await fetchAllUsage(accounts, { preferCache: true, allowBackendApi: true, allowStatusFallback: false, allowLocalLogFallback: false, timeoutMs: 5_000 });
  if (options.scan) await writeUsageCache({ ...cache.snapshots, ...usage });
  const account = await chooseAccount(accounts, usage, config.defaultAccount, options.sort ?? "default");
  if (!account) return;
  await setDefaultAccount(account.name);
  console.log(`Default Codex account set to ${account.name}`);
  if (!options.noRun) {
    await touchLastUsed(account.name);
    const code = await runCodex(account.home, []);
    await syncDefaultCodexAuthBestEffort(account.home);
    process.exitCode = code;
  }
}
