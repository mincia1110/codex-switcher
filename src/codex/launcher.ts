import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { existsSync } from "node:fs";
import { buildCodexEnv, buildPlainCodexEnv } from "./env.js";
import { ensureSharedHistory, ensureSharedSessionIndex, ensureSharedSessions } from "./shared-sessions.js";

const MACOS_CODEX_APP_BIN = "/Applications/Codex.app/Contents/Resources/codex";

export function codexBinary(): string {
  if (process.env.CXS_CODEX_BIN) return process.env.CXS_CODEX_BIN;
  if (existsSync(MACOS_CODEX_APP_BIN)) return MACOS_CODEX_APP_BIN;
  return "codex";
}

export async function commandExists(command: string): Promise<boolean> {
  if (command.includes("/")) {
    try { await access(command, constants.X_OK); return true; } catch { return false; }
  }
  return await new Promise((resolve) => {
    const child = spawn("sh", ["-lc", `command -v ${JSON.stringify(command)} >/dev/null 2>&1`]);
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

export async function runCodex(accountHome: string, args: string[]): Promise<number> {
  await ensureSharedSessions(accountHome);
  await ensureSharedHistory(accountHome);
  await ensureSharedSessionIndex(accountHome);
  return await new Promise((resolve, reject) => {
    const child = spawn(codexBinary(), args, { stdio: "inherit", env: buildCodexEnv(process.env, accountHome) });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export async function runPlainCodex(args: string[]): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(codexBinary(), args, { stdio: "inherit", env: buildPlainCodexEnv(process.env) });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}
