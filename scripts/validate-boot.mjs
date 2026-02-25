/**
 * Boot validation script for Phase 6 requirements.
 *
 * Proves all 4 Phase 6 requirements are met:
 *   BOOT-01: Build and start (npm run build + MCP initialize handshake)
 *   BOOT-02: Database creation (SQLite file + all 7 tables)
 *   BOOT-03: Tool registration (28 tools via tools/list)
 *   SAFE-01: Write tools disabled (3 write tools return error without env var)
 *
 * Communicates with the MCP server via stdio JSON-RPC protocol.
 * Creates a temp database, cleans up after itself.
 *
 * Usage: node scripts/validate-boot.mjs
 */

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- ANSI colors ---
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}PASS${RESET}`;
const FAIL = `${RED}FAIL${RESET}`;

let failures = 0;
let serverProcess = null;
let tempDir = null;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS}  ${label}${detail ? ` -- ${detail}` : ""}`);
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures++;
  }
}

/**
 * Send a JSON-RPC message to the server via stdin and optionally wait for a response.
 */
function sendJsonRpc(proc, message) {
  const json = JSON.stringify(message);
  proc.stdin.write(json + "\n");
}

/**
 * Wait for a JSON-RPC response with the given id, with timeout.
 */
function waitForResponse(proc, id, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for response id=${id} after ${timeoutMs}ms`));
    }, timeoutMs);

    function onData(chunk) {
      buffer += chunk.toString();
      // Try to parse complete JSON objects separated by newlines
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            cleanup();
            resolve(parsed);
            return;
          }
        } catch {
          // Not valid JSON yet, skip
        }
      }
      // Keep the last incomplete line in the buffer
      buffer = lines[lines.length - 1];
    }

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.removeListener("data", onData);
    }

    proc.stdout.on("data", onData);
  });
}

// --- Main validation ---

try {
  const projectRoot = join(import.meta.dirname, "..");
  const mcpDir = join(projectRoot, "mcp-servers", "pricelabs");

  console.log(`\n${BOLD}=== Phase 6 Boot Validation ===${RESET}\n`);

  // ---------------------------------------------------------------
  // BOOT-01: Build and Start
  // ---------------------------------------------------------------
  console.log(`${BOLD}BOOT-01: Build and Start${RESET}`);

  // Step 1: npm run build
  try {
    execSync("npm run build", { cwd: mcpDir, stdio: "pipe" });
    check("npm run build exits with code 0", true);
  } catch (err) {
    check("npm run build exits with code 0", false, err.stderr?.toString().trim() || "build failed");
  }

  // Step 2: Start server with temp database
  tempDir = mkdtempSync(join(tmpdir(), "pricelabs-boot-test-"));
  const dbPath = join(tempDir, "test.sqlite");

  serverProcess = spawn("node", ["dist/index.js"], {
    cwd: mcpDir,
    env: {
      ...process.env,
      PRICELABS_API_KEY: "test-key-for-validation",
      PRICELABS_DB_PATH: dbPath,
      // Do NOT set PRICELABS_WRITES_ENABLED -- writes must be disabled
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Collect stderr for diagnostics
  let stderrOutput = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  // Step 3: Send initialize request
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "boot-validator", version: "1.0.0" },
    },
  };

  sendJsonRpc(serverProcess, initRequest);

  let initResponse;
  try {
    initResponse = await waitForResponse(serverProcess, 1, 10000);
    check("Server responds to initialize", !!initResponse.result, `protocolVersion: ${initResponse.result?.protocolVersion || "N/A"}`);
  } catch (err) {
    check("Server responds to initialize", false, err.message);
    if (stderrOutput) console.log(`  ${YELLOW}stderr: ${stderrOutput.trim()}${RESET}`);
    throw new Error("Cannot continue -- server did not initialize");
  }

  // Step 4: Send initialized notification
  sendJsonRpc(serverProcess, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  // Small delay to let server process the notification
  await new Promise((r) => setTimeout(r, 500));

  // ---------------------------------------------------------------
  // BOOT-02: Database Creation
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}BOOT-02: Database Creation${RESET}`);

  check("SQLite database file exists", existsSync(dbPath), dbPath);

  // Check tables using sqlite3 CLI if available, otherwise use the server
  const expectedTables = [
    "listing_snapshots",
    "price_snapshots",
    "reservations",
    "market_snapshots",
    "audit_log",
    "change_tracking",
    "user_config",
  ];

  let foundTables = [];
  try {
    const tableOutput = execSync(`sqlite3 "${dbPath}" ".tables"`, { encoding: "utf-8" });
    foundTables = tableOutput.trim().split(/\s+/).filter(Boolean);
    check("sqlite3 CLI available", true);
  } catch {
    // sqlite3 CLI not available -- use Node.js to check directly
    console.log(`  ${YELLOW}NOTE${RESET}  sqlite3 CLI not found, using Node.js fallback`);
    try {
      // Dynamic import to use the project's better-sqlite3
      const Database = (await import(join(mcpDir, "node_modules", "better-sqlite3", "lib", "index.js"))).default;
      const testDb = new Database(dbPath, { readonly: true });
      const rows = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
      foundTables = rows.map((r) => r.name);
      testDb.close();
    } catch (dbErr) {
      check("Can read database tables", false, dbErr.message);
    }
  }

  for (const table of expectedTables) {
    check(`Table exists: ${table}`, foundTables.includes(table));
  }
  check(`All 7 tables present (found ${foundTables.length})`, foundTables.length >= 7);

  // ---------------------------------------------------------------
  // BOOT-03: Tool Registration
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}BOOT-03: Tool Registration${RESET}`);

  const toolsListRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  sendJsonRpc(serverProcess, toolsListRequest);

  let toolsResponse;
  try {
    toolsResponse = await waitForResponse(serverProcess, 2, 10000);
    const tools = toolsResponse.result?.tools || [];
    const toolNames = tools.map((t) => t.name).sort();

    check(`tools/list returns 28 tools (got ${tools.length})`, tools.length === 28);

    console.log(`\n  ${BOLD}Registered tools (${tools.length}):${RESET}`);
    for (const name of toolNames) {
      console.log(`    - ${name}`);
    }
  } catch (err) {
    check("tools/list responds", false, err.message);
  }

  // ---------------------------------------------------------------
  // SAFE-01: Write Tools Disabled
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}SAFE-01: Write Tools Disabled${RESET}`);

  const writeToolTests = [
    {
      name: "pricelabs_set_overrides",
      args: {
        listing_id: "test-listing",
        pms: "test-pms",
        overrides: [{ date: "2025-01-01", price_type: "percentage", price_value: 10 }],
        reason: "boot validation test run",
      },
    },
    {
      name: "pricelabs_delete_overrides",
      args: {
        listing_id: "test-listing",
        pms: "test-pms",
        dates: ["2025-01-01"],
        reason: "boot validation test run",
      },
    },
    {
      name: "pricelabs_update_listings",
      args: {
        listings: [{ id: "test-listing", pms: "test-pms" }],
        reason: "boot validation test run",
      },
    },
  ];

  let writeId = 10;
  for (const test of writeToolTests) {
    const callRequest = {
      jsonrpc: "2.0",
      id: writeId,
      method: "tools/call",
      params: { name: test.name, arguments: test.args },
    };

    sendJsonRpc(serverProcess, callRequest);

    try {
      const callResponse = await waitForResponse(serverProcess, writeId, 10000);
      const content = callResponse.result?.content || [];
      const textContent = content.map((c) => c.text || "").join(" ");
      const isError = callResponse.result?.isError === true;
      const hasDisabledMsg = textContent.includes("Write operations are disabled");

      check(
        `${test.name} returns disabled error`,
        isError && hasDisabledMsg,
        isError ? "isError=true" : "isError=false",
      );
    } catch (err) {
      check(`${test.name} returns disabled error`, false, err.message);
    }

    writeId++;
  }

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}=== Results ===${RESET}`);
  if (failures === 0) {
    console.log(`\n  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} -- Phase 6 requirements verified.\n`);
  } else {
    console.log(`\n  ${RED}${BOLD}${failures} CHECK(S) FAILED${RESET} -- see above for details.\n`);
  }
} finally {
  // Clean up server process
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    // Give it a moment to shut down gracefully
    await new Promise((r) => setTimeout(r, 500));
    if (!serverProcess.killed) {
      serverProcess.kill("SIGKILL");
    }
  }

  // Clean up temp directory
  if (tempDir && existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

process.exit(failures > 0 ? 1 : 0);
