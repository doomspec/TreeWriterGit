import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { ModelFsError } from "../modelFs.js";

const execFileAsync = promisify(execFile);

async function assertPandocAvailable(): Promise<void> {
  try {
    await execFileAsync("pandoc", ["--version"]);
  } catch {
    throw new ModelFsError(
      "pandoc is not installed. Install it with: brew install pandoc",
      503,
    );
  }
}

export async function convertDocxBufferToMarkdown(buffer: Buffer): Promise<string> {
  await assertPandocAvailable();
  const dir = await mkdtemp(path.join(tmpdir(), "tw-docx-import-"));
  const inputPath = path.join(dir, "input.docx");
  const outputPath = path.join(dir, "output.md");
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("pandoc", [
      inputPath,
      "-t",
      "gfm",
      "--wrap=none",
      "-o",
      outputPath,
    ]);
    return (await readFile(outputPath, "utf8")).trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
