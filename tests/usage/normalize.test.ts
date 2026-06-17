import { describe, expect, it, vi } from "vitest";
import { normalizeUsageResponse, normalizeWindow } from "../../src/usage/normalize.js";

describe("usage normalization", () => {
  it("normalizes backend snake_case response", () => {
    vi.setSystemTime(new Date("2026-06-04T10:00:00.000Z"));
    expect(normalizeUsageResponse({ rate_limit: { primary_window: { used_percent: 18, reset_after_seconds: 3600 }, secondary_window: { used_percent: 36, reset_after_seconds: null } } })).toEqual({
      fiveHour: { usedPercent: 18, remainingPercent: 82, resetAfterSeconds: 3600, resetAt: "2026-06-04T11:00:00.000Z" },
      weekly: { usedPercent: 36, remainingPercent: 64, resetAfterSeconds: null, resetAt: null },
    });
    vi.useRealTimers();
  });

  it("normalizes backend camelCase response", () => {
    expect(normalizeUsageResponse({ rateLimit: { primaryWindow: { usedPercent: 79 }, secondaryWindow: { usedPercent: 1, resetAfterSeconds: 10 } } }).fiveHour?.remainingPercent).toBe(21);
  });

  it("clamps usedPercent", () => {
    expect(normalizeWindow({ used_percent: -5 })?.remainingPercent).toBe(100);
    expect(normalizeWindow({ used_percent: 120 })?.remainingPercent).toBe(0);
  });

  it("supports primary-only and secondary-only responses", () => {
    expect(normalizeUsageResponse({ rate_limit: { primary_window: { used_percent: 10 } } }).weekly).toBeNull();
    expect(normalizeUsageResponse({ rate_limit: { secondary_window: { used_percent: 20 } } }).fiveHour).toBeNull();
  });
});
