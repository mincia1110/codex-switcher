import { readConfig } from "../account/config.js";
import { ensureAllSharedSessions } from "../codex/shared-sessions.js";

export async function repairSessionsCommand(): Promise<void> {
  const config = await readConfig();
  await ensureAllSharedSessions(Object.values(config.accounts));
  console.log(`Repaired shared Codex session state for ${Object.keys(config.accounts).length} accounts and default Codex home.`);
}
