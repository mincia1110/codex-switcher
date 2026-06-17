import { access, stat } from "node:fs/promises";
import { cxsRoot, usageCachePath, accountAuthJsonPath, accountConfigTomlPath } from "../account/paths.js";
import { readConfig } from "../account/config.js";
import { readUsageCache } from "../usage/cache.js";
import { maskEmail } from "../utils/mask.js";

type FileStatus = { exists: boolean; mode?: string };

export type RedactedDiagnosticsBundle = {
  generatedAt: string;
  runtime: { node: string; platform: string; arch: string };
  paths: { cxsRoot: string };
  defaultAccount?: string;
  accounts: Array<{
    name: string;
    home: string;
    email: string;
    createdAt: string;
    lastUsedAt?: string;
    configToml: FileStatus;
    authJson: FileStatus;
    sessionsDir: FileStatus;
    logsDir: FileStatus;
  }>;
  usageCache: { path: string; exists: boolean; accounts: string[] };
};

async function fileStatus(path: string): Promise<FileStatus> {
  try {
    const s = await stat(path);
    return { exists: true, mode: (s.mode & 0o777).toString(8).padStart(3, "0") };
  } catch {
    return { exists: false };
  }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export async function createRedactedDiagnosticsBundle(now = new Date()): Promise<RedactedDiagnosticsBundle> {
  const config = await readConfig();
  let usageAccounts: string[] = [];
  let usageExists = false;
  try {
    const cache = await readUsageCache();
    usageExists = await exists(usageCachePath());
    usageAccounts = Object.keys(cache.snapshots).sort();
  } catch {
    usageExists = await exists(usageCachePath());
  }

  const accounts = await Promise.all(Object.values(config.accounts).sort((a, b) => a.name.localeCompare(b.name)).map(async (account) => ({
    name: account.name,
    home: account.home,
    email: maskEmail(account.email),
    createdAt: account.createdAt,
    lastUsedAt: account.lastUsedAt,
    configToml: await fileStatus(accountConfigTomlPath(account.name)),
    authJson: await fileStatus(accountAuthJsonPath(account.name)),
    sessionsDir: await fileStatus(`${account.home}/sessions`),
    logsDir: await fileStatus(`${account.home}/logs`),
  })));

  return {
    generatedAt: now.toISOString(),
    runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
    paths: { cxsRoot: cxsRoot() },
    defaultAccount: config.defaultAccount,
    accounts,
    usageCache: { path: usageCachePath(), exists: usageExists, accounts: usageAccounts },
  };
}
