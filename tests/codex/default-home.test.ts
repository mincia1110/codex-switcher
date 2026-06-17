import { mkdir, mkdtemp, lstat, readFile, readlink, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCodexAppServerControlSocketPath, defaultCodexAuthJsonPath, defaultCodexConfigTomlPath, defaultCodexHome, sharedHistoryPath, sharedSessionsPath } from "../../src/account/paths.js";
import { ensureFileCredentialStore, syncDefaultCodexAuth, syncDefaultCodexAuthBestEffort } from "../../src/codex/default-home.js";

const originalHome = process.env.HOME;
const originalCodexHome = process.env.CODEX_HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-default-codex-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = originalCodexHome;
  vi.restoreAllMocks();
});

describe("ensureFileCredentialStore", () => {
  it("adds the file credential store setting to empty config", () => {
    expect(ensureFileCredentialStore("")).toBe('cli_auth_credentials_store = "file"\n');
  });

  it("replaces an existing credential store setting and preserves other config", () => {
    expect(ensureFileCredentialStore('model = "gpt-5"\ncli_auth_credentials_store = "keyring"\n')).toBe('model = "gpt-5"\ncli_auth_credentials_store = "file"\n');
  });

  it("keeps the credential store setting at top-level before TOML tables", () => {
    expect(ensureFileCredentialStore('model = "gpt-5"\n[mcp_servers.codegraph]\ncommand = "codegraph"\ncli_auth_credentials_store = "file"\n')).toBe(
      'model = "gpt-5"\ncli_auth_credentials_store = "file"\n\n[mcp_servers.codegraph]\ncommand = "codegraph"\n',
    );
  });

  it("does not accumulate blank lines when run repeatedly", () => {
    const once = ensureFileCredentialStore('model = "gpt-5"\n\n\ncli_auth_credentials_store = "file"\n\n[projects.foo]\ntrust_level = "trusted"\n');
    expect(ensureFileCredentialStore(once)).toBe('model = "gpt-5"\ncli_auth_credentials_store = "file"\n\n[projects.foo]\ntrust_level = "trusted"\n');
  });
});

describe("syncDefaultCodexAuth", () => {
  it("copies account auth.json to the default Codex home and forces file auth", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await writeFile(path.join(accountHome, "auth.json"), '{"tokens":{"access_token":"secret"}}\n', { mode: 0o600 });
    await mkdir(path.join(home, ".codex"), { recursive: true });
    await writeFile(defaultCodexConfigTomlPath(), 'model = "gpt-5"\ncli_auth_credentials_store = "keyring"\n');

    await syncDefaultCodexAuth(accountHome);

    await expect(readFile(defaultCodexAuthJsonPath(), "utf8")).resolves.toBe('{"tokens":{"access_token":"secret"}}\n');
    await expect(readFile(defaultCodexConfigTomlPath(), "utf8")).resolves.toBe('model = "gpt-5"\ncli_auth_credentials_store = "file"\n');
    expect((await stat(defaultCodexAuthJsonPath())).mode & 0o777).toBe(0o600);
    expect((await stat(defaultCodexConfigTomlPath())).mode & 0o777).toBe(0o600);
  });

  it("removes stale default app-server control socket so plain codex does not reuse another account", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await writeFile(path.join(accountHome, "auth.json"), "{}\n", { mode: 0o600 });
    await mkdir(path.dirname(defaultCodexAppServerControlSocketPath()), { recursive: true });
    await writeFile(defaultCodexAppServerControlSocketPath(), "");

    await syncDefaultCodexAuth(accountHome);

    await expect(lstat(defaultCodexAppServerControlSocketPath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("shares default Codex home sessions with cxs account sessions", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    const defaultSession = path.join(defaultCodexHome(), "sessions", "2026", "06", "10", "plain.jsonl");
    await mkdir(accountHome, { recursive: true });
    await mkdir(path.dirname(defaultSession), { recursive: true });
    await writeFile(path.join(accountHome, "auth.json"), "{}\n", { mode: 0o600 });
    await writeFile(defaultSession, "{}\n");

    await syncDefaultCodexAuth(accountHome);

    const defaultSessions = path.join(defaultCodexHome(), "sessions");
    expect((await lstat(defaultSessions)).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(defaultSessions), await readlink(defaultSessions))).toBe(sharedSessionsPath());
    await expect(readFile(path.join(sharedSessionsPath(), "2026", "06", "10", "plain.jsonl"), "utf8")).resolves.toBe("{}\n");
  });

  it("shares default Codex home history with cxs account history", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await mkdir(defaultCodexHome(), { recursive: true });
    await writeFile(path.join(accountHome, "auth.json"), "{}\n", { mode: 0o600 });
    await writeFile(path.join(defaultCodexHome(), "history.jsonl"), "{\"session_id\":\"plain\"}\n");

    await syncDefaultCodexAuth(accountHome);

    const defaultHistory = path.join(defaultCodexHome(), "history.jsonl");
    expect((await lstat(defaultHistory)).isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(defaultHistory), await readlink(defaultHistory))).toBe(sharedHistoryPath());
    await expect(readFile(sharedHistoryPath(), "utf8")).resolves.toBe("{\"session_id\":\"plain\"}\n");
  });

  it("reports sync failures as warnings in best-effort mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await syncDefaultCodexAuthBestEffort(path.join(home, "missing-account"));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("could not sync"));
  });

  it("warns when CODEX_HOME would make plain codex ignore the default home", async () => {
    const accountHome = path.join(home, ".cxs", "accounts", "work");
    await mkdir(accountHome, { recursive: true });
    await writeFile(path.join(accountHome, "auth.json"), "{}\n", { mode: 0o600 });
    process.env.CODEX_HOME = path.join(home, ".cxs", "accounts", "other");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await syncDefaultCodexAuthBestEffort(accountHome);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unset CODEX_HOME"));
  });
});
