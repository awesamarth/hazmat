import { createRequire } from "node:module";
import { redactText } from "./detectors.js";
import type { Harness } from "./types.js";

export type DbScrubResult = {
  path: string;
  rowsScanned: number;
  rowsChanged: number;
  redactions: number;
};

type SqliteDatabase = {
  prepare(sql: string): {
    all(...params: unknown[]): Array<Record<string, unknown>>;
    run(...params: unknown[]): unknown;
  };
  exec(sql: string): unknown;
  close(): void;
};

type Target = { table: string; column: string; idColumn: string };

const SQL_HINTS = [
  ".env", "PRIVATE KEY", "sk-", "sk-ant-", "ghp_", "gho_", "ghu_", "ghs_", "ghr_",
  "postgres://", "postgresql://", "mysql://", "mongodb://", "mongodb+srv://", "redis://",
  "eyJ", "webhook", "hooks.slack", "discord.com/api/webhooks", "discordapp.com/api/webhooks",
  "KEY", "TOKEN", "SECRET", "PASSWORD", "DATABASE_URL", "DB_URL", "AUTH",
];

export async function dryRunSQLiteScrub(filePath: string, harness: Harness): Promise<DbScrubResult | null> {
  return scrubSQLite(filePath, harness, { dryRun: true });
}

export async function scrubSQLiteInPlace(filePath: string, harness: Harness): Promise<DbScrubResult | null> {
  return scrubSQLite(filePath, harness, { dryRun: false });
}

async function scrubSQLite(filePath: string, harness: Harness, options: { dryRun: boolean }): Promise<DbScrubResult | null> {
  const targets = targetsForHarness(harness);
  if (targets.length === 0) return null;

  const db = openDatabase(filePath, !options.dryRun);
  let rowsScanned = 0;
  let rowsChanged = 0;
  let redactions = 0;

  try {
    for (const target of targets) {
      if (!tableHasColumn(db, target.table, target.column) || !tableHasColumn(db, target.table, target.idColumn)) continue;
      const candidateIds = collectCandidateIds(db, target);
      const select = db.prepare(`SELECT ${quoteIdent(target.idColumn)} AS id, ${quoteIdent(target.column)} AS value FROM ${quoteIdent(target.table)} WHERE ${quoteIdent(target.idColumn)} = ?`);
      const update = options.dryRun
        ? null
        : db.prepare(`UPDATE ${quoteIdent(target.table)} SET ${quoteIdent(target.column)} = ? WHERE ${quoteIdent(target.idColumn)} = ?`);

      for (const id of candidateIds) {
        const rows = select.all(id);
        const row = rows[0];
        const value = row?.value;
        if (typeof value !== "string") continue;
        rowsScanned += 1;
        const result = redactText(value);
        if (result.text === value) continue;
        rowsChanged += 1;
        redactions += result.redactions;
        update?.run(result.text, id);
      }
    }

    if (!options.dryRun && rowsChanged > 0) {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.exec("VACUUM");
    }

    return { path: filePath, rowsScanned, rowsChanged, redactions };
  } finally {
    db.close();
  }
}

function targetsForHarness(harness: Harness): Target[] {
  if (harness === "opencode") {
    return [
      { table: "message", column: "data", idColumn: "id" },
      { table: "part", column: "data", idColumn: "id" },
      { table: "session_message", column: "data", idColumn: "id" },
      { table: "session_input", column: "prompt", idColumn: "id" },
    ];
  }
  if (harness === "cursor") {
    return [
      { table: "ItemTable", column: "value", idColumn: "key" },
      { table: "cursorDiskKV", column: "value", idColumn: "key" },
    ];
  }
  return [];
}

function collectCandidateIds(db: SqliteDatabase, target: Target): unknown[] {
  const ids = new Set<unknown>();
  const idCol = quoteIdent(target.idColumn);
  const valueCol = quoteIdent(target.column);
  const table = quoteIdent(target.table);

  for (const hint of SQL_HINTS) {
    const rows = db.prepare(`SELECT ${idCol} AS id FROM ${table} WHERE typeof(${valueCol}) = 'text' AND ${valueCol} LIKE ?`).all(`%${hint}%`);
    for (const row of rows) ids.add(row.id);
  }
  return [...ids];
}

function tableHasColumn(db: SqliteDatabase, table: string, column: string): boolean {
  try {
    const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
    return rows.some((row) => row.name === column);
  } catch {
    return false;
  }
}

function openDatabase(filePath: string, writable: boolean): SqliteDatabase {
  const sqlite = requireNodeSqlite();
  return new sqlite.DatabaseSync(filePath, writable ? {} : { readOnly: true }) as SqliteDatabase;
}

function requireNodeSqlite(): { DatabaseSync: new (path: string, options?: Record<string, unknown>) => unknown } {
  if (!supportsStableNodeSqlite()) {
    throw new Error(
      `OpenCode/Cursor DB scrub requires Node >= 22.13.0 because it uses node:sqlite. ` +
        `Your Node: ${process.version}. JSONL/text scrub still works.`,
    );
  }

  try {
    const require = createRequire(import.meta.url);
    return require("node:sqlite") as { DatabaseSync: new (path: string, options?: Record<string, unknown>) => unknown };
  } catch {
    throw new Error(
      `OpenCode/Cursor DB scrub requires Node >= 22.13.0 because it uses node:sqlite. ` +
        `Your Node: ${process.version}. JSONL/text scrub still works.`,
    );
  }
}

function supportsStableNodeSqlite(): boolean {
  const match = process.versions.node.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major > 22) return true;
  if (major < 22) return false;
  return minor >= 13;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
