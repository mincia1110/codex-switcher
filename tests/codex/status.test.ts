import { describe, expect, it } from "vitest";
import { parseStatusText } from "../../src/codex/status.js";
import { stripAnsi } from "../../src/codex/ansi.js";

describe("Codex status parsing", () => {
  it("removes ANSI escape sequences", () => {
    expect(stripAnsi("\u001b[31m5h limit\u001b[0m\r\n")).toBe("5h limit\n");
  });

  it("parses 5h and weekly limits from /status text", () => {
    const parsed = parseStatusText(`Account: person@example.com
Model: gpt-5.5
5h limit: [████░] 82% left (resets 14:31)
Weekly limit: [██░░] 64% left (resets tomorrow 01:12)
`);
    expect(parsed.account).toBe("person@example.com");
    expect(parsed.fiveHourLeft).toBe(82);
    expect(parsed.fiveHourReset).toBe("14:31");
    expect(parsed.weeklyLeft).toBe(64);
    expect(parsed.weeklyReset).toBe("tomorrow 01:12");
  });
});
