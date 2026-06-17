import { writeFile } from "node:fs/promises";
import { createRedactedDiagnosticsBundle } from "../diagnostics/export.js";

export async function exportCommand(options: { redacted?: boolean; output?: string }): Promise<void> {
  if (!options.redacted) throw new Error("Only redacted diagnostics export is supported. Use `cxs export --redacted`.");
  const bundle = await createRedactedDiagnosticsBundle();
  const json = `${JSON.stringify(bundle, null, 2)}\n`;
  if (options.output) {
    await writeFile(options.output, json, { mode: 0o600 });
    console.log(`Wrote redacted diagnostics bundle to ${options.output}`);
    return;
  }
  process.stdout.write(json);
}
