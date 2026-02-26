/**
 * Deployment validation script for Phase 9 requirements.
 *
 * Proves all 5 Phase 9 DEPLOY requirements are met:
 *   DEPLOY-01: MCP server runs inside Docker container (build, start, tools/list)
 *   DEPLOY-02: Environment variables injected correctly (API key, DB path)
 *   DEPLOY-03: Skill files loaded and referenced in openclaw.json
 *   DEPLOY-04: Daily health check cron jobs valid (2 jobs, 8am CT daily)
 *   DEPLOY-05: Weekly optimization cron jobs valid (2 jobs, Monday 10am CT)
 *
 * Does NOT require a real PRICELABS_API_KEY -- uses a dummy key to test
 * infrastructure, not API connectivity. Docker must be available on the host.
 *
 * Usage: node scripts/validate-deployment.mjs
 */

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// --- ANSI colors ---
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}PASS${RESET}`;
const FAIL = `${RED}FAIL${RESET}`;
const INFO = `${CYAN}INFO${RESET}`;

let failures = 0;
let passes = 0;
let dockerProcess = null;
const IMAGE_NAME = "pricelabs-agent-test";
const CONTAINER_NAME = "pricelabs-deploy-test";

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS}  ${label}${detail ? ` -- ${detail}` : ""}`);
    passes++;
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures++;
  }
}

function info(label, detail = "") {
  console.log(`  ${INFO}  ${label}${detail ? ` -- ${detail}` : ""}`);
}

/**
 * Send a JSON-RPC message to the server via stdin.
 */
function sendJsonRpc(proc, message) {
  const json = JSON.stringify(message);
  proc.stdin.write(json + "\n");
}

/**
 * Wait for a JSON-RPC response with the given id, with timeout.
 */
function waitForResponse(proc, id, timeoutMs = 30000) {
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

/**
 * Execute a shell command and return stdout. Throws on non-zero exit.
 */
function exec(cmd, options = {}) {
  return execSync(cmd, { encoding: "utf-8", timeout: 180000, ...options }).trim();
}

// --- Requirement tracking ---
const requirements = {
  "DEPLOY-01": null,
  "DEPLOY-02": null,
  "DEPLOY-03": null,
  "DEPLOY-04": null,
  "DEPLOY-05": null,
};

// --- Main validation ---

try {
  const projectRoot = join(import.meta.dirname, "..");

  console.log(`\n${BOLD}=== Phase 9: OpenClaw Deployment Validation ===${RESET}\n`);

  // ---------------------------------------------------------------
  // Pre-flight: Check Docker is available
  // ---------------------------------------------------------------
  try {
    const dockerVersion = exec("docker version --format '{{.Server.Version}}'");
    info("Docker available", `version ${dockerVersion}`);
  } catch (err) {
    console.log(`\n  ${RED}${BOLD}ERROR${RESET}  Docker is not available or not running.`);
    console.log(`  ${DIM}Ensure Docker Desktop is running and 'docker' is in PATH.${RESET}\n`);
    process.exit(1);
  }

  // Clean up any leftover containers/images from previous runs
  try { exec(`docker rm -f ${CONTAINER_NAME} 2>/dev/null`); } catch { /* ignore */ }

  // ---------------------------------------------------------------
  // DEPLOY-01: MCP Server in Docker Container
  // ---------------------------------------------------------------
  console.log(`${BOLD}DEPLOY-01: MCP Server in Docker Container${RESET}\n`);

  let deploy01Passed = true;

  // Step 1: Build the Docker image
  info("Building Docker image (may take 1-2 minutes on first run)...");
  try {
    const buildStart = Date.now();
    execSync(`docker build -t ${IMAGE_NAME} ${projectRoot}`, { timeout: 300000, stdio: ["pipe", "pipe", "pipe"] });
    const buildTime = ((Date.now() - buildStart) / 1000).toFixed(1);
    check("Docker image builds successfully", true, `${buildTime}s`);
  } catch (err) {
    check("Docker image builds successfully", false, err.stderr?.slice(0, 200) || err.message?.slice(0, 200));
    deploy01Passed = false;
  }

  // Step 2: Start an interactive container and test MCP server via stdio JSON-RPC
  let toolCount = 0;

  if (deploy01Passed) {
    info("Starting MCP server in Docker container via stdio...");

    dockerProcess = spawn("docker", [
      "run", "--rm", "-i",
      "--name", CONTAINER_NAME,
      "-e", "PRICELABS_API_KEY=test-deploy-key",
      "-e", "PRICELABS_DB_PATH=/data/test.sqlite",
      IMAGE_NAME,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    // Collect stderr for diagnostics
    let stderrOutput = "";
    dockerProcess.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });

    // Give the container a moment to start
    await new Promise((r) => setTimeout(r, 3000));

    // Step 3: Send initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "deploy-validator", version: "1.0.0" },
      },
    };

    sendJsonRpc(dockerProcess, initRequest);

    let initResponse;
    try {
      initResponse = await waitForResponse(dockerProcess, 1, 15000);
      check("MCP server responds to initialize inside Docker", !!initResponse.result, `protocolVersion: ${initResponse.result?.protocolVersion || "N/A"}`);
    } catch (err) {
      check("MCP server responds to initialize inside Docker", false, err.message);
      if (stderrOutput) {
        console.log(`  ${YELLOW}container stderr: ${stderrOutput.trim().slice(0, 300)}${RESET}`);
      }
      deploy01Passed = false;
    }

    if (deploy01Passed) {
      // Send initialized notification
      sendJsonRpc(dockerProcess, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });

      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Send tools/list request
      const toolsListRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      };

      sendJsonRpc(dockerProcess, toolsListRequest);

      try {
        const toolsResponse = await waitForResponse(dockerProcess, 2, 15000);
        const tools = toolsResponse.result?.tools || [];
        toolCount = tools.length;

        check(`tools/list returns 28 tools (got ${toolCount})`, toolCount === 28);

        if (toolCount > 0) {
          const toolNames = tools.map((t) => t.name).sort();
          console.log(`\n  ${BOLD}Registered tools (${toolCount}):${RESET}`);
          for (const name of toolNames) {
            console.log(`    - ${name}`);
          }
          console.log();
        }
      } catch (err) {
        check("tools/list responds inside Docker", false, err.message);
        deploy01Passed = false;
      }
    }
  }

  requirements["DEPLOY-01"] = deploy01Passed && toolCount === 28;

  // ---------------------------------------------------------------
  // DEPLOY-02: Environment Variables Injected Correctly
  // ---------------------------------------------------------------
  console.log(`${BOLD}DEPLOY-02: Environment Variables Injected Correctly${RESET}\n`);

  let deploy02Passed = true;

  // The successful initialize + tools/list already proves env vars work
  // (the server reads PRICELABS_API_KEY and PRICELABS_DB_PATH on startup).
  check("Server initialized with test API key (env var injected)", deploy01Passed);

  if (!deploy01Passed) {
    deploy02Passed = false;
  }

  // Additional check: verify DB path was used inside container.
  // Start a fresh container to check if the data directory exists.
  if (deploy01Passed) {
    try {
      const dataCheck = exec(`docker run --rm ${IMAGE_NAME} ls -la /data/`);
      check("/data/ directory exists inside container", dataCheck.includes("total"), dataCheck.slice(0, 100));
    } catch (err) {
      check("/data/ directory exists inside container", false, err.message?.slice(0, 100));
      deploy02Passed = false;
    }

    // Verify env var default values are set in the image
    try {
      const envCheck = exec(`docker run --rm ${IMAGE_NAME} printenv PRICELABS_DB_PATH`);
      check("PRICELABS_DB_PATH default set in image", envCheck === "/data/pricelabs.sqlite", `value="${envCheck}"`);
    } catch (err) {
      check("PRICELABS_DB_PATH default set in image", false, err.message?.slice(0, 100));
      deploy02Passed = false;
    }

    try {
      const writesCheck = exec(`docker run --rm ${IMAGE_NAME} printenv PRICELABS_WRITES_ENABLED`);
      check("PRICELABS_WRITES_ENABLED defaults to false", writesCheck === "false", `value="${writesCheck}"`);
    } catch (err) {
      check("PRICELABS_WRITES_ENABLED defaults to false", false, err.message?.slice(0, 100));
      deploy02Passed = false;
    }
  }

  requirements["DEPLOY-02"] = deploy02Passed;

  // ---------------------------------------------------------------
  // DEPLOY-03: Skill Files Loaded and Referenced
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}DEPLOY-03: Skill Files Loaded and Referenced${RESET}\n`);

  let deploy03Passed = true;

  const skillFiles = [
    "openclaw/skills/domain-knowledge.md",
    "openclaw/skills/monitoring-protocols.md",
    "openclaw/skills/analysis-playbook.md",
    "openclaw/skills/optimization-playbook.md",
  ];

  // Check host files exist and have content
  for (const skillFile of skillFiles) {
    const fullPath = join(projectRoot, skillFile);
    const exists = existsSync(fullPath);
    let lineCount = 0;
    if (exists) {
      const content = readFileSync(fullPath, "utf-8");
      lineCount = content.split("\n").length;
    }
    check(`${skillFile} exists (${lineCount} lines)`, exists && lineCount > 50);
    if (!exists || lineCount <= 50) deploy03Passed = false;
  }

  // Check openclaw.json references all skill files
  const openclawJsonPath = join(projectRoot, "openclaw", "openclaw.json");
  try {
    const openclawConfig = JSON.parse(readFileSync(openclawJsonPath, "utf-8"));
    const agents = openclawConfig?.agents?.list || [];
    const priceLabsAgent = agents.find((a) => a.id === "pricelabs");
    const instructions = priceLabsAgent?.instructions || [];

    check("openclaw.json has pricelabs agent", !!priceLabsAgent);
    check("Agent has instructions array", Array.isArray(instructions) && instructions.length > 0, `${instructions.length} entries`);

    for (const skillFile of skillFiles) {
      const referenced = instructions.includes(skillFile);
      check(`${skillFile} referenced in instructions`, referenced);
      if (!referenced) deploy03Passed = false;
    }
  } catch (err) {
    check("openclaw.json parses correctly", false, err.message?.slice(0, 100));
    deploy03Passed = false;
  }

  // Verify skill files exist inside the Docker image
  if (deploy01Passed) {
    try {
      const skillList = exec(`docker run --rm ${IMAGE_NAME} ls openclaw/skills/`);
      const filesInContainer = skillList.split("\n").map((f) => f.trim()).filter(Boolean);

      check("Skill files present inside Docker image", filesInContainer.length >= 4, `found: ${filesInContainer.join(", ")}`);

      for (const skillFile of skillFiles) {
        const filename = skillFile.split("/").pop();
        check(`${filename} in container`, filesInContainer.includes(filename));
        if (!filesInContainer.includes(filename)) deploy03Passed = false;
      }
    } catch (err) {
      check("Skill files accessible inside Docker image", false, err.message?.slice(0, 100));
      deploy03Passed = false;
    }
  }

  requirements["DEPLOY-03"] = deploy03Passed;

  // ---------------------------------------------------------------
  // DEPLOY-04: Daily Health Check Cron Jobs Valid
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}DEPLOY-04: Daily Health Check Cron Jobs Valid${RESET}\n`);

  let deploy04Passed = true;

  const cronJobsPath = join(projectRoot, "openclaw", "cron", "jobs.json");
  let cronJobs = [];

  try {
    cronJobs = JSON.parse(readFileSync(cronJobsPath, "utf-8"));
    check("cron/jobs.json parses as JSON array", Array.isArray(cronJobs), `${cronJobs.length} jobs`);
  } catch (err) {
    check("cron/jobs.json parses as JSON array", false, err.message?.slice(0, 100));
    deploy04Passed = false;
  }

  if (Array.isArray(cronJobs) && cronJobs.length > 0) {
    const dailySlack = cronJobs.find((j) => j.name === "daily-portfolio-health-slack");
    const dailyTelegram = cronJobs.find((j) => j.name === "daily-portfolio-health-telegram");

    check("daily-portfolio-health-slack job exists", !!dailySlack);
    check("daily-portfolio-health-telegram job exists", !!dailyTelegram);

    if (!dailySlack || !dailyTelegram) deploy04Passed = false;

    for (const [label, job] of [["Slack", dailySlack], ["Telegram", dailyTelegram]]) {
      if (!job) continue;

      check(`Daily ${label}: schedule.kind === "cron"`, job.schedule?.kind === "cron", `got "${job.schedule?.kind}"`);
      check(`Daily ${label}: schedule.expr === "0 8 * * *"`, job.schedule?.expr === "0 8 * * *", `got "${job.schedule?.expr}"`);
      check(`Daily ${label}: schedule.tz === "America/Chicago"`, job.schedule?.tz === "America/Chicago", `got "${job.schedule?.tz}"`);
      check(`Daily ${label}: payload.kind === "agentTurn"`, job.payload?.kind === "agentTurn", `got "${job.payload?.kind}"`);
      check(`Daily ${label}: payload.message mentions "Daily Health Check Protocol"`, job.payload?.message?.includes("Daily Health Check Protocol"));
      check(`Daily ${label}: delivery.channel === "${label.toLowerCase()}"`, job.delivery?.channel === label.toLowerCase(), `got "${job.delivery?.channel}"`);

      if (job.schedule?.kind !== "cron" || job.schedule?.expr !== "0 8 * * *" || job.schedule?.tz !== "America/Chicago") {
        deploy04Passed = false;
      }
    }

    // Check Telegram stagger
    if (dailyTelegram) {
      check("Daily Telegram: schedule.staggerMs === 30000", dailyTelegram.schedule?.staggerMs === 30000, `got ${dailyTelegram.schedule?.staggerMs}`);
      if (dailyTelegram.schedule?.staggerMs !== 30000) deploy04Passed = false;
    }
  }

  requirements["DEPLOY-04"] = deploy04Passed;

  // ---------------------------------------------------------------
  // DEPLOY-05: Weekly Optimization Cron Jobs Valid
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}DEPLOY-05: Weekly Optimization Cron Jobs Valid${RESET}\n`);

  let deploy05Passed = true;

  if (Array.isArray(cronJobs) && cronJobs.length > 0) {
    const weeklySlack = cronJobs.find((j) => j.name === "weekly-optimization-report-slack");
    const weeklyTelegram = cronJobs.find((j) => j.name === "weekly-optimization-report-telegram");

    check("weekly-optimization-report-slack job exists", !!weeklySlack);
    check("weekly-optimization-report-telegram job exists", !!weeklyTelegram);

    if (!weeklySlack || !weeklyTelegram) deploy05Passed = false;

    for (const [label, job] of [["Slack", weeklySlack], ["Telegram", weeklyTelegram]]) {
      if (!job) continue;

      check(`Weekly ${label}: schedule.kind === "cron"`, job.schedule?.kind === "cron", `got "${job.schedule?.kind}"`);
      check(`Weekly ${label}: schedule.expr === "0 10 * * 1"`, job.schedule?.expr === "0 10 * * 1", `got "${job.schedule?.expr}"`);
      check(`Weekly ${label}: schedule.tz === "America/Chicago"`, job.schedule?.tz === "America/Chicago", `got "${job.schedule?.tz}"`);
      check(`Weekly ${label}: payload.kind === "agentTurn"`, job.payload?.kind === "agentTurn", `got "${job.payload?.kind}"`);
      check(`Weekly ${label}: payload.message mentions "Weekly Optimization Report"`, job.payload?.message?.includes("Weekly Optimization Report") || job.payload?.message?.includes("weekly optimization report"));
      check(`Weekly ${label}: payload.message mentions "Orphan Day Detection"`, job.payload?.message?.includes("Orphan Day Detection") || job.payload?.message?.includes("orphan"));
      check(`Weekly ${label}: delivery.channel === "${label.toLowerCase()}"`, job.delivery?.channel === label.toLowerCase(), `got "${job.delivery?.channel}"`);

      if (job.schedule?.kind !== "cron" || job.schedule?.expr !== "0 10 * * 1" || job.schedule?.tz !== "America/Chicago") {
        deploy05Passed = false;
      }
    }

    // Check Telegram stagger
    if (weeklyTelegram) {
      check("Weekly Telegram: schedule.staggerMs === 30000", weeklyTelegram.schedule?.staggerMs === 30000, `got ${weeklyTelegram.schedule?.staggerMs}`);
      if (weeklyTelegram.schedule?.staggerMs !== 30000) deploy05Passed = false;
    }
  } else {
    check("Cron jobs available for weekly validation", false, "no jobs parsed");
    deploy05Passed = false;
  }

  requirements["DEPLOY-05"] = deploy05Passed;

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}=== Phase 9: OpenClaw Deployment Validation ===${RESET}\n`);

  const reqEntries = Object.entries(requirements);
  const reqLabels = {
    "DEPLOY-01": "MCP Server in Docker",
    "DEPLOY-02": "Environment Variables",
    "DEPLOY-03": "Skills Loaded",
    "DEPLOY-04": "Daily Cron Jobs",
    "DEPLOY-05": "Weekly Cron Jobs",
  };

  let reqPassed = 0;
  let reqFailed = 0;

  for (const [reqId, passed] of reqEntries) {
    const status = passed ? PASS : FAIL;
    const label = reqLabels[reqId] || reqId;
    console.log(`  ${BOLD}${reqId}:${RESET} ${label.padEnd(25)} ${status}`);
    if (passed) reqPassed++;
    else reqFailed++;
  }

  console.log(`  --`);
  console.log(`  Total: ${GREEN}${reqPassed}${RESET}/${reqEntries.length} passed, ${reqFailed > 0 ? RED : ""}${reqFailed}${reqFailed > 0 ? RESET : ""} failed`);
  console.log(`  Checks: ${GREEN}${passes}${RESET} passed, ${RED}${failures}${RESET} failed\n`);

  if (failures === 0) {
    console.log(`  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} -- Phase 9 deployment validation complete.\n`);
  } else {
    console.log(`  ${RED}${BOLD}${failures} CHECK(S) FAILED${RESET} -- see above for details.\n`);
  }
} finally {
  // Clean up Docker process
  if (dockerProcess) {
    try {
      dockerProcess.stdin.end();
      dockerProcess.kill("SIGTERM");
    } catch { /* ignore */ }

    // Give it a moment to shut down
    await new Promise((r) => setTimeout(r, 1000));

    if (dockerProcess && !dockerProcess.killed) {
      try { dockerProcess.kill("SIGKILL"); } catch { /* ignore */ }
    }
  }

  // Clean up container (in case it's still running)
  try { execSync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null`, { stdio: "pipe" }); } catch { /* ignore */ }

  // Optionally clean up image -- uncomment for full cleanup, leave commented for faster re-runs
  // try { execSync(`docker rmi ${IMAGE_NAME} 2>/dev/null`, { stdio: "pipe" }); } catch { /* ignore */ }
}

process.exit(failures > 0 ? 1 : 0);
