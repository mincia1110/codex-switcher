import type { UsageWindow } from "./types.js";

export type UsageWindowShape = {
  used_percent?: number;
  usedPercent?: number;
  reset_after_seconds?: number | null;
  resetAfterSeconds?: number | null;
  resets_in_seconds?: number | null;
  resetsInSeconds?: number | null;
};

export type UsageRateLimitShape = {
  primary_window?: UsageWindowShape;
  primaryWindow?: UsageWindowShape;
  secondary_window?: UsageWindowShape;
  secondaryWindow?: UsageWindowShape;
  primary?: UsageWindowShape;
  secondary?: UsageWindowShape;
  five_hour?: UsageWindowShape;
  fiveHour?: UsageWindowShape;
  weekly?: UsageWindowShape;
};

export type UsageResponseShape = {
  email?: string;
  plan_type?: string;
  planType?: string;
  rate_limit?: UsageRateLimitShape;
  rateLimit?: UsageRateLimitShape;
  rate_limits?: UsageRateLimitShape;
  rateLimits?: UsageRateLimitShape;
};

function clampPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function normalizeWindow(input: UsageWindowShape | undefined, now = new Date()): UsageWindow | null {
  if (!input) return null;
  const usedPercent = clampPercent(input.used_percent ?? input.usedPercent);
  if (usedPercent === null) return null;
  const resetAfterSecondsRaw = input.reset_after_seconds ?? input.resetAfterSeconds ?? input.resets_in_seconds ?? input.resetsInSeconds ?? null;
  const resetAfterSeconds = typeof resetAfterSecondsRaw === "number" && Number.isFinite(resetAfterSecondsRaw) ? resetAfterSecondsRaw : null;
  return {
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    resetAfterSeconds,
    resetAt: resetAfterSeconds === null ? null : new Date(now.getTime() + resetAfterSeconds * 1000).toISOString(),
  };
}

export function normalizeUsageResponse(input: UsageResponseShape, now = new Date()): { fiveHour: UsageWindow | null; weekly: UsageWindow | null } {
  const rateLimit = input.rate_limit ?? input.rateLimit ?? input.rate_limits ?? input.rateLimits;
  return {
    fiveHour: normalizeWindow(rateLimit?.primary_window ?? rateLimit?.primaryWindow ?? rateLimit?.primary ?? rateLimit?.five_hour ?? rateLimit?.fiveHour, now),
    weekly: normalizeWindow(rateLimit?.secondary_window ?? rateLimit?.secondaryWindow ?? rateLimit?.secondary ?? rateLimit?.weekly, now),
  };
}
