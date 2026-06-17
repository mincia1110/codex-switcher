import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: vi.fn() };
});

const { existsSync } = await import("node:fs");
const { codexBinary } = await import("../../src/codex/launcher.js");

describe("codexBinary", () => {
  it("uses CXS_CODEX_BIN when set", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.stubEnv("CXS_CODEX_BIN", "/custom/codex");

    expect(codexBinary()).toBe("/custom/codex");

    vi.unstubAllEnvs();
  });

  it("falls back to the macOS Codex app binary when present", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.stubEnv("CXS_CODEX_BIN", "");

    expect(codexBinary()).toBe("/Applications/Codex.app/Contents/Resources/codex");

    vi.unstubAllEnvs();
  });

  it("uses PATH lookup when no explicit or app binary is available", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.stubEnv("CXS_CODEX_BIN", "");

    expect(codexBinary()).toBe("codex");

    vi.unstubAllEnvs();
  });
});
