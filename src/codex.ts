import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import path from "node:path";
import { hasDetectorHint } from "./detectors.js";
import { buildSourceReport, createFindingState, scanCandidateText } from "./scanner.js";
import type { SourceReport } from "./types.js";

const CODEX_DIR = path.join(homedir(), ".codex");
const CODEX_SESSIONS_DIR = path.join(CODEX_DIR, "sessions");
const CODEX_EXTRA_FILES = [path.join(CODEX_DIR, "history.jsonl"), path.join(CODEX_DIR, "session_index.jsonl")];
const SCANNABLE_EXTENSIONS = new Set([".jsonl", ".json", ".log", ".txt"]);

export async function discoverCodexFiles(inputPaths: string[] = []): Promise<string[]> {
  const roots = inputPaths.length > 0 ? inputPaths.map(expandHome) : [CODEX_SESSIONS_DIR, ...CODEX_EXTRA_FILES];
  const files = new Set<string>();
  for (const root of roots) {
    if (!(await exists(root))) continue;
    const rootStat = await stat(root);
    if (rootStat.isDirectory()) {
      for await (const file of walk(root)) if (isScannable(file)) files.add(file);
    } else if (rootStat.isFile() && isScannable(root)) files.add(root);
  }
  return [...files].sort();
}

export async function scanCodexFile(filePath: string): Promise<SourceReport> {
  const state = createFindingState();
  let linesScanned = 0;
  const rl = createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });

  for await (const line of rl) {
    linesScanned += 1;
    for (const text of extractCodexScanTexts(line)) scanCandidateText(text, state);
  }

  return buildSourceReport({ harness: "codex", path: filePath, linesScanned, state });
}

function extractCodexScanTexts(line: string): string[] {
  if (!hasDetectorHint(line)) return [];
  let entry: unknown;
  try { entry = JSON.parse(line); } catch { return [line]; }
  if (!isObject(entry)) return [line];
  const type = stringValue(entry.type);
  const payload = isObject(entry.payload) ? entry.payload : undefined;
  if (!payload) return [];
  const payloadType = stringValue(payload.type);

  if (type === "event_msg") {
    if (payloadType === "user_message" || payloadType === "agent_message") return compactStrings([payload.message]);
    if (payloadType === "task_complete") return compactStrings([payload.last_agent_message]);
    return [];
  }
  if (type === "response_item") {
    if (payloadType === "function_call") return compactStrings([payload.name, payload.arguments]);
    if (payloadType === "function_call_output") return compactStrings([payload.output]);
    if (payloadType === "message") return extractContentText(payload.content);
    if (payloadType === "reasoning") return extractContentText(payload.summary);
    return [];
  }
  if (type === "turn_context") return compactStrings([payload.user_instructions, payload.summary]);
  if (type === "session_meta") return [];
  return extractLikelyText(payload);
}

function extractContentText(value: unknown): string[] {
  if (!Array.isArray(value)) return compactStrings([value]);
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
    else if (isObject(item)) out.push(...compactStrings([item.text, item.content, item.message, item.output]));
  }
  return out;
}

function extractLikelyText(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => extractLikelyText(item, depth + 1));
  if (!isObject(value)) return [];
  const out: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (["encrypted_content", "rate_limits", "usage", "base_instructions"].includes(key)) continue;
    if (["message", "text", "content", "output", "arguments", "user_instructions", "last_agent_message"].includes(key)) out.push(...extractLikelyText(nested, depth + 1));
  }
  return out;
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile()) yield fullPath;
  }
}

function compactStrings(values: unknown[]): string[] { return values.filter((value): value is string => typeof value === "string" && value.length > 0); }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isScannable(filePath: string): boolean { return SCANNABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase()); }
function expandHome(input: string): string { if (input === "~") return homedir(); if (input.startsWith("~/")) return path.join(homedir(), input.slice(2)); return path.resolve(input); }
async function exists(filePath: string): Promise<boolean> { try { await access(filePath); return true; } catch { return false; } }
