import { chmod, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { defaultCodexAppServerControlSocketPath, defaultCodexAuthJsonPath, defaultCodexConfigTomlPath, defaultCodexHome } from "../account/paths.js";
import { atomicWriteFile } from "../utils/fs.js";
import { ensureSharedCodexState } from "./shared-sessions.js";

const FILE_CREDENTIAL_STORE = 'cli_auth_credentials_store = "file"';

export function ensureFileCredentialStore(configToml: string): string {
  const lines = configToml.split("\n").filter((line) => !/^[^\S\r\n]*cli_auth_credentials_store[^\S\r\n]*=/.test(line));
  if (lines.at(-1) === "") lines.pop();

  const firstTableIndex = lines.findIndex((line) => /^\s*\[/.test(line));
  if (firstTableIndex >= 0) {
    let tableIndex = firstTableIndex;
    while (tableIndex > 0 && lines[tableIndex - 1] === "") {
      lines.splice(tableIndex - 1, 1);
      tableIndex -= 1;
    }
    lines.splice(tableIndex, 0, FILE_CREDENTIAL_STORE, "");
  } else {
    while (lines.at(-1) === "") lines.pop();
    lines.push(FILE_CREDENTIAL_STORE);
  }
  return `${lines.join("\n")}\n`;
}

export type SyncDefaultCodexAuthOptions = {
  appServerReset?: "strict" | "warn";
};

export async function syncDefaultCodexAuth(accountHome: string, options: SyncDefaultCodexAuthOptions = {}): Promise<void> {
  const authJson = await readFile(path.join(accountHome, "auth.json"), "utf8");
  await ensureSharedCodexState([accountHome]);
  await atomicWriteFile(defaultCodexAuthJsonPath(), authJson, 0o600);
  await chmod(defaultCodexAuthJsonPath(), 0o600);

  let configToml = "";
  try {
    configToml = await readFile(defaultCodexConfigTomlPath(), "utf8");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  await atomicWriteFile(defaultCodexConfigTomlPath(), ensureFileCredentialStore(configToml), 0o600);
  await chmod(defaultCodexConfigTomlPath(), 0o600);
  if (options.appServerReset === "warn") {
    await resetDefaultAppServerControlBestEffort();
  } else {
    await resetDefaultAppServerControl();
  }
}

export async function resetDefaultAppServerControl(): Promise<void> {
  try {
    await unlink(defaultCodexAppServerControlSocketPath());
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function resetDefaultAppServerControlBestEffort(): Promise<void> {
  try {
    await resetDefaultAppServerControl();
  } catch (error: any) {
    console.warn(`Warning: could not remove default app-server control socket ${defaultCodexAppServerControlSocketPath()}: ${error?.message ?? String(error)}`);
  }
}

export async function syncDefaultCodexAuthBestEffort(accountHome: string): Promise<void> {
  try {
    await syncDefaultCodexAuth(accountHome);
    if (process.env.CODEX_HOME && path.resolve(process.env.CODEX_HOME) !== path.resolve(defaultCodexHome())) {
      console.warn(`Warning: plain codex in this shell will still use CODEX_HOME=${process.env.CODEX_HOME}. Run \`unset CODEX_HOME\` to use ${defaultCodexAuthJsonPath()}.`);
    }
  } catch (error: any) {
    console.warn(`Warning: could not sync ${defaultCodexAuthJsonPath()} for plain codex: ${error?.message ?? String(error)}`);
  }
}
