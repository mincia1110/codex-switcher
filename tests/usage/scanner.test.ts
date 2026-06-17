import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { scanAccountUsage } from "../../src/usage/scanner.js";

describe("scanAccountUsage", () => {
  it("scans sessions and logs jsonl files and returns the newest parseable rate-limit snapshot", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-account-"));
    await mkdir(path.join(home, "sessions", "2026"), { recursive: true });
    await mkdir(path.join(home, "logs"), { recursive: true });
    await writeFile(path.join(home, "sessions", "2026", "a.jsonl"), '{"rate_limits":{"primary":{"used_percent":90}}}\ninvalid\n');
    await writeFile(path.join(home, "logs", "b.jsonl"), '{"rate_limits":{"primary":{"used_percent":10},"secondary":{"used_percent":20}}}\n');

    const snapshot = await scanAccountUsage("work", home, new Date("2026-06-04T10:00:00.000Z"));
    expect(snapshot.usageSource).toBe("local-log");
    expect(snapshot.fiveHour?.remainingPercent).toBe(90);
    expect(snapshot.weekly?.remainingPercent).toBe(80);
  });

  it("returns unknown snapshot instead of throwing when no data exists", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-account-empty-"));
    const snapshot = await scanAccountUsage("empty", home);
    expect(snapshot.usageSource).toBe("unknown");
    expect(snapshot.error).toMatch(/No usage data/);
  });

  it("ignores invalid json lines and token-only sqlite-era response.completed text", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "cxs-account-invalid-"));
    await mkdir(path.join(home, "logs"), { recursive: true });
    await writeFile(path.join(home, "logs", "a.jsonl"), 'invalid\nwebsocket event: {"type":"response.completed","response":{"id":"resp_a","usage":{"input_tokens":100}}}\n');
    const snapshot = await scanAccountUsage("work", home);
    expect(snapshot.usageSource).toBe("unknown");
  });
});
