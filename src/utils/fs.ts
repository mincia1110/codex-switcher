import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteFile(filePath: string, content: string, mode?: number): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, content, { mode });
  await rename(tmp, filePath);
}

export function safeJsonStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
