import { defaultCodexHome } from "../account/paths.js";

export function buildCodexEnv(baseEnv: NodeJS.ProcessEnv, codexHome: string): NodeJS.ProcessEnv {
  return { ...baseEnv, CODEX_HOME: codexHome, CODEX_SQLITE_HOME: baseEnv.CODEX_SQLITE_HOME ?? defaultCodexHome() };
}

export function buildPlainCodexEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  delete env.CODEX_HOME;
  return env;
}
