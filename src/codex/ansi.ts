const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_OSC_PATTERN = new RegExp(`${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)`, "g");
const ANSI_CSI_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const ANSI_SINGLE_PATTERN = new RegExp(`${ESC}[@-_]`, "g");

export function stripAnsi(input: string): string {
  return input.replace(ANSI_OSC_PATTERN, "").replace(ANSI_CSI_PATTERN, "").replace(ANSI_SINGLE_PATTERN, "").replace(/\r/g, "");
}
