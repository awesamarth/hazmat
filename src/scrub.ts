import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
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
    const result = redactText(line);
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

  const rl = createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
  const out = createWriteStream(tempPath, { encoding: "utf8", flags: "wx" });

  try {
    for await (const line of rl) {
      linesScanned += 1;
      let nextLine = line;
      if (hasDetectorHint(line)) {
        const result = redactText(line);
        nextLine = result.text;
        redactions += result.redactions;
        if (nextLine !== line) linesChanged += 1;
      }
      if (!out.write(`${nextLine}\n`)) await onceDrain(out);
    }
    await closeWriteStream(out);
    await rename(tempPath, filePath);
    return { path: filePath, linesScanned, linesChanged, redactions };
  } catch (error) {
    out.destroy();
    await rm(tempPath, { force: true });
    throw error;
  }
}

function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve) => stream.once("drain", resolve));
}

function closeWriteStream(stream: ReturnType<typeof createWriteStream>): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.once("error", reject);
  });
}
