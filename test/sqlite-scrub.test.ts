import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { dryRunSQLiteScrub, scrubSQLiteInPlace } from "../src/sqliteScrub.js";
import { scanSQLiteSource } from "../src/sqlite.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => { exec(sql: string): void; close(): void } };
const fakeJwt = "eyJfakefakefakefake.fakefakefakefake.fakefakefakefake";

test("opencode sqlite scrub redacts transcript rows in-place", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hazmat-sqlite-"));
  const dbPath = path.join(dir, "opencode.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE message (id text PRIMARY KEY, data text NOT NULL);
    CREATE TABLE part (id text PRIMARY KEY, data text NOT NULL);
    CREATE TABLE session_message (id text PRIMARY KEY, data text NOT NULL);
    CREATE TABLE session_input (id text PRIMARY KEY, prompt text NOT NULL);
    INSERT INTO message VALUES ('m1', '{"text":"DATABASE_URL=postgres://fake_user:fake_pass@localhost:5432/fake_db"}');
    INSERT INTO part VALUES ('p1', '{"text":"token ${fakeJwt}"}');
    INSERT INTO session_message VALUES ('s1', '{"text":"clean"}');
    INSERT INTO session_input VALUES ('i1', 'OPENAI_API_KEY=sk-fakefakefakefakefakefakefakefake');
  `);
  db.close();

  const dry = await dryRunSQLiteScrub(dbPath, "opencode");
  assert.equal(dry?.rowsChanged, 3);
  assert.equal(dry?.redactions, 3);

  const before = await scanSQLiteSource(dbPath, "opencode");
  assert.equal(before?.risk, "high");

  const actual = await scrubSQLiteInPlace(dbPath, "opencode");
  assert.equal(actual?.rowsChanged, 3);
  assert.equal(actual?.redactions, 3);

  const after = await scanSQLiteSource(dbPath, "opencode");
  assert.equal(after?.secrets.length, 0);
});
