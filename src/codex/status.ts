import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildCodexEnv } from "./env.js";
import { codexBinary, commandExists } from "./launcher.js";
import { stripAnsi } from "./ansi.js";

export type StatusSnapshot = {
  account: string | null;
  model: string | null;
  sessionId: string | null;
  fiveHourLeft: number | null;
  fiveHourReset: string | null;
  weeklyLeft: number | null;
  weeklyReset: string | null;
  rawText: string;
};

function wait(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForPattern(getText: () => string, pattern: RegExp, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(getText())) return true;
    await wait(150);
  }
  return false;
}

export function parseStatusText(rawText: string): StatusSnapshot {
  const text = stripAnsi(rawText).split("\n").map((line) => line.trimEnd()).filter(Boolean).join("\n");
  const fiveHourMatch = text.match(/5h limit:\s+\[[^\]]+\]\s+(\d+)% left\s+\(resets ([^)]+)\)/);
  const weeklyMatch = text.match(/Weekly limit:\s+\[[^\]]+\]\s+(\d+)% left[\s\S]*?\(resets ([^)]+)\)/);
  return {
    account: text.match(/Account:\s+([^\n]+)/)?.[1]?.trim() ?? null,
    model: text.match(/Model:\s+([^\n]+)/)?.[1]?.trim() ?? null,
    sessionId: text.match(/Session:\s+([^\n]+)/)?.[1]?.trim() ?? null,
    fiveHourLeft: fiveHourMatch ? Number(fiveHourMatch[1]) : null,
    fiveHourReset: fiveHourMatch?.[2] ?? null,
    weeklyLeft: weeklyMatch ? Number(weeklyMatch[1]) : null,
    weeklyReset: weeklyMatch?.[2] ?? null,
    rawText: text,
  };
}

export async function fetchCodexStatus(accountHome: string, options: { timeoutMs?: number } = {}): Promise<StatusSnapshot> {
  if (!(await commandExists(codexBinary()))) throw new Error("codex binary not found");
  if (!(await commandExists("script"))) throw new Error("script binary not found");
  const timeoutMs = options.timeoutMs ?? 25_000;
  const scratchDir = await mkdtemp(path.join(os.tmpdir(), "cxs-status-"));
  const shellCommand = `${codexBinary()} --no-alt-screen -C ${JSON.stringify(scratchDir)}`;
  const child = spawn("script", ["-qfec", shellCommand, "/dev/null"], {
    env: buildCodexEnv(process.env, accountHome),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let rawOutput = "";
  child.stdout?.on("data", (chunk) => { rawOutput += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { rawOutput += chunk.toString(); });
  const killTimer = setTimeout(() => child.kill("SIGTERM"), timeoutMs + 5_000);
  try {
    await waitForPattern(() => stripAnsi(rawOutput), /(Do you trust the contents of this directory\?|OpenAI Codex)/, Math.min(timeoutMs, 20_000));
    if (stripAnsi(rawOutput).includes("Do you trust the contents of this directory?")) child.stdin?.write("\r");
    const ready = await waitForPattern(() => stripAnsi(rawOutput), /(Tip:|To get started|context left|100% left|\/status - show current session configuration|OpenAI Codex)/, timeoutMs);
    if (!ready) throw new Error("Timed out while waiting for Codex to become ready");
    child.stdin?.write("\u0015/status\r");
    const statusReady = await waitForPattern(() => stripAnsi(rawOutput), /5h limit:\s+\[[^\]]+\]\s+\d+% left[\s\S]*Weekly limit:\s+\[[^\]]+\]\s+\d+% left/, timeoutMs);
    if (!statusReady) throw new Error("Timed out while waiting for /status output");
    return parseStatusText(rawOutput);
  } finally {
    clearTimeout(killTimer);
    child.kill("SIGTERM");
    await rm(scratchDir, { recursive: true, force: true });
  }
}
