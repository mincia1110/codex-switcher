import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  touchLastUsed: vi.fn(),
  runCodex: vi.fn(),
  ensureAllSharedSessions: vi.fn(),
  syncDefaultCodexAuthBestEffort: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, access: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("../../src/account/config.js", () => ({
  readConfig: mocks.readConfig,
  touchLastUsed: mocks.touchLastUsed,
}));

vi.mock("../../src/codex/launcher.js", () => ({
  runCodex: mocks.runCodex,
}));

vi.mock("../../src/codex/default-home.js", () => ({
  syncDefaultCodexAuthBestEffort: mocks.syncDefaultCodexAuthBestEffort,
}));

vi.mock("../../src/codex/shared-sessions.js", () => ({
  ensureAllSharedSessions: mocks.ensureAllSharedSessions,
}));

const { runCommand } = await import("../../src/commands/run.js");

describe("runCommand", () => {
  it("syncs the selected account to the default Codex home after codex exits", async () => {
    const account = { name: "work", home: "/tmp/work", createdAt: "2026-06-04T00:00:00.000Z" };
    mocks.readConfig.mockResolvedValue({ version: 1, defaultAccount: "work", accounts: { work: account } });
    mocks.runCodex.mockResolvedValue(0);

    await runCommand("work", []);

    expect(mocks.ensureAllSharedSessions).toHaveBeenCalledWith([account]);
    expect(mocks.runCodex).toHaveBeenCalledWith("/tmp/work", []);
    expect(mocks.syncDefaultCodexAuthBestEffort).toHaveBeenCalledWith("/tmp/work");
  });
});
