import { lstat, mkdir, mkdtemp, readFile, readlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sharedHistoryPath, sharedSessionsPath } from "../../src/account/paths.js";
import { ensureSharedHistory, ensureSharedSessions } from "../../src/codex/shared-sessions.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-shared-sessions-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
});

describe("ensureSharedSessions", () => {
  it("links a missing account sessions directory to the shared sessions directory", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");

    await ensureSharedSessions(accountHome);

    expect((await lstat(path.join(accountHome, "sessions"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(accountHome, "sessions")), await readlink(path.join(accountHome, "sessions")))).toBe(sharedSessionsPath());
  });

  it("merges existing account sessions before replacing the directory with a shared link", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    const existingSession = path.join(accountHome, "sessions", "2026", "06", "09", "rollout.jsonl");
    await mkdir(path.dirname(existingSession), { recursive: true });
    await writeFile(existingSession, "{}\n");

    await ensureSharedSessions(accountHome);

    expect((await lstat(path.join(accountHome, "sessions"))).isSymbolicLink()).toBe(true);
    await expect(readFile(path.join(sharedSessionsPath(), "2026", "06", "09", "rollout.jsonl"), "utf8")).resolves.toBe("{}\n");
  });

  it("recursively merges sessions when shared parent directories already exist", async () => {
    const firstAccountHome = path.join(home, ".cxs", "accounts", "work");
    const secondAccountHome = path.join(home, ".cxs", "accounts", "personal");
    await mkdir(path.join(firstAccountHome, "sessions", "2026", "06", "09"), { recursive: true });
    await mkdir(path.join(secondAccountHome, "sessions", "2026", "06", "10"), { recursive: true });
    await writeFile(path.join(firstAccountHome, "sessions", "2026", "06", "09", "first.jsonl"), "first\n");
    await writeFile(path.join(secondAccountHome, "sessions", "2026", "06", "10", "second.jsonl"), "second\n");

    await ensureSharedSessions(firstAccountHome);
    await ensureSharedSessions(secondAccountHome);

    await expect(readFile(path.join(sharedSessionsPath(), "2026", "06", "09", "first.jsonl"), "utf8")).resolves.toBe("first\n");
    await expect(readFile(path.join(sharedSessionsPath(), "2026", "06", "10", "second.jsonl"), "utf8")).resolves.toBe("second\n");
  });

  it("keeps an existing shared sessions link unchanged", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await ensureSharedSessions(accountHome);
    const firstTarget = await readlink(path.join(accountHome, "sessions"));

    await ensureSharedSessions(accountHome);

    expect(await readlink(path.join(accountHome, "sessions"))).toBe(firstTarget);
  });
});

describe("ensureSharedHistory", () => {
  it("links a missing account history file to the shared history file", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");

    await ensureSharedHistory(accountHome);

    expect((await lstat(path.join(accountHome, "history.jsonl"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(accountHome, "history.jsonl")), await readlink(path.join(accountHome, "history.jsonl")))).toBe(sharedHistoryPath());
    await expect(readFile(sharedHistoryPath(), "utf8")).resolves.toBe("");
  });

  it("merges existing account history before replacing the file with a shared link", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await writeFile(path.join(accountHome, "history.jsonl"), "{\"session_id\":\"one\"}\n");

    await ensureSharedHistory(accountHome);

    expect((await lstat(path.join(accountHome, "history.jsonl"))).isSymbolicLink()).toBe(true);
    await expect(readFile(sharedHistoryPath(), "utf8")).resolves.toBe("{\"session_id\":\"one\"}\n");
  });

  it("deduplicates history lines while merging multiple accounts", async () => {
    const firstAccountHome = path.join(home, ".cxs", "accounts", "work");
    const secondAccountHome = path.join(home, ".cxs", "accounts", "personal");
    await mkdir(firstAccountHome, { recursive: true });
    await mkdir(secondAccountHome, { recursive: true });
    await writeFile(path.join(firstAccountHome, "history.jsonl"), "{\"session_id\":\"one\"}\n{\"session_id\":\"shared\"}\n");
    await writeFile(path.join(secondAccountHome, "history.jsonl"), "{\"session_id\":\"shared\"}\n{\"session_id\":\"two\"}\n");

    await ensureSharedHistory(firstAccountHome);
    await ensureSharedHistory(secondAccountHome);

    await expect(readFile(sharedHistoryPath(), "utf8")).resolves.toBe("{\"session_id\":\"one\"}\n{\"session_id\":\"shared\"}\n{\"session_id\":\"two\"}\n");
  });
});
