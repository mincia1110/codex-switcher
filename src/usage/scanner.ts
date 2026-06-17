import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import path from "node:path";
import { parseUsageLine } from "./parser.js";
import type { UsageSnapshot } from "./types.js";

function score(snapshot: UsageSnapshot): number {
  const complete = snapshot.fiveHour && snapshot.weekly ? 1000 : snapshot.fiveHour || snapshot.weekly ? 500 : 0;
  const fetched = Date.parse(snapshot.fetchedAt) || 0;
  return complete + fetched / 1_000_000_000_000;
}

export async function scanAccountUsage(account: string, home: string, now = new Date()): Promise<UsageSnapshot> {
  const homePath = path.resolve(home);
  try {
    const files = await fg(["sessions/**/*.jsonl", "logs/**/*.jsonl"], { cwd: homePath, absolute: true, onlyFiles: true });
    let best: UsageSnapshot | undefined;
    for (const file of files.sort()) {
      const raw = await readFile(file, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parsed = parseUsageLine(account, line, now, homePath);
        if (parsed && (!best || score(parsed) >= score(best))) best = parsed;
      }
    }
    if (best) return best;
    return { account, email: null, plan: null, usageSource: "unknown", homePath, fiveHour: null, weekly: null, fetchedAt: now.toISOString(), error: "No usage data found in sessions/logs JSONL files" };
  } catch (error: any) {
    return { account, email: null, plan: null, usageSource: "unknown", homePath, fiveHour: null, weekly: null, fetchedAt: now.toISOString(), error: error?.message ?? String(error) };
  }
}

export async function scanAllAccounts(accounts: { name: string; home: string }[], now = new Date()): Promise<Record<string, UsageSnapshot>> {
  const out: Record<string, UsageSnapshot> = {};
  for (const account of accounts) out[account.name] = await scanAccountUsage(account.name, account.home, now);
  return out;
}
