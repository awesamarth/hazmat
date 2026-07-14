import { createReadStream } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { hasDetectorHint, redactText } from "./detectors.js";

export type ScrubResult = {
  path: string;
  linesScanned: number;
  linesChanged: number;
  redactions: number;
};

export async function dryRunScrubTextFile(filePath: string): Promise<ScrubResult> {
  let linesScanned = 0;
  let linesChanged = 0;
  let redactions = 0;

  const rl = createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    linesScanned += 1;
    if (!hasDetectorHint(line)) continue;
    const result = redactTranscriptLine(line);
    redactions += result.redactions;
    if (result.text !== line) linesChanged += 1;
  }

  return { path: filePath, linesScanned, linesChanged, redactions };
}

export async function scrubTextFileInPlace(filePath: string): Promise<ScrubResult> {
  const tempPath = `${filePath}.hazmat-tmp-${process.pid}`;
  let linesScanned = 0;
  let linesChanged = 0;
  let redactions = 0;

  try {
    const original = await readFile(filePath, "utf8");
    const hadTrailingNewline = original.endsWith("\n");
    const rawLines = original.split("\n");
    if (hadTrailingNewline) rawLines.pop();

    const nextLines = rawLines.map((line) => {
      linesScanned += 1;
      if (!hasDetectorHint(line)) return line;
      const result = redactTranscriptLine(line);
      redactions += result.redactions;
      if (result.text !== line) linesChanged += 1;
      return result.text;
    });

    const nextText = `${nextLines.join("\n")}${hadTrailingNewline ? "\n" : ""}`;
    await writeFile(tempPath, nextText, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, filePath);
    return { path: filePath, linesScanned, linesChanged, redactions };
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

function redactTranscriptLine(line: string): { text: string; redactions: number } {
  try {
    const parsed = JSON.parse(line) as unknown;
    const result = redactJsonValue(parsed);
    if (result.redactions === 0) return redactText(line);
    return { text: JSON.stringify(result.value), redactions: result.redactions };
  } catch {
    return redactText(line);
  }
}

function redactJsonValue(value: unknown): { value: unknown; redactions: number } {
  if (typeof value === "string") {
    if (!hasDetectorHint(value)) return { value, redactions: 0 };
    const result = redactText(value);
    return { value: result.text, redactions: result.redactions };
  }
  if (Array.isArray(value)) {
    let redactions = 0;
    let changed = false;
    const next = value.map((item) => {
      const result = redactJsonValue(item);
      redactions += result.redactions;
      if (result.value !== item) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, redactions };
  }
  if (typeof value === "object" && value !== null) {
    let redactions = 0;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const result = redactJsonValue(nested);
      redactions += result.redactions;
      if (result.value !== nested) changed = true;
      next[key] = result.value;
    }
    return { value: changed ? next : value, redactions };
  }
  return { value, redactions: 0 };
}

