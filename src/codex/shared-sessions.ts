import { constants } from "node:fs";
import { access, appendFile, copyFile, cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import type { AccountRecord } from "../account/types.js";
import { defaultCodexHome, sharedHistoryPath, sharedSessionIndexPath, sharedSessionsPath } from "../account/paths.js";

type ParsedSessionIndexLine = {
  id: string;
  updatedAtMs?: number;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureEmptyFile(filePath: string, mode = 0o600): Promise<void> {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    await appendFile(filePath, "", { mode });
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

async function copyLinkedSessionsBestEffort(fromDir: string, toDir: string): Promise<void> {
  try {
    await copyMissingEntries(fromDir, toDir);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
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

  const targetLines = targetText.split(/\r?\n/).filter(Boolean);
  const existingLines = new Set(targetLines);
  const latestById = new Map<string, { updatedAtMs?: number }>();
  for (const line of targetLines) {
    const parsed = parseSessionIndexLine(line);
    if (parsed) latestById.set(parsed.id, { updatedAtMs: parsed.updatedAtMs });
  }

  const missing: string[] = [];
  for (const line of sourceText.split(/\r?\n/).filter(Boolean)) {
    if (existingLines.has(line)) continue;
    const parsed = parseSessionIndexLine(line);
    if (!parsed) {
      existingLines.add(line);
      missing.push(line);
      continue;
    }
    if (isNewerSessionIndexLine(parsed, latestById.get(parsed.id))) {
      existingLines.add(line);
      latestById.set(parsed.id, { updatedAtMs: parsed.updatedAtMs });
      missing.push(line);
    }
  }

  if (missing.length === 0) return;
  const prefix = targetText && !targetText.endsWith("\n") ? "\n" : "";
  await appendFile(target, `${prefix}${missing.join("\n")}\n`, { mode: 0o600 });
}

function parseSessionIndexLine(line: string): ParsedSessionIndexLine | undefined {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (typeof parsed?.id !== "string") return undefined;
    const rawUpdatedAt = parsed.updated_at ?? parsed.updatedAt;
    const updatedAtMs = typeof rawUpdatedAt === "string" ? Date.parse(rawUpdatedAt) : Number.NaN;
    return {
      id: parsed.id,
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
    };
  } catch {
    return undefined;
  }
}

function isNewerSessionIndexLine(candidate: ParsedSessionIndexLine, current: { updatedAtMs?: number } | undefined): boolean {
  if (!current) return true;
  if (candidate.updatedAtMs === undefined) return false;
  if (current.updatedAtMs === undefined) return true;
  return candidate.updatedAtMs > current.updatedAtMs;
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
      if (target === path.resolve(shared)) {
        await ensureEmptyFile(shared);
        return;
      }
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

  await ensureEmptyFile(shared);
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
      if (target === path.resolve(shared)) {
        await ensureEmptyFile(shared);
        return;
      }
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

  await ensureEmptyFile(shared);
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
      await copyLinkedSessionsBestEffort(accountSessions, shared);
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

export async function ensureSharedCodexState(accountHomes: string[]): Promise<void> {
  const homes = Array.from(new Set([defaultCodexHome(), ...accountHomes].map((home) => path.resolve(home))));
  for (const home of homes) {
    await ensureSharedSessions(home);
  }
  for (const home of homes) {
    await ensureSharedHistory(home);
    await ensureSharedSessionIndex(home);
  }
}

export async function ensureAllSharedSessions(accounts: AccountRecord[]): Promise<void> {
  await ensureSharedCodexState(accounts.map((account) => account.home));
}
