import { chmod, mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { accountHome, usageCachePath } from "../../src/account/paths.js";
import { upsertAccount } from "../../src/account/config.js";
import { writeUsageCache } from "../../src/usage/cache.js";
import { createRedactedDiagnosticsBundle } from "../../src/diagnostics/export.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-export-home-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
});

describe("createRedactedDiagnosticsBundle", () => {
  it("exports setup metadata without secrets or raw emails", async () => {
    const acctHome = accountHome("work");
    await mkdir(path.join(acctHome, "sessions"), { recursive: true });
    await mkdir(path.join(acctHome, "logs"), { recursive: true });
    await writeFile(path.join(acctHome, "config.toml"), 'cli_auth_credentials_store = "file"\n');
    await writeFile(path.join(acctHome, "auth.json"), JSON.stringify({ access_token: "SECRET", user: { email: "sijun@example.com" } }));
    await chmod(path.join(acctHome, "auth.json"), 0o600);
    await upsertAccount({ name: "work", home: acctHome, email: "sijun@example.com", createdAt: "2026-06-04T00:00:00.000Z" });
    await writeUsageCache({ work: { account: "work", source: "local-log", confidence: "high", fiveHour: { usedPercent: 10, remainingPercent: 90 }, fetchedAt: "2026-06-04T00:00:00.000Z" } });

    const bundle = await createRedactedDiagnosticsBundle();
    const raw = JSON.stringify(bundle);

    expect(bundle.accounts[0]).toMatchObject({ name: "work", email: "sij***@example.com", authJson: { exists: true, mode: "600" } });
    expect(bundle.paths.cxsRoot).toBe(path.join(home, ".cxs"));
    expect(bundle.usageCache.path).toBe(usageCachePath());
    expect(raw).not.toContain("SECRET");
    expect(raw).not.toContain("sijun@example.com");
    expect(raw).not.toMatch(/access_token|refresh_token|id_token/i);
  });
});
