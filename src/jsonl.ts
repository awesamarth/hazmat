import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import path from "node:path";
import { hasDetectorHint } from "./detectors.js";
import { buildSourceReport, createFindingState, scanCandidateText } from "./scanner.js";
import type { Harness, SourceReport } from "./types.js";

const SCANNABLE_EXTENSIONS = new Set([".jsonl", ".json", ".log", ".txt", ".md"]);

export async function discoverFiles(roots: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const rootInput of roots) {
    const root = expandHome(rootInput);
    if (!(await exists(root))) continue;
    const rootStat = await stat(root);
    if (rootStat.isDirectory()) {
      for await (const file of walk(root)) if (isScannable(file)) files.add(file);
    } else if (rootStat.isFile() && isScannable(root)) files.add(root);
  }
  return [...files].sort();
}

export async function scanGenericTranscriptFile(filePath: string, harness: Harness): Promise<SourceReport> {
  const state = createFindingState();
  let linesScanned = 0;
  let projectPath: string | undefined;
  let sessionId: string | undefined;
  const rl = createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });

  for await (const line of rl) {
    linesScanned += 1;
    for (const text of extractGenericScanTexts(line)) scanCandidateText(text, state);
    if (!projectPath || !sessionId) {
      const meta = extractMetadata(line);
      projectPath ||= meta.projectPath;
      sessionId ||= meta.sessionId;
    }
  }

  return buildSourceReport({ harness, path: filePath, linesScanned, state, projectPath, sessionId });
}

function extractGenericScanTexts(line: string): string[] {
  if (!hasDetectorHint(line)) return [];
  try {
    const parsed = JSON.parse(line) as unknown;
    return extractLikelyText(parsed);
  } catch {
    return [line];
  }
}

function extractLikelyText(value: unknown, depth = 0): string[] {
  if (depth > 7) return [];
  if (typeof value === "string") return hasDetectorHint(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => extractLikelyText(item, depth + 1));
  if (!isObject(value)) return [];

  const out: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (shouldSkipKey(key)) continue;
    if (typeof nested === "string") {
      if (hasDetectorHint(nested)) out.push(nested);
      continue;
    }
    out.push(...extractLikelyText(nested, depth + 1));
  }
  return out;
}

function extractMetadata(line: string): { projectPath?: string; sessionId?: string } {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isObject(parsed)) return {};
    const payload = isObject(parsed.payload) ? parsed.payload : parsed;
    return {
      projectPath: firstString(payload.cwd, payload.projectPath, payload.project_path, payload.directory),
      sessionId: firstString(payload.session_id, payload.sessionId, payload.id, parsed.sessionId, parsed.session_id),
    };
  } catch {
    return {};
  }
}

function shouldSkipKey(key: string): boolean {
  return [
    "timestamp",
    "created_at",
    "updated_at",
    "uuid",
    "id",
    "parent_id",
    "session_id",
    "encrypted_content",
    "rate_limits",
    "usage",
    "tokens",
    "embedding",
  ].includes(key);
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile()) yield fullPath;
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isScannable(filePath: string): boolean { return SCANNABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase()); }
export function expandHome(input: string): string { if (input === "~") return homedir(); if (input.startsWith("~/")) return path.join(homedir(), input.slice(2)); return path.resolve(input); }
async function exists(filePath: string): Promise<boolean> { try { await access(filePath); return true; } catch { return false; } }
