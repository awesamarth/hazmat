import path from "node:path";
import { homedir } from "node:os";
import { access, readdir, stat } from "node:fs/promises";
import { discoverCodexFiles } from "./codex.js";
import { discoverFiles } from "./jsonl.js";
import type { Harness } from "./types.js";

export type ScanSource = {
  harness: Harness;
  kind: "file" | "sqlite";
  path: string;
};

export async function discoverDefaultSources(): Promise<ScanSource[]> {
  const sources: ScanSource[] = [];
  for (const file of await discoverCodexFiles()) sources.push({ harness: "codex", kind: "file", path: file });

  for (const file of await discoverFiles([
    path.join(homedir(), ".claude", "projects"),
    path.join(homedir(), ".claude", "history.jsonl"),
  ])) sources.push({ harness: "claude", kind: "file", path: file });

  for (const file of await discoverFiles([path.join(homedir(), ".pi", "agent", "sessions")])) {
    sources.push({ harness: "pi", kind: "file", path: file });
  }

  const opencodeDb = path.join(homedir(), ".local", "share", "opencode", "opencode.db");
  if (await exists(opencodeDb)) sources.push({ harness: "opencode", kind: "sqlite", path: opencodeDb });

  for (const cursorPath of await cursorDbCandidates()) sources.push({ harness: "cursor", kind: "sqlite", path: cursorPath });
  return sources;
}

export async function discoverPathSources(inputPaths: string[]): Promise<ScanSource[]> {
  const sqliteSources: ScanSource[] = [];
  const textRoots: string[] = [];
  for (const input of inputPaths) {
    const expanded = expandTilde(input);
    if (await exists(expanded)) {
      const s = await stat(expanded);
      if (s.isFile() && isSqlitePath(expanded)) sqliteSources.push({ harness: inferHarness(expanded), kind: "sqlite", path: expanded });
      else textRoots.push(input);
    }
  }
  const files = await discoverFiles(textRoots);
  return [...sqliteSources, ...files.map((file) => ({ harness: inferHarness(file), kind: isSqlitePath(file) ? "sqlite" as const : "file" as const, path: file }))];
}

async function cursorDbCandidates(): Promise<string[]> {
  const userDir = process.platform === "darwin"
    ? path.join(homedir(), "Library", "Application Support", "Cursor", "User")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "Cursor", "User")
      : path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "Cursor", "User");

  const candidates = new Set<string>();
  const globalState = path.join(userDir, "globalStorage", "state.vscdb");
  if (await exists(globalState)) candidates.add(globalState);
  const workspaceStorage = path.join(userDir, "workspaceStorage");
  if (await exists(workspaceStorage)) {
    for await (const file of walk(workspaceStorage)) if (file.endsWith("state.vscdb")) candidates.add(file);
  }
  return [...candidates];
}

function expandTilde(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2));
  return path.resolve(input);
}

function inferHarness(file: string): Harness {
  if (file.includes(`${path.sep}.claude${path.sep}`)) return "claude";
  if (file.includes(`${path.sep}.pi${path.sep}`)) return "pi";
  if (file.includes(`${path.sep}.codex${path.sep}`)) return "codex";
  if (file.includes(`opencode`)) return "opencode";
  if (file.includes(`Cursor`)) return "cursor";
  return "unknown";
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile()) yield fullPath;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

function isSqlitePath(file: string): boolean {
  return file.endsWith(".db") || file.endsWith(".vscdb");
}
