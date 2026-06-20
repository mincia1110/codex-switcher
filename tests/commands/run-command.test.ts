import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  setDefaultAccount: vi.fn(),
  touchLastUsed: vi.fn(),
  runCodex: vi.fn(),
  runPlainCodex: vi.fn(),
  ensureAllSharedSessions: vi.fn(),
  syncDefaultCodexAuth: vi.fn(),
  syncDefaultCodexAuthBestEffort: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    access: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../src/account/config.js", () => ({
  readConfig: mocks.readConfig,
  setDefaultAccount: mocks.setDefaultAccount,
  touchLastUsed: mocks.touchLastUsed,
}));

vi.mock("../../src/codex/launcher.js", () => ({
  runCodex: mocks.runCodex,
  runPlainCodex: mocks.runPlainCodex,
}));

vi.mock("../../src/codex/default-home.js", () => ({
  syncDefaultCodexAuth: mocks.syncDefaultCodexAuth,
  syncDefaultCodexAuthBestEffort: mocks.syncDefaultCodexAuthBestEffort,
}));

vi.mock("../../src/codex/shared-sessions.js", () => ({
  ensureAllSharedSessions: mocks.ensureAllSharedSessions,
}));

const { runCommand } = await import("../../src/commands/run.js");

describe("runCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs the selected account to the default Codex home before running plain codex", async () => {
    const account = { name: "work", home: "/tmp/work", createdAt: "2026-06-04T00:00:00.000Z" };
    mocks.readConfig.mockResolvedValue({ version: 1, defaultAccount: "work", accounts: { work: account } });
    mocks.runPlainCodex.mockResolvedValue(0);

    await runCommand("work", []);

    expect(mocks.ensureAllSharedSessions).toHaveBeenCalledWith([account]);
    expect(mocks.syncDefaultCodexAuth).toHaveBeenCalledWith("/tmp/work", { appServerReset: "warn" });
    expect(mocks.setDefaultAccount).toHaveBeenCalledWith("work");
    expect(mocks.runPlainCodex).toHaveBeenCalledWith([]);
    expect(mocks.runCodex).not.toHaveBeenCalled();
    expect(mocks.syncDefaultCodexAuthBestEffort).not.toHaveBeenCalled();
  });

  it("keeps the previous CODEX_HOME execution path when isolated is requested", async () => {
    const account = { name: "work", home: "/tmp/work", createdAt: "2026-06-04T00:00:00.000Z" };
    mocks.readConfig.mockResolvedValue({ version: 1, defaultAccount: "work", accounts: { work: account } });
    mocks.runCodex.mockResolvedValue(0);

    await runCommand("work", ["exec", "hello"], { isolated: true });

    expect(mocks.runCodex).toHaveBeenCalledWith("/tmp/work", ["exec", "hello"]);
    expect(mocks.syncDefaultCodexAuthBestEffort).toHaveBeenCalledWith("/tmp/work");
    expect(mocks.runPlainCodex).not.toHaveBeenCalled();
    expect(mocks.syncDefaultCodexAuth).not.toHaveBeenCalled();
  });
});
