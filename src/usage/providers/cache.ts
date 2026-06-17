import type { AccountRecord } from "../../account/types.js";
import { readUsageCache } from "../cache.js";
import type { UsageSnapshot } from "../types.js";

export const FRESH_CACHE_MS = 60_000;
export const ACCEPTABLE_CACHE_MS = 10 * 60_000;

export async function fetchCachedUsage(account: AccountRecord, options: { maxCacheAgeMs?: number; now?: Date } = {}): Promise<UsageSnapshot | null> {
  const cache = await readUsageCache();
  const found = cache.snapshots[account.name];
  if (!found) return null;
  const nowMs = (options.now ?? new Date()).getTime();
  const age = nowMs - (Date.parse(found.fetchedAt) || 0);
  const maxAge = options.maxCacheAgeMs ?? ACCEPTABLE_CACHE_MS;
  if (age > maxAge) return { ...found, usageSource: "cache", stale: true };
  return { ...found, usageSource: "cache", stale: age > FRESH_CACHE_MS };
}
