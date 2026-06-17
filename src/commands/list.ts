import { getAccountsArray, sortAccounts } from "../account/accounts.js";
import { readConfig } from "../account/config.js";
import { accountListTable } from "../ui/table.js";

export async function listCommand(): Promise<void> {
  const config = await readConfig();
  const accounts = sortAccounts(getAccountsArray(config), {}, config.defaultAccount, "default");
  if (accounts.length === 0) { console.log("No accounts configured. Run `cxs login <name>`."); return; }
  console.log(accountListTable(accounts, config.defaultAccount));
}
