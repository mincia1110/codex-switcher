import { getAccountsArray, sortAccounts } from "../account/accounts.js";
import { readConfig } from "../account/config.js";
import { readUsageCache, writeUsageCache } from "../usage/cache.js";
import { fetchAllUsage } from "../usage/fetch-usage.js";
import { scanAllAccounts } from "../usage/scanner.js";
import { usageTable } from "../ui/table.js";

export async function usageCommand(options: { scan?: boolean; refresh?: boolean; json?: boolean }): Promise<void> {
  const config = await readConfig();
  const accounts = getAccountsArray(config);
  const cache = await readUsageCache();
  const snapshots = options.scan
    ? await scanAllAccounts(accounts)
    : await fetchAllUsage(accounts, {
        allowBackendApi: true,
        allowStatusFallback: true,
        allowLocalLogFallback: true,
        timeoutMs: options.refresh ? 12_000 : 5_000,
      });
  if (options.scan) await writeUsageCache({ ...cache.snapshots, ...snapshots });
  if (options.json) { console.log(JSON.stringify(snapshots, null, 2)); return; }
  console.log(usageTable(sortAccounts(accounts, snapshots, config.defaultAccount, "default"), snapshots));
}
