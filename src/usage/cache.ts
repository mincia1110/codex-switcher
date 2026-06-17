import { readFile } from "node:fs/promises";
import { usageCachePath } from "../account/paths.js";
import { atomicWriteFile, safeJsonStringify } from "../utils/fs.js";
import { assertNoSecrets } from "../account/config.js";
import type { UsageCache, UsageSnapshot } from "./types.js";

const emptyUsageCache = (): UsageCache => ({ version: 1, snapshots: {} });

async function resetUsageCacheBestEffort(): Promise<UsageCache> {
  const empty = emptyUsageCache();
  try {
    await atomicWriteFile(usageCachePath(), safeJsonStringify(empty), 0o600);
  } catch {
    // A corrupted cache should not block account switching or Codex startup.
  }
  return empty;
}

export async function readUsageCache(): Promise<UsageCache> {
  try {
    const raw = await readFile(usageCachePath(), "utf8");
    const parsed = JSON.parse(raw) as UsageCache;
    if (parsed.version !== 1 || typeof parsed.snapshots !== "object") throw new Error("Invalid usage cache schema");
    return parsed;
  } catch (error: any) {
    if (error?.code === "ENOENT") return emptyUsageCache();
    if (error instanceof SyntaxError || error?.message === "Invalid usage cache schema") return await resetUsageCacheBestEffort();
    throw error;
  }
}

export async function writeUsageCache(snapshots: Record<string, UsageSnapshot>): Promise<void> {
  const cache: UsageCache = { version: 1, snapshots };
  assertNoSecrets(cache);
  await atomicWriteFile(usageCachePath(), safeJsonStringify(cache), 0o600);
}
