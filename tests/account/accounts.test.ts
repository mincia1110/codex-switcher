import { describe, expect, it } from "vitest";
import { sortAccounts, validateAccountName } from "../../src/account/accounts.js";
import type { AccountRecord } from "../../src/account/types.js";
import type { UsageSnapshot } from "../../src/usage/types.js";

const account = (name: string, overrides: Partial<AccountRecord> = {}): AccountRecord => ({
  name,
  home: `/tmp/${name}`,
  createdAt: "2026-06-04T00:00:00.000Z",
  ...overrides,
});

describe("validateAccountName", () => {
  it("accepts safe account names", () => {
    expect(validateAccountName("personal"));
    expect(validateAccountName("work-1"));
    expect(validateAccountName("a.b_c"));
  });

  it("rejects path traversal and unsafe names", () => {
    for (const name of ["", ".", "..", "../x", "x/y", "-starts-dash", " space", "x space"]) {
      expect(() => validateAccountName(name)).toThrow();
    }
  });
});

describe("sortAccounts", () => {
  it("puts default first, then usage-bearing high-quota accounts, then recent/name", () => {
    const accounts = [
      account("backup", { lastUsedAt: "2026-06-04T09:00:00.000Z" }),
      account("personal", { lastUsedAt: "2026-06-04T10:00:00.000Z" }),
      account("work", { lastUsedAt: "2026-06-04T08:00:00.000Z" }),
    ];
    const usage: Record<string, UsageSnapshot> = {
      personal: { account: "personal", email: null, plan: null, usageSource: "local-log", homePath: "/tmp/personal", fiveHour: { usedPercent: 20, remainingPercent: 80, resetAfterSeconds: null, resetAt: null }, weekly: { usedPercent: 40, remainingPercent: 60, resetAfterSeconds: null, resetAt: null }, fetchedAt: "2026-06-04T10:00:00.000Z" },
      backup: { account: "backup", email: null, plan: null, usageSource: "unknown", homePath: "/tmp/backup", fiveHour: null, weekly: null, fetchedAt: "2026-06-04T10:00:00.000Z" },
    };

    expect(sortAccounts(accounts, usage, "work", "default").map((a) => a.name)).toEqual(["work", "personal", "backup"]);
  });
});
