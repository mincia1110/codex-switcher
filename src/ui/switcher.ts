import { isCancel, select } from "@clack/prompts";
import type { AccountSortMode } from "../account/accounts.js";
import { sortAccounts } from "../account/accounts.js";
import type { AccountRecord } from "../account/types.js";
import type { UsageSnapshot } from "../usage/types.js";
import { switchLabel } from "./table.js";

export async function chooseAccount(accounts: AccountRecord[], usage: Record<string, UsageSnapshot>, defaultAccount: string | undefined, sort: AccountSortMode): Promise<AccountRecord | undefined> {
  const ordered = sortAccounts(accounts, usage, defaultAccount, sort);
  const value = await select({
    message: "Codex Accounts",
    options: ordered.map((account) => ({ value: account.name, label: `${account.name === defaultAccount ? "● " : "  "}${switchLabel(account, usage[account.name])}` })),
  });
  if (isCancel(value)) return undefined;
  return ordered.find((account) => account.name === value);
}
