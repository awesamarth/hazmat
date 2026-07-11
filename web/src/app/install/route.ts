export const runtime = "edge";

const script = `#!/usr/bin/env sh
set -eu

PACKAGE="hazmat-cli"
COMMAND="scan --publish"

if command -v npx >/dev/null 2>&1; then
  exec npx --yes "$PACKAGE" $COMMAND
fi

if command -v bunx >/dev/null 2>&1; then
  exec bunx "$PACKAGE" $COMMAND
fi

echo "Hazmat requires Node.js/npm or Bun." >&2
echo "Install Node.js from https://nodejs.org, then run:" >&2
echo "  npx hazmat-cli scan --publish" >&2
exit 1
`;

export function GET() {
  return new Response(script, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
