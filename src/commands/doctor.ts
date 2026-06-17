import { access, stat } from "node:fs/promises";
import { accountAuthJsonPath, accountConfigTomlPath, cxsRoot, usageCachePath } from "../account/paths.js";
import { readConfig } from "../account/config.js";
import { authMode } from "../account/auth.js";
import { codexBinary, commandExists } from "../codex/launcher.js";
import { scriptAvailable } from "../codex/binary.js";

type Check = { name: string; status: "pass" | "warn" | "fail"; detail: string };
async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }
function line(c: Check): string { return `${c.status.toUpperCase().padEnd(5)}  ${c.name.padEnd(34)}  ${c.detail}`; }

export async function doctorCommand(): Promise<void> {
  const checks: Check[] = [];
  checks.push({ name: "Node.js >= 20", status: Number(process.versions.node.split(".")[0]) >= 20 ? "pass" : "fail", detail: process.versions.node });
  checks.push({ name: "codex binary", status: await commandExists(codexBinary()) ? "pass" : "fail", detail: codexBinary() });
  checks.push({ name: "script binary", status: await scriptAvailable() ? "pass" : "fail", detail: "required for /status usage fallback" });
  checks.push({ name: "~/.cxs root", status: await exists(cxsRoot()) ? "pass" : "warn", detail: cxsRoot() });
  try {
    const config = await readConfig();
    checks.push({ name: "config.json valid", status: "pass", detail: `${Object.keys(config.accounts).length} accounts` });
    checks.push({ name: "default account", status: config.defaultAccount && config.accounts[config.defaultAccount] ? "pass" : "warn", detail: config.defaultAccount ?? "not set" });
    for (const account of Object.values(config.accounts)) {
      checks.push({ name: `${account.name} home`, status: await exists(account.home) ? "pass" : "fail", detail: account.home });
      checks.push({ name: `${account.name} config.toml`, status: await exists(accountConfigTomlPath(account.name)) ? "pass" : "fail", detail: accountConfigTomlPath(account.name) });
      const mode = await authMode(account.name);
      checks.push({ name: `${account.name} auth.json`, status: mode === undefined ? "warn" : mode === 0o600 ? "pass" : "warn", detail: mode === undefined ? accountAuthJsonPath(account.name) : `mode ${mode.toString(8)}` });
      for (const dir of ["sessions", "logs"]) {
        const p = `${account.home}/${dir}`;
        checks.push({ name: `${account.name} ${dir}/ readable`, status: await exists(p) ? "pass" : "warn", detail: p });
      }
    }
  } catch (error: any) {
    checks.push({ name: "config.json valid", status: "fail", detail: error?.message ?? String(error) });
  }
  try { if (await exists(usageCachePath())) await stat(usageCachePath()); checks.push({ name: "usage cache", status: "pass", detail: usageCachePath() }); }
  catch (error: any) { checks.push({ name: "usage cache", status: "warn", detail: error?.message ?? String(error) }); }
  console.log(checks.map(line).join("\n"));
  if (checks.some((c) => c.status === "fail")) process.exitCode = 1;
}
