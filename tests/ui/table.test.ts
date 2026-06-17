import { describe, expect, it } from "vitest";
import { switchLabel, usageTable } from "../../src/ui/table.js";
import type { AccountRecord } from "../../src/account/types.js";
import type { UsageSnapshot } from "../../src/usage/types.js";

const account: AccountRecord = {
  name: "work",
  home: "/tmp/work",
  email: "person@example.com",
  createdAt: "2026-06-04T00:00:00.000Z",
};

const snapshot: UsageSnapshot = {
  account: "work",
  email: "person@example.com",
  plan: "plus",
  usageSource: "backend-api",
  homePath: "/tmp/work",
  fiveHour: {
    usedPercent: 10,
    remainingPercent: 90,
    resetAfterSeconds: 3600,
    resetAt: "2026-06-04T11:00:00.000+09:00",
  },
  weekly: {
    usedPercent: 30,
    remainingPercent: 70,
    resetAfterSeconds: 345600,
    resetAt: "2026-06-08T10:00:00.000+09:00",
  },
  fetchedAt: "2026-06-04T10:00:00.000Z",
};

describe("usage tables", () => {
  it("shows separate five-hour and weekly reset times in usage output", () => {
    const output = usageTable([account], { work: snapshot });

    expect(output).toContain("5h reset");
    expect(output).toContain("Week reset");
    expect(output).toContain("11:00");
    expect(output).toContain("2026-06-08 10:00");
  });

  it("includes weekly reset date in switch labels", () => {
    expect(switchLabel(account, snapshot)).toContain("week 70% reset 2026-06-08 10:00");
  });
});
