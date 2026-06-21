import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../../src/account/config.js";
import { accountAuthJsonPath, accountHome, defaultCodexAuthJsonPath, defaultCodexHome } from "../../src/account/paths.js";
import { resetCreditsCommand } from "../../src/commands/reset-credits.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-reset-credits-command-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resetCreditsCommand", () => {
  it("checks the default cxs account without printing secrets", async () => {
    await seedAccount("work", "SECRET", "acct_123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: 1, total_earned: 2 }), { status: 200 })));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await resetCreditsCommand(undefined);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Available reset credits: 1");
    expect(output).toContain("Total earned count: 2");
    expect(output).not.toContain("SECRET");
    expect(output).not.toContain("acct_123");
  });

  it("can check the current plain Codex auth", async () => {
    await mkdir(defaultCodexHome(), { recursive: true });
    await writeFile(defaultCodexAuthJsonPath(), JSON.stringify({ tokens: { access_token: "CURRENT_SECRET", account_id: "current_acct" } }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available_count: 0, items: [] }), { status: 200 })));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await resetCreditsCommand(undefined, { current: true });

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Available reset credits: 0");
    expect(output).toContain("No reset credit expiries found.");
    expect(output).not.toContain("CURRENT_SECRET");
    expect(output).not.toContain("current_acct");
  });
});

async function seedAccount(name: string, accessToken: string, accountId: string): Promise<void> {
  await mkdir(accountHome(name), { recursive: true });
  await writeFile(accountAuthJsonPath(name), JSON.stringify({ tokens: { access_token: accessToken, account_id: accountId } }), { mode: 0o600 });
  await writeConfig({
    version: 1,
    defaultAccount: name,
    accounts: { [name]: { name, home: accountHome(name), createdAt: "2026-06-04T00:00:00.000Z" } },
  });
}
