import { describe, expect, it } from "vitest";
import { buildCodexEnv, buildPlainCodexEnv } from "../../src/codex/env.js";

describe("buildCodexEnv", () => {
  it("preserves existing environment and overrides CODEX_HOME", () => {
    const env = buildCodexEnv({ PATH: "/bin", CODEX_HOME: "/old" }, "/new/home");
    expect(env.PATH).toBe("/bin");
    expect(env.CODEX_HOME).toBe("/new/home");
  });
});

describe("buildPlainCodexEnv", () => {
  it("removes CODEX_HOME without mutating the source environment", () => {
    const source = { PATH: "/bin", CODEX_HOME: "/old" };
    const env = buildPlainCodexEnv(source);
    expect(env).toEqual({ PATH: "/bin" });
    expect(source).toEqual({ PATH: "/bin", CODEX_HOME: "/old" });
  });
});
