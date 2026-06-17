import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig, upsertAccount, writeConfig } from "../../src/account/config.js";
import { accountHome, configPath } from "../../src/account/paths.js";

const originalHome = process.env.HOME;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "cxs-home-"));
  process.env.HOME = home;
});

afterEach(() => {
  process.env.HOME = originalHome;
});

describe("config storage", () => {
  it("returns an empty v1 config when config.json does not exist", async () => {
    await expect(readConfig()).resolves.toEqual({ version: 1, accounts: {} });
  });

  it("writes config atomically and reads it back", async () => {
    const cfg = { version: 1 as const, defaultAccount: "work", accounts: { work: { name: "work", home: accountHome("work"), createdAt: "2026-06-04T00:00:00.000Z" } } };
    await writeConfig(cfg);
    await expect(readConfig()).resolves.toEqual(cfg);
    await expect(readFile(configPath(), "utf8")).resolves.toContain('"defaultAccount": "work"');
  });

  it("upserts accounts without storing secret-shaped auth fields", async () => {
    await upsertAccount({ name: "personal", home: accountHome("personal"), createdAt: "2026-06-04T00:00:00.000Z", email: "person@example.com" });
    const raw = await readFile(configPath(), "utf8");
    expect(raw).not.toMatch(/access_token|refresh_token|id_token/i);
    expect((await readConfig()).defaultAccount).toBe("personal");
  });
});
