import type { AccountRecord } from "../account/types.js";
import type { UsageSnapshot } from "../usage/types.js";
import { usageSourceLabel } from "../usage/format.js";
import { maskEmail } from "../utils/mask.js";
import { formatDateTime, formatReset, formatResetDateTime } from "../utils/time.js";

function pad(value: string, width: number): string { return value.padEnd(width); }
function pct(value: number | undefined | null): string { return value === undefined || value === null ? "?" : `${Math.round(value)}%`; }

export function accountListTable(accounts: AccountRecord[], defaultAccount?: string): string {
  const rows = [["Account", "Email", "Default", "Last Used"], ...accounts.map((a) => [a.name, maskEmail(a.email), a.name === defaultAccount ? "yes" : "no", formatDateTime(a.lastUsedAt)])];
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => pad(c, widths[i])).join("  ")).join("\n");
}

export function usageTable(accounts: AccountRecord[], snapshots: Record<string, UsageSnapshot>): string {
  const rows = [["Account", "Email", "Plan", "5h left", "Week left", "5h reset", "Week reset", "Source"], ...accounts.map((a) => {
    const s = snapshots[a.name];
    return [
      a.name,
      maskEmail(s?.email ?? a.email),
      s?.plan ?? "?",
      pct(s?.fiveHour?.remainingPercent),
      pct(s?.weekly?.remainingPercent),
      formatReset(s?.fiveHour?.resetAt),
      formatResetDateTime(s?.weekly?.resetAt),
      usageSourceLabel(s),
    ];
  })];
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => pad(c, widths[i])).join("  ")).join("\n");
}

export function switchLabel(account: AccountRecord, snapshot?: UsageSnapshot): string {
  const email = maskEmail(snapshot?.email ?? account.email);
  return `${account.name}  ${email}  5h ${pct(snapshot?.fiveHour?.remainingPercent)} reset ${formatReset(snapshot?.fiveHour?.resetAt)}  week ${pct(snapshot?.weekly?.remainingPercent)} reset ${formatResetDateTime(snapshot?.weekly?.resetAt)}  ${usageSourceLabel(snapshot)}`;
}
