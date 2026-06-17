import { readFile } from "node:fs/promises";
import { z } from "zod";
import { configPath } from "./paths.js";
import type { AccountRecord, CxsConfig } from "./types.js";
import { atomicWriteFile, safeJsonStringify } from "../utils/fs.js";

const accountSchema = z.object({
  name: z.string(),
  home: z.string(),
  email: z.string().optional(),
  createdAt: z.string(),
  lastUsedAt: z.string().optional(),
});

const configSchema = z.object({
  version: z.literal(1),
  defaultAccount: z.string().optional(),
  accounts: z.record(accountSchema),
});

export function parseConfig(raw: unknown): CxsConfig {
  return configSchema.parse(raw);
}

export async function readConfig(): Promise<CxsConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return parseConfig(JSON.parse(raw));
  } catch (error: any) {
    if (error?.code === "ENOENT") return { version: 1, accounts: {} };
    throw error;
  }
}

export function assertNoSecrets(value: unknown): void {
  const raw = JSON.stringify(value).toLowerCase();
  for (const key of ["access_token", "refresh_token", "id_token", "token"]) {
    if (raw.includes(key)) throw new Error(`Refusing to write secret-shaped key to cxs config/cache: ${key}`);
  }
}

export async function writeConfig(config: CxsConfig): Promise<void> {
  const parsed = parseConfig(config);
  assertNoSecrets(parsed);
  await atomicWriteFile(configPath(), safeJsonStringify(parsed), 0o600);
}

export async function upsertAccount(account: AccountRecord): Promise<CxsConfig> {
  const config = await readConfig();
  const next: CxsConfig = {
    version: 1,
    defaultAccount: config.defaultAccount ?? account.name,
    accounts: { ...config.accounts, [account.name]: account },
  };
  await writeConfig(next);
  return next;
}

export async function setDefaultAccount(name: string): Promise<CxsConfig> {
  const config = await readConfig();
  if (!config.accounts[name]) throw new Error(`Unknown account: ${name}`);
  const next = { ...config, defaultAccount: name };
  await writeConfig(next);
  return next;
}

export async function touchLastUsed(name: string, when = new Date()): Promise<void> {
  const config = await readConfig();
  const account = config.accounts[name];
  if (!account) throw new Error(`Unknown account: ${name}`);
  await writeConfig({ ...config, accounts: { ...config.accounts, [name]: { ...account, lastUsedAt: when.toISOString() } } });
}
