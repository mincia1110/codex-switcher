import os from "node:os";
import path from "node:path";

export const cxsRoot = () => path.join(os.homedir(), ".cxs");
export const configPath = () => path.join(cxsRoot(), "config.json");
export const accountsRoot = () => path.join(cxsRoot(), "accounts");
export const cacheRoot = () => path.join(cxsRoot(), "cache");
export const sharedRoot = () => path.join(cxsRoot(), "shared");
export const sharedSessionsPath = () => path.join(sharedRoot(), "sessions");
export const sharedHistoryPath = () => path.join(sharedRoot(), "history.jsonl");
export const sharedSessionIndexPath = () => path.join(sharedRoot(), "session_index.jsonl");
export const usageCachePath = () => path.join(cacheRoot(), "usage.json");
export const accountHome = (name: string) => path.join(accountsRoot(), name);
export const accountConfigTomlPath = (name: string) => path.join(accountHome(name), "config.toml");
export const accountAuthJsonPath = (name: string) => path.join(accountHome(name), "auth.json");
export const defaultCodexHome = () => path.join(os.homedir(), ".codex");
export const defaultCodexConfigTomlPath = () => path.join(defaultCodexHome(), "config.toml");
export const defaultCodexAuthJsonPath = () => path.join(defaultCodexHome(), "auth.json");
export const defaultCodexAppServerControlSocketPath = () => path.join(defaultCodexHome(), "app-server-control", "app-server-control.sock");
