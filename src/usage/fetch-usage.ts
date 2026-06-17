import type { AccountRecord } from "../account/types.js";
import { readAuthSummary } from "../account/auth.js";
import type { FetchUsageOptions, UsageSnapshot } from "./types.js";
import { writeUsageCache, readUsageCache } from "./cache.js";
import { fetchBackendUsage } from "./providers/backend.js";
import { fetchStatusScrapeUsage } from "./providers/status-scrape.js";
import { fetchCachedUsage, ACCEPTABLE_CACHE_MS } from "./providers/cache.js";
import { scanAccountUsage } from "./scanner.js";

function unknownSnapshot(account: AccountRecord, error: string): UsageSnapshot {
  return { account: account.name, email: account.email ?? null, plan: null, usageSource: "unknown", homePath: account.home, fiveHour: null, weekly: null, fetchedAt: new Date().toISOString(), error };
}

async function saveSuccess(snapshot: UsageSnapshot): Promise<void> {
  if (snapshot.usageSource === "unknown" || snapshot.usageSource === "cache" || snapshot.error) return;
  const cache = await readUsageCache();
  await writeUsageCache({ ...cache.snapshots, [snapshot.account]: snapshot });
}

export async function fetchUsage(account: AccountRecord, options: FetchUsageOptions = {}): Promise<UsageSnapshot> {
  const preferCache = options.preferCache ?? false;
  const maxCacheAgeMs = options.maxCacheAgeMs ?? ACCEPTABLE_CACHE_MS;
  const allowBackendApi = options.allowBackendApi ?? true;
  const allowStatusFallback = options.allowStatusFallback ?? true;
  const allowLocalLogFallback = options.allowLocalLogFallback ?? true;
  const timeoutMs = options.timeoutMs;

  if (preferCache) {
    const cached = await fetchCachedUsage(account, { maxCacheAgeMs });
    if (cached && !cached.stale) return cached;
  }

  const auth = await readAuthSummary(account.home);
  const errors: string[] = [];

  if (allowBackendApi) {
    try {
      const snapshot = await fetchBackendUsage(account, auth, { timeoutMs });
      await saveSuccess(snapshot);
      return snapshot;
    } catch (error: any) { errors.push(error?.message ?? String(error)); }
  }

  if (allowStatusFallback) {
    try {
      const snapshot = await fetchStatusScrapeUsage(account, auth, { timeoutMs });
      await saveSuccess(snapshot);
      return snapshot;
    } catch (error: any) { errors.push(error?.message ?? String(error)); }
  }

  if (allowLocalLogFallback) {
    const snapshot = await scanAccountUsage(account.name, account.home);
    if (snapshot.usageSource !== "unknown") {
      await saveSuccess(snapshot);
      return { ...snapshot, email: snapshot.email ?? auth?.email ?? account.email ?? null, plan: snapshot.plan ?? auth?.plan ?? null };
    }
    if (snapshot.error) errors.push(snapshot.error);
  }

  const cached = await fetchCachedUsage(account, { maxCacheAgeMs: Number.POSITIVE_INFINITY });
  if (cached) return cached;

  return unknownSnapshot(account, errors.join("; ") || "No usage provider enabled or no usage data available");
}

export async function fetchAllUsage(accounts: AccountRecord[], options: FetchUsageOptions = {}): Promise<Record<string, UsageSnapshot>> {
  const entries = await Promise.all(accounts.map(async (account) => [account.name, await fetchUsage(account, options)] as const));
  return Object.fromEntries(entries);
}
