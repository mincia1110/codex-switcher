import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsage } from "../../src/usage/fetch-usage.js";
import { readUsageCache, writeUsageCache } from "../../src/usage/cache.js";

const account = (home: string, name = "work") => ({ name, home, createdAt: "2026-06-04T00:00:00.000Z" });
const originalHome = process.env.HOME;
let cxsHome: string;

beforeEach(async () => {
  cxsHome = await mkdtemp(path.join(tmpdir(), "cxs-fetch-home-"));
  process.env.HOME = cxsHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
});

describe("fetchUsage orchestration", () => {
  it("ignores a corrupted usage cache", async () => {
    const cacheFile = path.join(cxsHome, ".cxs", "cache", "usage.json");
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, '{"version":1,"snapshots":{}}\n}\n');

    await expect(readUsageCache()).resolves.toEqual({ version: 1, snapshots: {} });
    await expect(readUsageCache()).resolves.toEqual({ version: 1, snapshots: {} });
  });

  it("falls back to cache when backend/status/local providers fail", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-fetch-cache-"));
    const snapshot = { account: "work", email: "person@example.com", plan: "plus", usageSource: "backend-api" as const, homePath: home, fiveHour: { usedPercent: 10, remainingPercent: 90, resetAfterSeconds: null, resetAt: null }, weekly: null, fetchedAt: new Date().toISOString() };
    await writeUsageCache({ work: snapshot });
    const result = await fetchUsage(account(home), { allowBackendApi: false, allowStatusFallback: false, allowLocalLogFallback: false });
    expect(result.usageSource).toBe("cache");
    expect(result.stale).toBe(false);
    expect(result.fiveHour?.remainingPercent).toBe(90);
  });

  it("does not throw when every usage provider fails", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-fetch-unknown-"));
    const result = await fetchUsage(account(home, "no-providers"), { allowBackendApi: false, allowStatusFallback: false, allowLocalLogFallback: false });
    expect(result.usageSource).toBe("unknown");
    expect(result.error).toMatch(/No usage provider/);
  });
});
