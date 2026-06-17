import type { AccountRecord } from "../../account/types.js";
import type { AuthSummary } from "../../account/auth.js";
import type { UsageSnapshot } from "../types.js";
import { normalizeUsageResponse, type UsageResponseShape } from "../normalize.js";

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const USER_AGENT = "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal";

export type UsageProviderErrorKind = "login-needed" | "token-expired" | "timeout" | "http-error" | "unknown-shape" | "provider-failed";

export class UsageProviderError extends Error {
  constructor(public kind: UsageProviderErrorKind, message: string) { super(message); this.name = "UsageProviderError"; }
}

export async function fetchBackendUsage(account: AccountRecord, auth: AuthSummary | null, options: { timeoutMs?: number; fetchImpl?: typeof fetch; now?: Date } = {}): Promise<UsageSnapshot> {
  if (!auth?.accessToken || !auth.accountId) throw new UsageProviderError("login-needed", `${account.name}: login needed for backend usage`);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(CODEX_USAGE_URL, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "ChatGPT-Account-Id": auth.accountId,
        "User-Agent": USER_AGENT,
      },
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new UsageProviderError("timeout", `${account.name}: backend usage timed out`);
    throw new UsageProviderError("provider-failed", error?.message ?? String(error));
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401) throw new UsageProviderError("token-expired", `${account.name}: token expired; re-login needed`);
  if (!response.ok) throw new UsageProviderError("http-error", `${account.name}: backend usage failed with ${response.status}`);
  const payload = await response.json() as UsageResponseShape;
  const windows = normalizeUsageResponse(payload, options.now ?? new Date());
  if (!windows.fiveHour && !windows.weekly) throw new UsageProviderError("unknown-shape", `${account.name}: backend usage response had no usage windows`);
  return {
    account: account.name,
    email: payload.email ?? auth.email,
    plan: payload.plan_type ?? payload.planType ?? auth.plan,
    usageSource: "backend-api",
    homePath: account.home,
    fiveHour: windows.fiveHour,
    weekly: windows.weekly,
    fetchedAt: (options.now ?? new Date()).toISOString(),
  };
}
