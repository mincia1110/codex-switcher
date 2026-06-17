import { describe, expect, it } from "vitest";
import { parseRunInvocation } from "../../src/commands/run.js";

describe("parseRunInvocation", () => {
  it("extracts named account and codex args after --", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "work", "--", "exec", "hello world"])).toEqual({ name: "work", args: ["exec", "hello world"] });
  });

  it("supports default account with codex args after --", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "--", "exec", "hello"])).toEqual({ name: undefined, args: ["exec", "hello"] });
  });

  it("supports named account with no codex args", () => {
    expect(parseRunInvocation(["node", "dist/main.js", "run", "personal"])).toEqual({ name: "personal", args: [] });
  });
});
