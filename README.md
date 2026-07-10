# Hazmat

Local exposure scanner and scrubber for AI coding-agent transcripts.

Current pre-v0 supports scan/report/export plus in-place scrubbing for discovered Codex, Claude, pi, OpenCode, and best-effort Cursor transcript sources.

```bash
bun install
bun run build
node dist/src/cli.js scan
node dist/src/cli.js report
node dist/src/cli.js export --out report.json
node dist/src/cli.js scrub --dry-run
```

Publish flow:

```bash
# terminal 1
cd web && bun run dev

# terminal 2
export HAZMAT_API_URL=http://localhost:3000
export HAZMAT_GITHUB_CLIENT_ID=<github-oauth-client-id>
node dist/src/cli.js login
node dist/src/cli.js export --publish
# or: node dist/src/cli.js scan --publish
```

For CLI login, enable Device Flow on the GitHub OAuth App.

Planned package binary:

```bash
hazmat scan
hazmat report
hazmat export --publish
hazmat scrub
```
