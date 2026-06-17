import { describe, expect, it } from "vitest";
import { buildCodexEnv } from "../../src/codex/env.js";

describe("buildCodexEnv", () => {
  it("preserves existing environment and overrides CODEX_HOME", () => {
    const env = buildCodexEnv({ PATH: "/bin", CODEX_HOME: "/old" }, "/new/home");
    expect(env.PATH).toBe("/bin");
    expect(env.CODEX_HOME).toBe("/new/home");
  });
});
