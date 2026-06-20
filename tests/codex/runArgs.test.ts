import { describe, expect, it } from "vitest";
import { parseRunInvocation } from "../../src/commands/run.js";

describe("parseRunInvocation", () => {
  it("extracts named account and codex args after --", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "work", "--", "exec", "hello world"])).toEqual({ name: "work", args: ["exec", "hello world"], isolated: false });
  });

  it("supports default account with codex args after --", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "--", "exec", "hello"])).toEqual({ name: undefined, args: ["exec", "hello"], isolated: false });
  });

  it("supports named account with no codex args", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "personal"])).toEqual({ name: "personal", args: [], isolated: false });
  });

  it("parses isolated mode before codex args", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "--isolated", "personal", "--", "exec", "hello"])).toEqual({ name: "personal", args: ["exec", "hello"], isolated: true });
  });

  it("passes --isolated through to codex after --", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "personal", "--", "--isolated"])).toEqual({ name: "personal", args: ["--isolated"], isolated: false });
  });
});
