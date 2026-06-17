import { chmod, readFile, stat } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { accountAuthJsonPath } from "./paths.js";

export type AuthSummary = {
  email: string | null;
  plan: string | null;
  organization: string | null;
  accountId: string | null;
  accessToken: string | null;
  lastRefresh: string | null;
};

type AuthFileShape = {
  last_refresh?: string;
  tokens?: {
    id_token?: string;
    access_token?: string;
    account_id?: string;
  };
};

export async function chmodAuthFile(name: string): Promise<boolean> {
  try { await chmod(accountAuthJsonPath(name), 0o600); return true; } catch { return false; }
}

export function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try { return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>; }
  catch { return null; }
}

export async function readAuthSummary(homePath: string): Promise<AuthSummary | null> {
  const authPath = path.join(homePath, "auth.json");
  if (!fs.existsSync(authPath)) return null;
  try {
    const parsed = JSON.parse(await readFile(authPath, "utf8")) as AuthFileShape;
    const payload = decodeJwtPayload(parsed.tokens?.id_token);
    const authDetails = payload?.["https://api.openai.com/auth"];
    const authObject = authDetails && typeof authDetails === "object" ? authDetails as Record<string, unknown> : null;
    const organizations = Array.isArray(authObject?.organizations) ? authObject.organizations as Array<Record<string, unknown>> : [];
    const defaultOrg = organizations.find((org) => Boolean(org.is_default)) ?? organizations[0];
    return {
      email: typeof payload?.email === "string" ? payload.email : null,
      plan: typeof authObject?.chatgpt_plan_type === "string" ? authObject.chatgpt_plan_type : null,
      organization: typeof defaultOrg?.title === "string" ? defaultOrg.title : null,
      accountId: typeof parsed.tokens?.account_id === "string" ? parsed.tokens.account_id : null,
      accessToken: typeof parsed.tokens?.access_token === "string" ? parsed.tokens.access_token : null,
      lastRefresh: typeof parsed.last_refresh === "string" ? parsed.last_refresh : null,
    };
  } catch {
    return null;
  }
}

export async function detectEmailFromAuth(name: string): Promise<string | undefined> {
  const summary = await readAuthSummary(path.dirname(accountAuthJsonPath(name)));
  return summary?.email ?? undefined;
}

export async function authMode(name: string): Promise<number | undefined> {
  try { return (await stat(accountAuthJsonPath(name))).mode & 0o777; } catch { return undefined; }
}
