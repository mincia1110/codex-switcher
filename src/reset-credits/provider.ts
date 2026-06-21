import { readFile } from "node:fs/promises";
import path from "node:path";

const RESET_CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const EXPECTED_HOST = "chatgpt.com";
const EXPECTED_PATH = "/backend-api/wham/rate-limit-reset-credits";

export type ResetCreditAuth = {
  accessToken: string;
  accountId: string;
};

type AuthFileShape = {
  tokens?: {
    access_token?: string;
    accessToken?: string;
    account_id?: string;
    accountId?: string;
  };
  access_token?: string;
  accessToken?: string;
  account?: { id?: string };
  account_id?: string;
  accountId?: string;
  profile?: { account_id?: string; accountId?: string };
};

export class ResetCreditError extends Error {
  constructor(message: string) { super(message); this.name = "ResetCreditError"; }
}

export async function readResetCreditAuth(accountHome: string): Promise<ResetCreditAuth> {
  const authPath = path.join(accountHome, "auth.json");
  let parsed: AuthFileShape;
  try {
    parsed = JSON.parse(await readFile(authPath, "utf8")) as AuthFileShape;
  } catch (error: any) {
    if (error?.code === "ENOENT") throw new ResetCreditError("Codex auth file was not found.");
    if (error?.code === "EACCES" || error?.code === "EPERM") throw new ResetCreditError("Codex auth file could not be read.");
    if (error instanceof SyntaxError) throw new ResetCreditError("Codex auth file was not valid JSON.");
    throw error;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ResetCreditError("Codex auth file did not contain a JSON object.");
  const accessToken = firstString(parsed, [["tokens", "access_token"], ["tokens", "accessToken"], ["access_token"], ["accessToken"]]);
  const accountId = firstString(parsed, [["account", "id"], ["tokens", "account_id"], ["tokens", "accountId"], ["account_id"], ["accountId"], ["profile", "account_id"], ["profile", "accountId"]]);

  if (!accessToken) throw new ResetCreditError("Could not find an access token in Codex auth.");
  if (!accountId) throw new ResetCreditError("Could not find an account ID in Codex auth.");
  return { accessToken, accountId };
}

export async function fetchResetCredits(auth: ResetCreditAuth, options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<Record<string, unknown>> {
  const url = new URL(RESET_CREDITS_URL);
  if (url.protocol !== "https:" || url.hostname !== EXPECTED_HOST || url.pathname !== EXPECTED_PATH) {
    throw new ResetCreditError("Configured endpoint failed safety validation.");
  }

  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(RESET_CREDITS_URL, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "OpenAI-Account": auth.accountId,
        "Content-Type": "application/json",
        "User-Agent": "cxs/0.1 reset-credits",
      },
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new ResetCreditError("Reset credit endpoint timed out.");
    throw new ResetCreditError("Could not reach reset credit endpoint.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new ResetCreditError(`Endpoint returned HTTP ${response.status}.`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ResetCreditError("Endpoint response was not valid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ResetCreditError("Endpoint response did not contain a JSON object.");
  return payload as Record<string, unknown>;
}

export function formatResetCredits(data: Record<string, unknown>, options: { timezone?: string } = {}): string {
  const available = findFirst(data, ["available_reset_credits", "availableResetCredits", "available_count", "availableCount", "available"]);
  const totalEarned = findFirst(data, ["total_earned_count", "totalEarnedCount", "total_earned"]);
  const credits = findCredits(data);
  const lines = [
    `Available reset credits: ${displayCount(available)}`,
    `Total earned count: ${displayCount(totalEarned)}`,
  ];

  if (credits.length === 0) {
    lines.push("No reset credit expiries found.");
    return lines.join("\n");
  }

  credits.forEach((credit, index) => {
    const expiry = findFirst(credit, ["expires_at", "expiresAt", "expiration_time", "expirationTime"]);
    lines.push(`Credit ${index + 1} expires: ${formatExpiry(expiry, options.timezone)}`);
  });
  return lines.join("\n");
}

function firstString(data: Record<string, unknown>, paths: string[][]): string | null {
  for (const keys of paths) {
    let value: unknown = data;
    for (const key of keys) {
      if (!value || typeof value !== "object" || Array.isArray(value) || !(key in value)) {
        value = null;
        break;
      }
      value = (value as Record<string, unknown>)[key];
    }
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function findFirst(data: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (name in data) return data[name];
  }
  return null;
}

function findCredits(data: Record<string, unknown>): Record<string, unknown>[] {
  for (const name of ["reset_credits", "resetCredits", "credits", "items"]) {
    const value = data[name];
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  return [];
}

function displayCount(value: unknown): string {
  if (typeof value === "boolean" || value === null || value === undefined) return "unknown";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return "unknown";
}

function formatExpiry(value: unknown, timezone?: string): string {
  const date = parseExpiry(value);
  if (!date) return "unknown";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
  } catch (error: any) {
    if (error instanceof RangeError) throw new ResetCreditError(`Unsupported timezone: ${timezone}`);
    throw error;
  }
}

function parseExpiry(value: unknown): Date | null {
  if (typeof value === "boolean" || value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const date = new Date(text.endsWith("Z") ? text : text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
