# Multi-stage Dockerfile mimicking OpenClaw's Docker sandbox environment.
# Builds the PriceLabs MCP server and packages it with skills and agent docs.
#
# IMPORTANT: No secrets are baked into this image. PRICELABS_API_KEY and other
# sensitive values must be injected at runtime via `docker run -e`.
#
# Usage:
#   docker build -t pricelabs-agent .
#   docker run --rm -i -e PRICELABS_API_KEY=your-key pricelabs-agent

# ---- Stage 1: Build ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for the MCP server
COPY mcp-servers/pricelabs/package*.json mcp-servers/pricelabs/

# Install all dependencies (including devDependencies for build)
RUN cd mcp-servers/pricelabs && npm ci --production=false

# Copy source and build
COPY mcp-servers/pricelabs/ mcp-servers/pricelabs/
RUN cd mcp-servers/pricelabs && npm run build

# ---- Stage 2: Runtime ----
FROM node:20-slim

# Install SQLite runtime library (needed for better-sqlite3 native module)
RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built MCP server with node_modules (includes native better-sqlite3 binary)
COPY --from=builder /app/mcp-servers/pricelabs/dist/ mcp-servers/pricelabs/dist/
COPY --from=builder /app/mcp-servers/pricelabs/node_modules/ mcp-servers/pricelabs/node_modules/
COPY --from=builder /app/mcp-servers/pricelabs/package.json mcp-servers/pricelabs/package.json

# Copy OpenClaw config, cron jobs, and agent skill files
COPY openclaw/ openclaw/

# Copy agent docs (read-only reference material)
COPY agent/ agent/

# Environment variables (defaults -- overridden at runtime via docker run -e)
ENV PRICELABS_API_KEY=""
ENV PRICELABS_DB_PATH="/data/pricelabs.sqlite"
ENV PRICELABS_BASE_URL="https://api.pricelabs.co"
ENV PRICELABS_WRITES_ENABLED="false"

# Create data directory for SQLite persistence
RUN mkdir -p /data

# The MCP server communicates via stdio JSON-RPC, not HTTP.
# OpenClaw spawns it as a subprocess, so no EXPOSE is needed.
CMD ["node", "mcp-servers/pricelabs/dist/index.js"]
