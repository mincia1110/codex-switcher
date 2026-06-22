import { access, chmod, lstat, mkdir, mkdtemp, readFile, readlink, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../../src/account/config.js";
import { accountAuthJsonPath, accountHome, defaultCodexAppServerControlSocketPath, defaultCodexAuthJsonPath, defaultCodexConfigTomlPath, defaultCodexHome, sharedSessionIndexPath } from "../../src/account/paths.js";
import { syncCommand } from "../../src/commands/sync.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-sync-command-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
  vi.restoreAllMocks();
});

describe("syncCommand", () => {
  it("syncs a named account to the default Codex home and makes it default", async () => {
    await seedAccount("personal", '{"tokens":{"access_token":"SECRET"}}\n');
    await mkdir(path.join(home, ".codex"), { recursive: true });
    await writeFile(defaultCodexConfigTomlPath(), 'model = "gpt-5"\ncli_auth_credentials_store = "keyring"\n');
    await chmod(accountAuthJsonPath("personal"), 0o644);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await syncCommand("personal");

    expect(await readFile(defaultCodexAuthJsonPath(), "utf8")).toBe('{"tokens":{"access_token":"SECRET"}}\n');
    expect(await readFile(defaultCodexConfigTomlPath(), "utf8")).toBe('model = "gpt-5"\ncli_auth_credentials_store = "file"\n');
    expect((await stat(defaultCodexAuthJsonPath())).mode & 0o777).toBe(0o600);
    expect((await stat(accountAuthJsonPath("personal"))).mode & 0o777).toBe(0o600);
    expect(await readFile(path.join(home, ".cxs", "config.json"), "utf8")).toContain('"defaultAccount": "personal"');
    expect(log.mock.calls.flat().join("\n")).not.toContain("SECRET");
  });

  it("uses the default account when no account argument is provided", async () => {
    await seedAccount("work", "{}\n");
    await writeConfig({
      version: 1,
      defaultAccount: "work",
      accounts: { work: { name: "work", home: accountHome("work"), createdAt: "2026-06-04T00:00:00.000Z" } },
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await syncCommand(undefined);

    expect(await readFile(defaultCodexAuthJsonPath(), "utf8")).toBe("{}\n");
  });

  it("fails clearly for an unknown account", async () => {
    await expect(syncCommand("missing")).rejects.toThrow("Unknown account: missing");
  });

  it("asks the user to login when auth.json is missing", async () => {
    await mkdir(accountHome("personal"), { recursive: true });
    await writeConfig({
      version: 1,
      defaultAccount: "personal",
      accounts: { personal: { name: "personal", home: accountHome("personal"), createdAt: "2026-06-04T00:00:00.000Z" } },
    });

    await expect(syncCommand("personal")).rejects.toThrow("Run `cxs login personal` first");
  });

  it("prints dry-run details without modifying files or leaking secrets", async () => {
    await seedAccount("personal", '{"tokens":{"access_token":"SECRET"}}\n');
    await writeConfig({
      version: 1,
      defaultAccount: "other",
      accounts: {
        personal: { name: "personal", home: accountHome("personal"), createdAt: "2026-06-04T00:00:00.000Z" },
        other: { name: "other", home: accountHome("other"), createdAt: "2026-06-04T00:00:00.000Z" },
      },
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await syncCommand("personal", { dryRun: true });

    await expect(access(defaultCodexAuthJsonPath())).rejects.toMatchObject({ code: "ENOENT" });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Dry run");
    expect(output).toContain("Selected account: personal");
    expect(output).toContain(defaultCodexAuthJsonPath());
    expect(output).toContain(defaultCodexConfigTomlPath());
    expect(output).toContain(defaultCodexAppServerControlSocketPath());
    expect(output).toContain("will set to personal");
    expect(output).not.toContain("SECRET");
    expect(await readFile(path.join(home, ".cxs", "config.json"), "utf8")).toContain('"defaultAccount": "other"');
  });

  it("repairs session indexes across cxs accounts and the default Codex home before relaunch use", async () => {
    await seedAccount("personal", '{"tokens":{"access_token":"SECRET"}}\n');
    await mkdir(accountHome("other"), { recursive: true });
    await writeFile(accountAuthJsonPath("other"), "{}\n", { mode: 0o600 });
    await writeConfig({
      version: 1,
      defaultAccount: "other",
      accounts: {
        personal: { name: "personal", home: accountHome("personal"), createdAt: "2026-06-04T00:00:00.000Z" },
        other: { name: "other", home: accountHome("other"), createdAt: "2026-06-04T00:00:00.000Z" },
      },
    });
    await mkdir(defaultCodexHome(), { recursive: true });
    await writeFile(path.join(accountHome("personal"), "session_index.jsonl"), "{\"id\":\"personal\",\"thread_name\":\"Personal\",\"updated_at\":\"2026-06-22T02:00:00Z\"}\n");
    await symlink(sharedSessionIndexPath(), path.join(accountHome("other"), "session_index.jsonl"), "file");
    await writeFile(path.join(defaultCodexHome(), "session_index.jsonl"), "{\"id\":\"default\",\"thread_name\":\"Default\",\"updated_at\":\"2026-06-22T03:00:00Z\"}\n");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await syncCommand("personal");

    const sharedIndex = await readFile(sharedSessionIndexPath(), "utf8");
    expect(sharedIndex).toContain("\"id\":\"personal\"");
    expect(sharedIndex).toContain("\"id\":\"default\"");
    expect((await lstat(path.join(accountHome("personal"), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect((await lstat(path.join(accountHome("other"), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect((await lstat(path.join(defaultCodexHome(), "session_index.jsonl"))).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(path.join(defaultCodexHome(), "session_index.jsonl")), await readlink(path.join(defaultCodexHome(), "session_index.jsonl")))).toBe(sharedSessionIndexPath());
  });
});

async function seedAccount(name: string, authJson: string): Promise<void> {
  await mkdir(accountHome(name), { recursive: true });
  await writeFile(accountAuthJsonPath(name), authJson, { mode: 0o600 });
  await writeConfig({
    version: 1,
    defaultAccount: name,
    accounts: { [name]: { name, home: accountHome(name), createdAt: "2026-06-04T00:00:00.000Z" } },
  });
}
