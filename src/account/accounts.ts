import type { AccountRecord } from "./types.js";
import type { UsageSnapshot } from "../usage/types.js";

const ACCOUNT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export type AccountSortMode = "default" | "quota" | "recent" | "name";

export function validateAccountName(name: string): string {
  if (!ACCOUNT_NAME_RE.test(name) || name === "." || name === ".." || name.includes("/")) {
    throw new Error("Account name must be 1-64 chars, start with a letter/number, and contain only letters, numbers, dot, underscore, or hyphen.");
  }
  return name;
}

function usageRank(snapshot?: UsageSnapshot): number {
  return snapshot && (snapshot.fiveHour || snapshot.weekly) ? 1 : 0;
}

function remaining(snapshot: UsageSnapshot | undefined, key: "fiveHour" | "weekly"): number {
  return snapshot?.[key]?.remainingPercent ?? -1;
}

function recentMs(account: AccountRecord): number {
  return account.lastUsedAt ? Date.parse(account.lastUsedAt) || 0 : 0;
}

export function sortAccounts(accounts: AccountRecord[], usage: Record<string, UsageSnapshot> = {}, defaultAccount?: string, mode: AccountSortMode = "default"): AccountRecord[] {
  return [...accounts].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name);
    if (mode === "recent") return recentMs(b) - recentMs(a) || a.name.localeCompare(b.name);

    if (mode === "default") {
      const ad = a.name === defaultAccount ? 1 : 0;
      const bd = b.name === defaultAccount ? 1 : 0;
      if (ad !== bd) return bd - ad;
    }

    const au = usage[a.name];
    const bu = usage[b.name];
    const ar = usageRank(au);
    const br = usageRank(bu);
    if (ar !== br) return br - ar;
    const five = remaining(bu, "fiveHour") - remaining(au, "fiveHour");
    if (five !== 0) return five;
    const week = remaining(bu, "weekly") - remaining(au, "weekly");
    if (week !== 0) return week;
    return recentMs(b) - recentMs(a) || a.name.localeCompare(b.name);
  });
}

export function getAccountsArray(config: { accounts: Record<string, AccountRecord> }): AccountRecord[] {
  return Object.values(config.accounts);
}

export function resolveAccount(config: { defaultAccount?: string; accounts: Record<string, AccountRecord> }, name?: string): AccountRecord {
  const chosen = name ?? config.defaultAccount;
  if (!chosen) throw new Error("No account specified and no default account configured. Run `cxs login <name>` or `cxs use <name>`.");
  const account = config.accounts[chosen];
  if (!account) throw new Error(`Unknown account: ${chosen}`);
  return account;
}
