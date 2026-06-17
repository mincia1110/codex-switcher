import { describe, expect, it } from "vitest";
import { sortAccounts } from "../../src/account/accounts.js";
import type { UsageSnapshot } from "../../src/usage/types.js";

describe("switch usage safety", () => {
  it("treats unknown/error usage as sortable data instead of throwing", () => {
    const accounts = [
      { name: "bad", home: "/tmp/bad", createdAt: "2026-06-04T00:00:00.000Z" },
      { name: "good", home: "/tmp/good", createdAt: "2026-06-04T00:00:00.000Z" },
    ];
    const usage: Record<string, UsageSnapshot> = {
      bad: { account: "bad", email: null, plan: null, usageSource: "unknown", homePath: "/tmp/bad", fiveHour: null, weekly: null, fetchedAt: "2026-06-04T00:00:00.000Z", error: "login needed" },
      good: { account: "good", email: null, plan: null, usageSource: "backend-api", homePath: "/tmp/good", fiveHour: { usedPercent: 10, remainingPercent: 90, resetAfterSeconds: null, resetAt: null }, weekly: null, fetchedAt: "2026-06-04T00:00:00.000Z" },
    };
    expect(sortAccounts(accounts, usage, undefined, "quota").map((a) => a.name)).toEqual(["good", "bad"]);
  });
});
