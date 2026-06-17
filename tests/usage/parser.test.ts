import { describe, expect, it } from "vitest";
import { parseUsageLine } from "../../src/usage/parser.js";

const now = new Date("2026-06-04T10:00:00.000Z");

describe("parseUsageLine", () => {
  it("parses primary and secondary rate limits", () => {
    const snapshot = parseUsageLine("work", JSON.stringify({ rate_limits: { primary: { used_percent: 18, resets_in_seconds: 3600 }, secondary: { used_percent: 36, resets_in_seconds: 7200 } } }), now);
    expect(snapshot?.usageSource).toBe("local-log");
    expect(snapshot?.fiveHour?.remainingPercent).toBe(82);
    expect(snapshot?.fiveHour?.resetAt).toBe("2026-06-04T11:00:00.000Z");
    expect(snapshot?.weekly?.remainingPercent).toBe(64);
  });

  it("parses primary-only usage", () => {
    const snapshot = parseUsageLine("personal", JSON.stringify({ rateLimits: { primary: { usedPercent: 79 } } }), now);
    expect(snapshot?.fiveHour?.remainingPercent).toBe(21);
    expect(snapshot?.weekly).toBeNull();
  });

  it("ignores unknown schema and invalid json", () => {
    expect(parseUsageLine("x", JSON.stringify({ hello: "world" }), now)).toBeUndefined();
    expect(parseUsageLine("x", "not json", now)).toBeUndefined();
  });

  it("clamps used_percent outside 0-100", () => {
    const snapshot = parseUsageLine("x", JSON.stringify({ rate_limits: { primary: { used_percent: -5 }, secondary: { used_percent: 120 } } }), now);
    expect(snapshot?.fiveHour?.remainingPercent).toBe(100);
    expect(snapshot?.weekly?.remainingPercent).toBe(0);
  });

  it("does not treat token-only response.completed logs as quota usage", () => {
    const line = 'websocket event: {"type":"response.completed","response":{"id":"resp_123","usage":{"input_tokens":1200,"output_tokens":34,"total_tokens":1234}}}';
    expect(parseUsageLine("work", line, now)).toBeUndefined();
  });
});
