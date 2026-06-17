import { codexBinary, commandExists } from "./launcher.js";

export { codexBinary, commandExists };

export async function scriptAvailable(): Promise<boolean> {
  return commandExists("script");
}
