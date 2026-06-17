import { setDefaultAccount } from "../account/config.js";
import { validateAccountName } from "../account/accounts.js";

export async function useCommand(name: string): Promise<void> {
  validateAccountName(name);
  await setDefaultAccount(name);
  console.log(`Default Codex account set to ${name}`);
}
