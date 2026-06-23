import { lstat, mkdir, mkdtemp, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sharedHistoryPath, sharedSessionIndexPath, sharedSessionsPath } from "../../src/account/paths.js";
import { ensureSharedHistory, ensureSharedSessionIndex, ensureSharedSessions } from "../../src/codex/shared-sessions.js";

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

describe("ensureSharedSessionIndex", () => {
  it("links a missing account session index file to the shared session index", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");

    await ensureSharedSessionIndex(accountHome);

    expect((await lstat(path.join(accountHome, "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(accountHome, "session_index.jsonl")), await readlink(path.join(accountHome, "session_index.jsonl")))).toBe(sharedSessionIndexPath());
    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toBe("");
  });

  it("merges existing session index entries by id before replacing the file with a shared link", async () => {
    const firstAccountHome = path.join(home, ".cxs", "accounts", "work");
    const secondAccountHome = path.join(home, ".cxs", "accounts", "personal");
    await mkdir(firstAccountHome, { recursive: true });
    await mkdir(secondAccountHome, { recursive: true });
    await writeFile(path.join(firstAccountHome, "session_index.jsonl"), "{\"id\":\"one\",\"thread_name\":\"One\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n{\"id\":\"shared\",\"thread_name\":\"Shared\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n");
    await writeFile(path.join(secondAccountHome, "session_index.jsonl"), "{\"id\":\"shared\",\"thread_name\":\"Shared latest\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n{\"id\":\"two\",\"thread_name\":\"Two\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n");

    await ensureSharedSessionIndex(firstAccountHome);
    await ensureSharedSessionIndex(secondAccountHome);

    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toBe(
      "{\"id\":\"one\",\"thread_name\":\"One\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n{\"id\":\"shared\",\"thread_name\":\"Shared\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n{\"id\":\"shared\",\"thread_name\":\"Shared latest\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n{\"id\":\"two\",\"thread_name\":\"Two\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n",
    );
  });

  it("does not append an older same-id session index entry after a newer shared entry", async () => {
    const firstAccountHome = path.join(home, ".cxs", "accounts", "work");
    const secondAccountHome = path.join(home, ".cxs", "accounts", "personal");
    await mkdir(firstAccountHome, { recursive: true });
    await mkdir(secondAccountHome, { recursive: true });
    await writeFile(path.join(firstAccountHome, "session_index.jsonl"), "{\"id\":\"shared\",\"thread_name\":\"New\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n");
    await writeFile(path.join(secondAccountHome, "session_index.jsonl"), "{\"id\":\"shared\",\"thread_name\":\"Old\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n");

    await ensureSharedSessionIndex(firstAccountHome);
    await ensureSharedSessionIndex(secondAccountHome);

    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toBe("{\"id\":\"shared\",\"thread_name\":\"New\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n");
  });

  it("creates the shared session index when an account already links to it", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await symlink(sharedSessionIndexPath(), path.join(accountHome, "session_index.jsonl"), "file");

    await ensureSharedSessionIndex(accountHome);

    await expect(readFile(sharedSessionIndexPath(), "utf8")).resolves.toBe("");
  });
});

describe("already-linked shared history", () => {
  it("creates the shared history file when an account already links to it", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await symlink(sharedHistoryPath(), path.join(accountHome, "history.jsonl"), "file");

    await ensureSharedHistory(accountHome);

    await expect(readFile(sharedHistoryPath(), "utf8")).resolves.toBe("");
  });
});

describe("wrong sessions symlinks", () => {
  it("copies sessions from a non-shared sessions symlink before relinking", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    const oldTarget = path.join(home, "old-sessions");
    const oldSession = path.join(oldTarget, "2026", "06", "22", "rollout.jsonl");
    await mkdir(path.dirname(oldSession), { recursive: true });
    await writeFile(oldSession, "old\n");
    await mkdir(accountHome, { recursive: true });
    await symlink(oldTarget, path.join(accountHome, "sessions"), "dir");

    await ensureSharedSessions(accountHome);

    await expect(readFile(path.join(sharedSessionsPath(), "2026", "06", "22", "rollout.jsonl"), "utf8")).resolves.toBe("old\n");
    expect(path.resolve(accountHome, await readlink(path.join(accountHome, "sessions")))).toBe(sharedSessionsPath());
  });
});
