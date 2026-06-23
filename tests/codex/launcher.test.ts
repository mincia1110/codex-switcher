import { chmod, lstat, mkdir, mkdtemp, readFile, readlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: vi.fn() };
});

const { existsSync } = await import("node:fs");
const { accountHome, defaultCodexHome, sharedSessionIndexPath } = await import("../../src/account/paths.js");
const { codexBinary, runCodex, runPlainCodex } = await import("../../src/codex/launcher.js");

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-launcher-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("codexBinary", () => {
  it("uses CXS_CODEX_BIN when set", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.stubEnv("CXS_CODEX_BIN", "/custom/codex");

    expect(codexBinary()).toBe("/custom/codex");

  });

  it("falls back to the macOS Codex app binary when present", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.stubEnv("CXS_CODEX_BIN", "");

    expect(codexBinary()).toBe("/Applications/Codex.app/Contents/Resources/codex");

  });

  it("uses PATH lookup when no explicit or app binary is available", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.stubEnv("CXS_CODEX_BIN", "");

    expect(codexBinary()).toBe("codex");

  });
});

describe("Codex launch session repair", () => {
  it("repairs an isolated account session index when Codex replaces the symlink", async () => {
    const fakeCodex = await fakeCodexReplacingIndex();
    vi.stubEnv("CXS_CODEX_BIN", fakeCodex);
    const workHome = accountHome("work");

    const code = await runCodex(workHome, []);

    expect(code).toBe(0);
    expect((await lstat(path.join(workHome, "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(workHome, "session_index.jsonl")), await readlink(path.join(workHome, "session_index.jsonl")))).toBe(sharedSessionIndexPath());
    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toContain("\"thread_name\":\"replaced\"");
  });

  it("repairs the default Codex session index when plain Codex replaces the symlink", async () => {
    const fakeCodex = await fakeCodexReplacingIndex();
    vi.stubEnv("CXS_CODEX_BIN", fakeCodex);

    const code = await runPlainCodex([]);

    expect(code).toBe(0);
    expect((await lstat(path.join(defaultCodexHome(), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(defaultCodexHome(), "session_index.jsonl")), await readlink(path.join(defaultCodexHome(), "session_index.jsonl")))).toBe(sharedSessionIndexPath());
    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toContain("\"thread_name\":\"replaced\"");
  });
});

async function fakeCodexReplacingIndex(): Promise<string> {
  const bin = path.join(home, "fake-codex.sh");
  await mkdir(path.dirname(bin), { recursive: true });
  await writeFile(bin, [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "target=\"${CODEX_HOME:-$HOME/.codex}\"",
    "mkdir -p \"$target\"",
    "rm -f \"$target/session_index.jsonl\"",
    "printf '%s\\n' '{\"id\":\"replacement\",\"thread_name\":\"replaced\",\"updated_at\":\"2026-06-22T02:00:00Z\"}' > \"$target/session_index.jsonl\"",
    "",
  ].join("\n"));
  await chmod(bin, 0o755);
  return bin;
}
