import { readConfig } from "../account/config.js";
import { resolveAccount, validateAccountName } from "../account/accounts.js";
import { defaultCodexHome } from "../account/paths.js";
import { fetchResetCredits, formatResetCredits, readResetCreditAuth } from "../reset-credits/provider.js";

export type ResetCreditsCommandOptions = {
  current?: boolean;
  timezone?: string;
};

export async function resetCreditsCommand(name: string | undefined, options: ResetCreditsCommandOptions = {}): Promise<void> {
  if (name) validateAccountName(name);
  if (name && options.current) throw new Error("Use either an account name or --current, not both.");

  const accountHome = options.current ? defaultCodexHome() : resolveAccount(await readConfig(), name).home;
  const auth = await readResetCreditAuth(accountHome);
  const data = await fetchResetCredits(auth);
  console.log(formatResetCredits(data, { timezone: options.timezone }));
}
