#!/usr/bin/env bash
# claude-buddy MCP server launcher — finds bun robustly, then execs the server.
# Claude Code may spawn plugin MCP servers with a minimal PATH (e.g. when
# launched from a GUI / dock / tmux), so we also probe the usual install
# locations where `curl -fsSL https://bun.sh/install | bash` drops bun.

set -eu

# Try PATH first, then common install locations.
BUN=""
if command -v bun >/dev/null 2>&1; then
  BUN="$(command -v bun)"
else
  for candidate in \
    "$HOME/.bun/bin/bun" \
    "/opt/homebrew/bin/bun" \
    "/usr/local/bin/bun" \
    "/home/linuxbrew/.linuxbrew/bin/bun" \
    "/usr/bin/bun"
  do
    if [ -x "$candidate" ]; then BUN="$candidate"; break; fi
  done
fi

if [ -z "$BUN" ]; then
  cat >&2 <<'EOF'
[claude-buddy-cn] ERROR: could not locate 'bun' on PATH or in common install dirs.

claude-buddy's MCP server runs on bun. Install it:

    curl -fsSL https://bun.sh/install | bash

Then restart Claude Code (so the plugin's MCP server re-spawns with PATH
updated by ~/.bashrc or ~/.zshrc).

If bun is installed somewhere unusual, ensure its directory is on your
shell's PATH for Claude Code's launch context.
EOF
  exit 127
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$BUN" "$SCRIPT_DIR/index.ts"
