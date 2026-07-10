import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { buildSourceReport, createFindingState, scanCandidateText } from "./scanner.js";
import type { Harness, SourceReport } from "./types.js";

const SQL_HINTS = [
  ".env", "PRIVATE KEY", "sk-", "sk-ant-", "ghp_", "gho_", "ghu_", "ghs_", "ghr_",
  "postgres://", "postgresql://", "mysql://", "mongodb://", "mongodb+srv://", "redis://",
  "eyJ", "webhook", "hooks.slack", "discord.com/api/webhooks", "discordapp.com/api/webhooks",
  "KEY", "TOKEN", "SECRET", "PASSWORD", "DATABASE_URL", "DB_URL", "AUTH",
  "id_rsa", "id_ed25519", ".pem", ".p12", ".pfx", "wallet", "keypair",
];

export async function scanSQLiteSource(filePath: string, harness: Harness): Promise<SourceReport | null> {
  if (!(await exists(filePath))) return null;
  if (harness === "opencode") return scanOpenCodeDb(filePath);
  if (harness === "cursor") return scanCursorDb(filePath);
  return null;
}

async function scanOpenCodeDb(filePath: string): Promise<SourceReport> {
  const state = createFindingState();
  let snippetsScanned = 0;
  const targets = [
    { table: "message", column: "data" },
    { table: "part", column: "data" },
    { table: "session_message", column: "data" },
    { table: "session_input", column: "prompt" },
  ];

  for (const target of targets) {
    for (const hint of SQL_HINTS) {
      const snippets = await sqliteSnippetRows(filePath, target.table, target.column, hint).catch(() => []);
      for (const snippet of snippets) {
        snippetsScanned += 1;
        scanCandidateText(snippet, state);
      }
    }
  }

  return buildSourceReport({ harness: "opencode", path: filePath, linesScanned: snippetsScanned, state });
}

async function scanCursorDb(filePath: string): Promise<SourceReport> {
  const state = createFindingState();
  let snippetsScanned = 0;
  const targets = [
    { table: "ItemTable", column: "value" },
    { table: "cursorDiskKV", column: "value" },
  ];

  for (const target of targets) {
    for (const hint of SQL_HINTS) {
      const snippets = await sqliteSnippetRows(filePath, target.table, target.column, hint).catch(() => []);
      for (const snippet of snippets) {
        snippetsScanned += 1;
        scanCandidateText(snippet, state);
      }
    }
  }

  return buildSourceReport({ harness: "cursor", path: filePath, linesScanned: snippetsScanned, state });
}

function sqliteSnippetRows(dbPath: string, table: string, column: string, hint: string): Promise<string[]> {
  const safeHint = hint.replaceAll("'", "''");
  const safeTable = quoteIdent(table);
  const safeColumn = quoteIdent(column);
  const query = `SELECT substr(${safeColumn}, max(instr(${safeColumn}, '${safeHint}') - 1000, 1), 4000) AS text FROM ${safeTable} WHERE typeof(${safeColumn}) = 'text' AND ${safeColumn} LIKE '%${safeHint}%'`;

  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", ["-readonly", "-json", dbPath, query], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `sqlite3 exited with ${code}`));
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve([]);
        return;
      }
      try {
        const rows = JSON.parse(trimmed) as Array<{ text?: unknown }>;
        resolve(rows.map((row) => typeof row.text === "string" ? row.text : "").filter(Boolean));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}
