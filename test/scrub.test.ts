import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { dryRunScrubTextFile, scrubTextFileInPlace } from "../src/scrub.js";

const fakeDbUrl = "postgres://fake_user:fake_pass@localhost:5432/fake_db";
const fakeOpenAiKey = "sk-fakefakefakefakefakefakefakefake";

async function fixtureFile() {
  const dir = await mkdtemp(path.join(tmpdir(), "hazmat-scrub-"));
  const file = path.join(dir, "session.jsonl");
  const lines = [
    JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "hello" } }),
    JSON.stringify({ type: "response_item", payload: { type: "function_call_output", output: `DATABASE_URL=${fakeDbUrl}` } }),
    JSON.stringify({ type: "response_item", payload: { type: "function_call_output", output: `OPENAI_API_KEY=${fakeOpenAiKey}` } }),
    JSON.stringify({ type: "response_item", payload: { type: "function_call_output", output: `prefix\\nSEQUENCER_KEY=0xYOUR_SECP256K1_PRIVATE_KEY\\nVRF_PRIVATE_KEY=YOUR_BLS_PRIVATE_KEY_HEX_NO_0x` } }),
  ];
  await writeFile(file, `${lines.join("\n")}\n`, "utf8");
  return file;
}

test("dry-run scrub reports changes without modifying file", async () => {
  const file = await fixtureFile();
  const before = await readFile(file, "utf8");
  const result = await dryRunScrubTextFile(file);
  const after = await readFile(file, "utf8");

  assert.equal(result.linesScanned, 4);
  assert.equal(result.linesChanged, 3);
  assert.equal(result.redactions, 4);
  assert.equal(after, before);
});

test("in-place scrub redacts only secret values and preserves JSONL", async () => {
  const file = await fixtureFile();
  const result = await scrubTextFileInPlace(file);
  const after = await readFile(file, "utf8");
  const lines = after.trimEnd().split("\n");

  assert.equal(result.linesScanned, 4);
  assert.equal(result.linesChanged, 3);
  assert.equal(result.redactions, 4);
  assert.equal(lines.length, 4);
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
  assert(!after.includes(fakeDbUrl));
  assert(!after.includes(fakeOpenAiKey));
  assert(!after.includes("0xYOUR_SECP256K1_PRIVATE_KEY"));
  assert(!after.includes("YOUR_BLS_PRIVATE_KEY_HEX_NO_0x"));
  assert(after.includes("DATABASE_URL=<redacted:database-url:"));
  assert(after.includes("OPENAI_API_KEY=<redacted:openai-api-key:"));
  assert(after.includes("SEQUENCER_KEY=<redacted:env-secret-assignment:"));
  assert(after.includes("VRF_PRIVATE_KEY=<redacted:env-secret-assignment:"));
  assert(after.includes('"message":"hello"'));
});
