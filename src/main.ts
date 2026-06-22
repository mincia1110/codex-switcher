#!/usr/bin/env node
import { Command, Option } from "commander";
import { loginCommand } from "./commands/login.js";
import { listCommand } from "./commands/list.js";
import { useCommand } from "./commands/use.js";
import { parseRunInvocation, runCommand } from "./commands/run.js";
import { syncCommand } from "./commands/sync.js";
import { switchCommand } from "./commands/switch.js";
import { usageCommand } from "./commands/usage.js";
import { doctorCommand } from "./commands/doctor.js";
import { exportCommand } from "./commands/export.js";
import { completionCommand } from "./commands/completion.js";
import { repairSessionsCommand } from "./commands/repair-sessions.js";

const program = new Command();
program.name("cxs").description("Codex account switcher for plain codex and isolated account homes").version("0.1.0");
program.command("login <name>").description("create an account CODEX_HOME and run codex login").action(wrap(loginCommand));
program.command("list").description("list configured Codex accounts").action(wrap(listCommand));
program.command("use <name>").description("set default account without running Codex").action(wrap(useCommand));
program.command("run").description("sync an account, then run plain codex").allowUnknownOption(true).allowExcessArguments(true).argument("[name]").option("--isolated", "run codex with the account CODEX_HOME instead of syncing first").action(wrap(async () => { const invocation = parseRunInvocation(process.argv); await runCommand(invocation.name, invocation.args, { isolated: invocation.isolated }); }));
program.command("sync").description("sync account auth to the default Codex home without running Codex").argument("[name]").option("--dry-run", "show planned sync without modifying files").action(wrap(syncCommand));
program.command("switch").description("interactively select account and run codex").option("--no-run", "set default only").option("--scan", "rescan local usage logs before showing").addOption(new Option("--sort <mode>", "sort order").choices(["default", "quota", "recent", "name"]).default("default")).action(wrap(switchCommand));
program.command("usage").description("show usage for all accounts via backend/status/local/cache provider chain").option("--scan", "rescan local usage logs only").option("--refresh", "allow slower backend/status refresh").option("--json", "print JSON").action(wrap(usageCommand));
program.command("repair-sessions").description("repair shared Codex sessions/history/index links across cxs homes").action(wrap(repairSessionsCommand));
program.command("doctor").description("diagnose cxs/codex/account setup").action(wrap(doctorCommand));
program.command("export").description("export a redacted diagnostics bundle").option("--redacted", "redact secrets and raw emails").option("-o, --output <path>", "write JSON bundle to a file").action(wrap(exportCommand));
program.command("completion <shell>").description("print shell completion script for bash or zsh").action(wrap(completionCommand));

function wrap<T extends any[]>(fn: (...args: T) => Promise<void> | void) {
  return async (...args: T) => {
    try { await fn(...args); }
    catch (error: any) { console.error(error?.message ?? String(error)); process.exitCode = 1; }
  };
}

await program.parseAsync(process.argv);
