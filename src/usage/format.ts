import type { UsageSnapshot } from "./types.js";

export function usageSourceLabel(snapshot?: UsageSnapshot): string {
  if (!snapshot) return "unknown";
  if (snapshot.usageSource === "backend-api") return "backend-api";
  if (snapshot.usageSource === "status-scrape") return "status-scrape";
  if (snapshot.usageSource === "cache") return snapshot.stale ? "cache stale" : "cache";
  return snapshot.usageSource;
}
