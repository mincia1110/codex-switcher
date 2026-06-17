import type { UsageSnapshot } from "./types.js";
import { normalizeUsageResponse } from "./normalize.js";

function extractEmbeddedJson(line: string): any | undefined {
  for (const marker of ["{\"rate_limits\"", "{\"rateLimits\"", "{\"rate_limit\"", "{\"rateLimit\""]) {
    const start = line.indexOf(marker);
    if (start === -1) continue;
    try { return JSON.parse(line.slice(start)); } catch { /* keep scanning */ }
  }
  return undefined;
}

export function parseUsageLine(account: string, line: string, now = new Date(), homePath = ""): UsageSnapshot | undefined {
  let obj: any;
  try { obj = JSON.parse(line); }
  catch {
    obj = extractEmbeddedJson(line);
    if (!obj) return undefined;
  }
  const windows = normalizeUsageResponse(obj, now);
  if (!windows.fiveHour && !windows.weekly) return undefined;
  return {
    account,
    email: typeof obj.email === "string" ? obj.email : null,
    plan: typeof obj.plan_type === "string" ? obj.plan_type : typeof obj.planType === "string" ? obj.planType : null,
    usageSource: "local-log",
    homePath,
    fiveHour: windows.fiveHour,
    weekly: windows.weekly,
    fetchedAt: now.toISOString(),
  };
}
