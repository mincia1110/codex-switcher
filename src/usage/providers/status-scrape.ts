import type { AccountRecord } from "../../account/types.js";
import type { AuthSummary } from "../../account/auth.js";
import { fetchCodexStatus, type StatusSnapshot } from "../../codex/status.js";
import type { UsageSnapshot, UsageWindow } from "../types.js";

function windowFromLeft(left: number | null, reset: string | null): UsageWindow | null {
  if (typeof left !== "number" || !Number.isFinite(left)) return null;
  const remainingPercent = Math.min(100, Math.max(0, left));
  return { usedPercent: Math.max(0, 100 - remainingPercent), remainingPercent, resetAfterSeconds: null, resetAt: reset };
}

export function snapshotFromStatus(account: AccountRecord, auth: AuthSummary | null, status: StatusSnapshot, now = new Date()): UsageSnapshot {
  return {
    account: account.name,
    email: status.account ?? auth?.email ?? account.email ?? null,
    plan: auth?.plan ?? null,
    usageSource: "status-scrape",
    homePath: account.home,
    fiveHour: windowFromLeft(status.fiveHourLeft, status.fiveHourReset),
    weekly: windowFromLeft(status.weeklyLeft, status.weeklyReset),
    fetchedAt: now.toISOString(),
  };
}

export async function fetchStatusScrapeUsage(account: AccountRecord, auth: AuthSummary | null, options: { timeoutMs?: number; now?: Date } = {}): Promise<UsageSnapshot> {
  const status = await fetchCodexStatus(account.home, { timeoutMs: options.timeoutMs });
  const snapshot = snapshotFromStatus(account, auth, status, options.now ?? new Date());
  if (!snapshot.fiveHour && !snapshot.weekly) throw new Error(`${account.name}: status scrape had no usage windows`);
  return snapshot;
}
