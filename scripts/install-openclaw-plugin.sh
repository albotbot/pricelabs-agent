#!/usr/bin/env bash
# Install the PriceLabs MCP bridge plugin into OpenClaw
# Usage: bash scripts/install-openclaw-plugin.sh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_EXT_DIR="${HOME}/.openclaw/extensions/pricelabs"
OPENCLAW_CONFIG="${HOME}/.openclaw/openclaw.json"
WORKSPACE_DIR="${HOME}/.openclaw/workspace"
DB_DIR="${HOME}/.pricelabs-agent"

echo "=== PriceLabs OpenClaw Plugin Installer ==="
echo ""

# 1. Ensure MCP server is built
echo "[1/5] Checking MCP server build..."
if [ ! -f "${PROJECT_ROOT}/mcp-servers/pricelabs/dist/index.js" ]; then
  echo "  Building MCP server..."
  cd "${PROJECT_ROOT}/mcp-servers/pricelabs" && npm run build
  cd "${PROJECT_ROOT}"
else
  echo "  MCP server already built ✓"
fi

# 2. Copy plugin to OpenClaw extensions
echo "[2/5] Installing plugin to ${OPENCLAW_EXT_DIR}..."
mkdir -p "${OPENCLAW_EXT_DIR}"
cp "${PROJECT_ROOT}/openclaw/extensions/pricelabs/openclaw.plugin.json" "${OPENCLAW_EXT_DIR}/"
cp "${PROJECT_ROOT}/openclaw/extensions/pricelabs/index.ts" "${OPENCLAW_EXT_DIR}/"
cp "${PROJECT_ROOT}/openclaw/extensions/pricelabs/tool-definitions.json" "${OPENCLAW_EXT_DIR}/"
cp "${PROJECT_ROOT}/openclaw/extensions/pricelabs/package.json" "${OPENCLAW_EXT_DIR}/"
echo "  Plugin files installed ✓"

# 3. Ensure database directory exists
echo "[3/5] Ensuring database directory..."
mkdir -p "${DB_DIR}"
echo "  ${DB_DIR} ready ✓"

# 4. Copy skill files to workspace
echo "[4/5] Copying skill files to workspace..."
SKILLS_DEST="${WORKSPACE_DIR}/pricelabs-skills"
mkdir -p "${SKILLS_DEST}"
cp "${PROJECT_ROOT}/openclaw/skills/"*.md "${SKILLS_DEST}/"
echo "  Skill files copied to ${SKILLS_DEST} ✓"

# 5. Instructions
echo "[5/5] Plugin installed!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Add the plugin to your OpenClaw config (${OPENCLAW_CONFIG}):"
echo '   In the "plugins" section, add:'
echo '   "load": { "paths": ["'"${OPENCLAW_EXT_DIR}"'"] },'
echo '   "entries": {'
echo '     ...'
echo '     "pricelabs": {'
echo '       "enabled": true,'
echo '       "config": {'
echo '         "serverPath": "'"${PROJECT_ROOT}/mcp-servers/pricelabs/dist/index.js"'",'
echo '         "dbPath": "'"${DB_DIR}/data.sqlite"'",'
echo '         "baseUrl": "https://api.pricelabs.co",'
echo '         "writesEnabled": "false"'
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "2. Add PRICELABS_API_KEY to your OpenClaw env section:"
echo '   "env": { "PRICELABS_API_KEY": "your-api-key-here" }'
echo ""
echo "3. Add skill file references to the agent workspace:"
echo "   Edit ${WORKSPACE_DIR}/AGENTS.md to reference the skill files"
echo ""
echo "4. Restart the OpenClaw gateway:"
echo "   openclaw gateway restart"
echo ""
echo "Done! The agent will now have access to all 28 PriceLabs tools."
