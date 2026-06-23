import { describe, expect, it } from "vitest";
import { completionScript } from "../../src/commands/completion.js";

describe("completionScript", () => {
  it("generates a bash completion script with cxs commands", () => {
    const script = completionScript("bash");
    expect(script).toContain("_cxs_completions");
    expect(script).toContain("complete -F _cxs_completions cxs");
    expect(script).toContain("login list use run sync switch usage repair-sessions reset-credits doctor export completion");
  });

  it("generates a zsh completion script with cxs commands", () => {
    const script = completionScript("zsh");
    expect(script).toContain("#compdef cxs");
    expect(script).toContain("_arguments");
    expect(script).toContain("login:Create/login a Codex account");
    expect(script).toContain("sync:Sync account auth to default Codex home");
    expect(script).toContain("repair-sessions:Repair shared Codex session links");
    expect(script).toContain("reset-credits:Show safe Codex reset credit summary");
    expect(script).toContain("completion:Print shell completion script");
  });

  it("rejects unsupported shells", () => {
    expect(() => completionScript("fish" as never)).toThrow(/Unsupported shell/);
  });
});
