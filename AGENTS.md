# Hazmat Agent Notes

This repo is for building **Hazmat**, a local exposure scanner, reporter, and scrubber for AI coding-agent transcripts.

Keep this file updated as the project evolves. Store durable product decisions, architecture choices, CLI behavior, supported transcript formats, parser assumptions, detector rules, and implementation caveats here. Do not store secrets, raw credentials, private transcript contents, API keys, or sensitive user data.

## Working Style

- Build small, demoable slices. Avoid overengineering.
- v0 should be a local CLI. No hosted backend, auth, database, MCP proxy, sandbox runner, or dashboard unless explicitly decided later.
- Local-first privacy is a core product constraint: do not upload transcripts or secrets anywhere.
- Treat transcript files as sensitive input. Redact/mask in logs, errors, fixtures, and test snapshots.
- Use deterministic local fingerprints for correlation, not raw secret storage.
- If example secrets are needed, use obviously fake values only.

## Current Product Direction

Hazmat is **not** a runtime permission layer. Harnesses like Claude Code, Codex, Cursor, pi, and OpenCode should own runtime prompts, sandboxing, allow/deny rules, and warnings.

Hazmat owns post-run visibility and transcript hygiene:

- scan agent transcripts/session logs
- detect sensitive files and secret-like values that appeared
- report what the agent saw and which sessions are unsafe to share
- scrub transcripts
- optionally fingerprint known local secrets so scans can identify repeated exposure without storing raw values

Tagline candidates:

- Clean up after your coding agents.
- Yolo-mode receipts for coding agents.
- Scan, report, and scrub AI agent transcripts before they leak.

## v0 Requirements

Implement these first:

1. `hazmat scan`
   - Accept explicit file/dir paths.
   - Auto-discover at least pi and Claude Code transcript/session locations if feasible.
   - Detect common secret patterns and sensitive file references.
   - Output a clear terminal report.

2. `hazmat scrub [paths...]`
   - Mutate transcript files/databases in-place after confirmation, or with `--yes` for scripts.
   - Support JSONL/plain text and selected SQLite transcript stores.
   - Preserve structure where possible.
   - Redact values with stable labels/fingerprints, e.g. `<redacted:database-url:8f13c9>`.
   - Never print raw detected secrets.
   - No `--out` copy mode for v0; keep the product simple.

3. `hazmat report`
   - Can be simple at first: either re-run scan or read latest local scan result.
   - Summarize sessions, harness, project path, sensitive files, detected secret classes, and share-safety.

## v1 / Later

- `hazmat watch` for live tailing transcript/session files.
- Harness adapters where useful: pi extension, Claude hooks, Cursor hooks, Codex hooks, OpenCode hooks.
- Markdown/HTML share-safe export.
- Broader transcript parser coverage.

Still avoid making runtime guardrails the main product.

## Implementation Notes To Fill In

Update these as the repo is built:

- Chosen language/runtime: TypeScript compiled to Node.js CLI. Bun is used for local development/package scripts only; source should not depend on Bun runtime APIs.
- CLI framework: Commander.
- Package name / binary name: `hazmat` / `hazmat`.
- Supported transcript formats: pre-v0 supports JSONL/text-like transcript files for Codex, Claude, and pi scanning, plus SQLite scanning for OpenCode and best-effort Cursor state DBs.
- Session discovery paths: pre-v0 scans Codex (`~/.codex/sessions/**/*.jsonl`, `~/.codex/history.jsonl`, `~/.codex/session_index.jsonl`), Claude (`~/.claude/projects/**/*.jsonl`, `~/.claude/history.jsonl`), pi (`~/.pi/agent/sessions/**/*.jsonl`), OpenCode (`~/.local/share/opencode/opencode.db`), and best-effort Cursor (`~/Library/Application Support/Cursor/User/**/state.vscdb` on macOS; platform equivalents elsewhere).
- Secret detector modules: regex detectors in `src/detectors.ts` for private keys, common API tokens, database URLs, JWTs, webhook URLs, env secret assignments, and sensitive file references.
- Redaction format: `<redacted:<label>:<fingerprint>>`; scan reports show only class/fingerprint and never raw secret values. Scrub rewrites text/JSONL transcript files in-place via a temp file and only changes lines containing detected secret values; it does not create secret-bearing backups by default. SQLite scrub currently supports OpenCode transcript tables (`message.data`, `part.data`, `session_message.data`, `session_input.prompt`) and best-effort Cursor text state tables, then checkpoints/truncates WAL and VACUUMs after updates.
- Local state path: latest scan report saved to `~/.hazmat/latest-scan.json`.
- Export/publish payload policy: `hazmat export` emits privacy-preserving aggregate data only: score, source names, totals, secret classes, and grouped file-reference classes. `hazmat export --publish` and `hazmat scan --publish` upload only that safe payload. Do not include raw secrets, fingerprints, transcript paths, prompts, project names, or line contents in published payloads.
- Test fixture policy: use obviously fake secrets only; never commit raw private transcript contents or real credentials.
- Release/demo plan: pre-v0 demo is `hazmat scan` over known transcript sources, `hazmat report` displaying the latest saved scan, `hazmat export --out report.json` for local aggregate export, `hazmat export --publish` / `hazmat scan --publish` for hosted aggregate publishing, and `hazmat scrub --dry-run` / `hazmat scrub` for redaction.

---

# Hazmat

## One-liner

Local exposure scanner, reporter, and scrubber for AI coding-agent transcripts.

Think: **yolo-mode receipts for coding agents**.

## Core pitch

> I run coding agents in yolo mode like an idiot, so I built a tool that scans my agent transcripts and tells me what secrets/private files they saw.

Hazmat is not trying to replace permissions, sandboxes, MCP policies, `.cursorignore`, `.gitignore`, or harness-level warnings. Those controls belong inside the harness.

Hazmat answers a different question:

> After using coding agents, what sensitive data actually appeared in their transcripts, tool outputs, prompts, or logs?

## Thesis

AI coding agents are increasingly run with broad local access. Developers often use dangerous/yolo modes because they are convenient, especially when agents need to run tests, inspect environment variables, debug deployment issues, or use scoped development credentials.

The problem is not always that the agent read a secret. Sometimes that is intentional. The problem is that users often do not know:

- which secrets appeared in agent transcripts
- which private files were read
- which model/provider likely saw the data
- which sessions are unsafe to share
- which credentials should be rotated
- whether a transcript/demo/screenshot needs redaction first

Hazmat creates a local exposure ledger for coding-agent work.

## Non-goals

Hazmat should not start as:

- a permission layer
- a sandbox
- an MCP server/proxy
- an enterprise DLP product
- a replacement for Claude/Codex/Cursor/pi/OpenCode guardrails
- a tool that moralizes against yolo mode

Harnesses should own runtime permissions and blocking. Hazmat should own **post-run exposure visibility and transcript hygiene**.

## Target users

- developers using coding agents on private repos
- builders who run agents in yolo/dangerous/full-access modes
- developers who want to share agent transcripts safely
- teams adopting coding agents and needing lightweight local auditability
- security-conscious open-source maintainers
- crypto/infra developers handling keys, RPC URLs, wallet config, deployment secrets, or private customer/test data

## v0 Scope

v0 should be a local CLI focused on scan, report, and scrub.

### 1. Scan

```bash
hazmat scan
```

Scans known coding-agent transcript/session locations and detects sensitive exposure.

Potential sources:

- pi sessions: `~/.pi/agent/sessions/...`
- Claude Code transcripts: `~/.claude/projects/.../*.jsonl`
- Codex sessions/transcripts where available
- Cursor transcripts/logs where available
- OpenCode transcripts/logs where available
- explicit file path input: `hazmat scan ./session.jsonl`

Detected signals:

- `.env`, `.env.local`, `.env.production`, `.env.*`
- private key files
- SSH key paths
- wallet/keypair files
- API keys and tokens
- database URLs
- JWTs
- OAuth/client secrets
- RPC URLs with embedded keys
- webhook URLs
- private config paths
- sensitive-looking file reads
- sensitive values appearing in tool outputs or assistant/user messages

Example output:

```txt
Hazmat Exposure Report
=========================

Scanned: 42 sessions
Sensitive sessions: 7
High-risk sessions: 2

Findings:
- .env.local read in 4 sessions
- DATABASE_URL-like value appeared in 2 sessions
- GitHub token-like value appeared in 1 session
- SSH key path mentioned in 1 session

Likely exposure:
- Sent to model context: yes, in 5 sessions
- Evidence of git commit/push containing secrets: none found

Recommended actions:
- Rotate GitHub token-like credential if real
- Rotate production DATABASE_URL if not scoped/dev-only
- Scrub 7 transcripts before sharing
```

### 2. Report

```bash
hazmat report
```

Generates a readable local report from scan results.

Report dimensions:

- session
- harness
- model/provider if available
- project path
- sensitive files read
- secret-like values detected
- whether raw values entered transcript/tool output
- whether values appeared in user prompts, assistant messages, tool calls, or tool results
- rotation suggestions
- share-safety score for transcript export

Example per-session report:

```txt
Session: grove-indexer-debug
Harness: Claude Code
Risk: Medium

Sensitive files seen:
- .env.local
- convex/.env

Secret-like values:
- DATABASE_URL-like string
- JWT-like string

Likely model exposure:
- Yes — value appeared in Read tool output before next model turn

Share safety:
- Unsafe until scrubbed

Recommendation:
- Rotate if production credential
- Safe to keep if scoped local/dev credential
```

### 3. Scrub

```bash
hazmat scrub ~/.claude/projects/.../session.jsonl
```

Redacts secret-like values in-place so the transcript is safer to keep/share.

Example:

```bash
hazmat scrub session.jsonl
```

Before:

```env
DATABASE_URL=postgres://user:password@host/db
OPENAI_API_KEY=sk-abc123
```

After:

```env
DATABASE_URL=<redacted:database-url:8f13c9>
OPENAI_API_KEY=<redacted:openai-api-key:19c02a>
```

Scrubber requirements:

- do not upload transcripts anywhere
- preserve transcript structure where possible
- mask secret values, not necessarily variable names
- produce deterministic local fingerprints so repeated exposure can be correlated
- support JSONL and plain text logs
- optionally output Markdown summaries

### 4. Inventory / fingerprint known secrets

```bash
hazmat inventory .env.local
```

Stores local fingerprints of known secrets without storing raw values.

Then scans can report:

```txt
Known secret STRIPE_SECRET_KEY from .env.local appeared in Claude session abc123.
Known secret PRIVY_APP_SECRET did not appear in scanned transcripts.
```

This makes scanning more useful than regex-only detection.

## v1 Scope

v1 can add live visibility and better adapters, but still should not become a permission layer.

### 1. Watch mode

```bash
hazmat watch
```

Tails known transcript/session files and prints local warnings as exposure happens.

Example:

```txt
⚠️ Claude Code session read .env.local
⚠️ DATABASE_URL-like value entered transcript
⚠️ Transcript is now unsafe to share without scrubbing
```

Watch mode is informational by default. It should not block tool calls.

### 2. Harness adapters

Adapters can improve live logging and metadata collection where harnesses expose hooks/extensions.

Potential adapters:

- pi extension
- Claude Code hooks
- Cursor hooks
- Codex hooks
- OpenCode hooks if available

Adapter responsibilities:

- capture tool-call metadata
- capture transcript paths
- improve model/provider/session attribution
- emit local exposure events
- optionally trigger desktop/terminal notifications

Adapters should avoid duplicating harness permission prompts.

### 3. Share-safe export

```bash
hazmat export --session abc123 --format markdown
```

Produces:

- scrubbed transcript
- exposure summary
- list of redactions
- share-safety status

Useful for:

- bug reports
- demos
- public writeups
- sending transcripts to teammates
- issue reproduction

## Possible later features

These are optional and should not be part of the initial product.

### MCP proxy

Only useful for observing agent-to-tool calls through MCP. It will not catch native file reads, shell output, or model context exposure unless those actions happen through MCP.

### Sandbox runner

A heavier mode like:

```bash
hazmat sandbox -- claude
```

Could create a filtered workspace, remove secrets, run the agent, and apply patches back. Powerful but likely too heavy for the first version.

### Hook-based redaction

Where harnesses support output modification, Hazmat could optionally redact tool output before it enters model context. This is useful but starts overlapping with harness-level controls, so it should remain optional and clearly separate from the core scanner/reporter/scrubber.

## Differentiation

Many tools focus on preventing actions before they happen: permission prompts, sandboxes, MCP guards, policy files, network restrictions, and secret scanners in git.

Hazmat focuses on what happened during agent work:

- cross-harness transcript scanning
- local secret exposure ledger
- share-safe transcript scrubbing
- rotation recommendations
- yolo-mode auditability without killing convenience

## Example demo

Demo repo includes:

- `.env.local` with fake secrets
- fake private config
- a task that tempts the agent to inspect env files
- transcript from a yolo-mode agent run

Demo flow:

```bash
# Run agent normally in yolo mode
claude --dangerously-skip-permissions

# After the run
hazmat scan

hazmat scrub ~/.claude/projects/.../session.jsonl
```

Demo output:

```txt
I ran a coding agent in yolo mode.
It read .env.local.
Two secret-like values entered the transcript.
The transcript was unsafe to share.
Hazmat generated a scrubbed copy with stable redactions.
```

## Build plan

### Phase 1

- Implement CLI skeleton
- Implement secret regex detectors
- Parse pi JSONL sessions
- Parse Claude Code JSONL transcripts
- Produce basic scan report
- Implement scrubber for JSONL/text

### Phase 2

- Add secret fingerprint inventory
- Add model/provider/session attribution where available
- Add Codex/Cursor/OpenCode parsers if transcript formats are accessible
- Add Markdown/HTML report export

### Phase 3

- Add watch mode
- Add optional pi/Claude/Cursor/Codex adapters for better live telemetry
- Add desktop/terminal notifications

## Open questions

- Which harness transcript formats should be supported first?
- How much context should the scrubber preserve?
- Should reports store scan history in SQLite, JSON, or just generate files?
- How aggressive should rotation recommendations be?
- Should known-secret fingerprinting be opt-in per `.env` file?
- Should the public positioning lean more toward "clean up after coding agents" or "yolo-mode receipts"?

## Status

Idea seed. Current direction: scanner/reporter/scrubber for coding-agent transcript exposure. Runtime guardrails, MCP proxying, and sandboxing are deliberately out of v0.

