export function buildCodexEnv(baseEnv: NodeJS.ProcessEnv, codexHome: string): NodeJS.ProcessEnv {
  return { ...baseEnv, CODEX_HOME: codexHome };
}

export function buildPlainCodexEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  delete env.CODEX_HOME;
  return env;
}
