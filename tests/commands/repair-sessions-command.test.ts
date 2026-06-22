import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../../src/account/config.js";
import { accountHome, defaultCodexHome, sharedSessionIndexPath } from "../../src/account/paths.js";
import { repairSessionsCommand } from "../../src/commands/repair-sessions.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-repair-sessions-command-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
  vi.restoreAllMocks();
});

describe("repairSessionsCommand", () => {
  it("repairs account and default Codex session indexes without switching accounts", async () => {
    await mkdir(accountHome("work"), { recursive: true });
    await mkdir(defaultCodexHome(), { recursive: true });
    await writeConfig({
      version: 1,
      defaultAccount: "work",
      accounts: { work: { name: "work", home: accountHome("work"), createdAt: "2026-06-04T00:00:00.000Z" } },
    });
    await writeFile(path.join(accountHome("work"), "session_index.jsonl"), "{\"id\":\"work\",\"thread_name\":\"Work\",\"updated_at\":\"2026-06-22T01:00:00Z\"}\n");
    await writeFile(path.join(defaultCodexHome(), "session_index.jsonl"), "{\"id\":\"default\",\"thread_name\":\"Default\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await repairSessionsCommand();

    const sharedIndex = await readFile(sharedSessionIndexPath(), "utf8");
    expect(sharedIndex).toContain("\"id\":\"work\"");
    expect(sharedIndex).toContain("\"id\":\"default\"");
    expect((await lstat(path.join(accountHome("work"), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect((await lstat(path.join(defaultCodexHome(), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect(log.mock.calls.flat().join("\n")).toContain("Repaired shared Codex session state");
  });
});
