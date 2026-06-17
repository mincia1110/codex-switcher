export type UsageSource = "backend-api" | "status-scrape" | "local-log" | "cache" | "unknown";

export type UsageWindow = {
  usedPercent: number;
  remainingPercent: number;
  resetAfterSeconds: number | null;
  resetAt: string | null;
};

export type UsageSnapshot = {
  account: string;
  email: string | null;
  plan: string | null;
  usageSource: UsageSource;
  homePath: string;
  fiveHour: UsageWindow | null;
  weekly: UsageWindow | null;
  fetchedAt: string;
  stale?: boolean;
  error?: string;
};

export type UsageCache = {
  version: 1;
  snapshots: Record<string, UsageSnapshot>;
};

export type FetchUsageOptions = {
  preferCache?: boolean;
  maxCacheAgeMs?: number;
  allowBackendApi?: boolean;
  allowStatusFallback?: boolean;
  allowLocalLogFallback?: boolean;
  timeoutMs?: number;
};
