import { constants } from "node:fs";
import { access, appendFile, copyFile, cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import type { AccountRecord } from "../account/types.js";
import { sharedHistoryPath, sharedSessionIndexPath, sharedSessionsPath } from "../account/paths.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyMissingEntries(fromDir: string, toDir: string): Promise<void> {
  await mkdir(toDir, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(fromDir, { withFileTypes: true })) {
    const source = path.join(fromDir, entry.name);
    const target = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      await copyMissingEntries(source, target);
    } else if (!(await exists(target))) {
      if (entry.isFile()) await copyFile(source, target);
      else await cp(source, target, { recursive: true, force: false });
    }
  }
}

async function appendMissingHistory(source: string, target: string): Promise<void> {
  let sourceText = "";
  try {
    sourceText = await readFile(source, "utf8");
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!sourceText.trim()) return;

  let targetText = "";
  try {
    targetText = await readFile(target, "utf8");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  const existing = new Set(targetText.split(/\r?\n/).filter(Boolean));
  const missing = sourceText.split(/\r?\n/).filter((line) => line && !existing.has(line));
  if (missing.length === 0) return;
  const prefix = targetText && !targetText.endsWith("\n") ? "\n" : "";
  await appendFile(target, `${prefix}${missing.join("\n")}\n`, { mode: 0o600 });
}

async function appendMissingSessionIndex(source: string, target: string): Promise<void> {
  let sourceText = "";
  try {
    sourceText = await readFile(source, "utf8");
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!sourceText.trim()) return;

  let targetText = "";
  try {
    targetText = await readFile(target, "utf8");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  const existingIds = new Set<string>();
  for (const line of targetText.split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed?.id === "string") existingIds.add(parsed.id);
    } catch {
      existingIds.add(line);
    }
  }

  const missing: string[] = [];
  for (const line of sourceText.split(/\r?\n/).filter(Boolean)) {
    let key = line;
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed?.id === "string") key = parsed.id;
    } catch {
      // Keep malformed-but-existing lines deduped by exact text.
    }
    if (!existingIds.has(key)) {
      existingIds.add(key);
      missing.push(line);
    }
  }

  if (missing.length === 0) return;
  const prefix = targetText && !targetText.endsWith("\n") ? "\n" : "";
  await appendFile(target, `${prefix}${missing.join("\n")}\n`, { mode: 0o600 });
}

export async function ensureSharedHistory(accountHome: string): Promise<void> {
  const shared = sharedHistoryPath();
  const accountHistory = path.join(accountHome, "history.jsonl");
  await mkdir(accountHome, { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(shared), { recursive: true, mode: 0o700 });

  try {
    const current = await lstat(accountHistory);
    if (current.isSymbolicLink()) {
      const target = path.resolve(path.dirname(accountHistory), await readlink(accountHistory));
      if (target === path.resolve(shared)) return;
      await appendMissingHistory(accountHistory, shared);
      await rm(accountHistory);
    } else if (current.isFile()) {
      await appendMissingHistory(accountHistory, shared);
      await rm(accountHistory);
    } else {
      throw new Error(`${accountHistory} exists but is not a file or symlink`);
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await access(shared, constants.F_OK);
  } catch {
    await appendFile(shared, "", { mode: 0o600 });
  }
  await symlink(shared, accountHistory, "file");
}

export async function ensureSharedSessionIndex(accountHome: string): Promise<void> {
  const shared = sharedSessionIndexPath();
  const accountSessionIndex = path.join(accountHome, "session_index.jsonl");
  await mkdir(accountHome, { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(shared), { recursive: true, mode: 0o700 });

  try {
    const current = await lstat(accountSessionIndex);
    if (current.isSymbolicLink()) {
      const target = path.resolve(path.dirname(accountSessionIndex), await readlink(accountSessionIndex));
      if (target === path.resolve(shared)) return;
      await appendMissingSessionIndex(accountSessionIndex, shared);
      await rm(accountSessionIndex);
    } else if (current.isFile()) {
      await appendMissingSessionIndex(accountSessionIndex, shared);
      await rm(accountSessionIndex);
    } else {
      throw new Error(`${accountSessionIndex} exists but is not a file or symlink`);
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await access(shared, constants.F_OK);
  } catch {
    await appendFile(shared, "", { mode: 0o600 });
  }
  await symlink(shared, accountSessionIndex, "file");
}

export async function ensureSharedSessions(accountHome: string): Promise<void> {
  const shared = sharedSessionsPath();
  const accountSessions = path.join(accountHome, "sessions");
  await mkdir(accountHome, { recursive: true, mode: 0o700 });
  await mkdir(shared, { recursive: true, mode: 0o700 });

  try {
    const current = await lstat(accountSessions);
    if (current.isSymbolicLink()) {
      const target = path.resolve(path.dirname(accountSessions), await readlink(accountSessions));
      if (target === path.resolve(shared)) return;
      await rm(accountSessions);
    } else if (current.isDirectory()) {
      await copyMissingEntries(accountSessions, shared);
      await rm(accountSessions, { recursive: true });
    } else {
      throw new Error(`${accountSessions} exists but is not a directory or symlink`);
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  await symlink(shared, accountSessions, "dir");
}

export async function ensureAllSharedSessions(accounts: AccountRecord[]): Promise<void> {
  for (const account of accounts) {
    await ensureSharedSessions(account.home);
    await ensureSharedHistory(account.home);
    await ensureSharedSessionIndex(account.home);
  }
}
