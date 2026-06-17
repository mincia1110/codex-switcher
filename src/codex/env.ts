export function buildCodexEnv(baseEnv: NodeJS.ProcessEnv, codexHome: string): NodeJS.ProcessEnv {
  return { ...baseEnv, CODEX_HOME: codexHome };
}
