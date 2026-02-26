// SAFE-03: No bugs discovered during messaging validation. All 67 config checks
// passed on first run (2026-02-26). Channel configuration, cron job targeting,
// protocol name cross-references, health summary format, approval flow config,
// and env var inventory all validated without any fixes needed.

/**
 * Messaging integration validation script for Phase 10 requirements.
 *
 * Proves MSG-01, MSG-04, and SAFE-03 config-level requirements:
 *   MSG-01: Slack health summaries -- channel config, cron targeting, protocol refs
 *   MSG-04: Telegram health summaries -- channel config, cron targeting, protocol refs
 *   SAFE-03: Bug fixes discovered during validation (documented above)
 *
 * Validates 6 sections:
 *   1. Channel Configuration (openclaw.json)
 *   2. Cron Job Targeting (jobs.json)
 *   3. Protocol Name Matching (cron messages -> skill file headings)
 *   4. Health Summary Format (monitoring-protocols.md content requirements)
 *   5. Approval Flow Configuration (threadReply, write safety, recommendations)
 *   6. Environment Variable Inventory (all ${VAR} references)
 *
 * Reads JSON and markdown files from disk -- no network calls, no Docker, no MCP
 * server spawn needed.
 *
 * Usage: node scripts/validate-messaging.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- ANSI colors ---
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const PASS_TAG = `${GREEN}PASS${RESET}`;
const FAIL_TAG = `${RED}FAIL${RESET}`;
const INFO_TAG = `${CYAN}INFO${RESET}`;

let failures = 0;
let passes = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  [${PASS_TAG}] ${label}${detail ? ` -- ${detail}` : ""}`);
    passes++;
  } else {
    console.log(`  [${FAIL_TAG}] ${label}${detail ? ` -- ${detail}` : ""}`);
    failures++;
  }
}

function info(label, detail = "") {
  console.log(`  [${INFO_TAG}] ${label}${detail ? ` -- ${detail}` : ""}`);
}

function section(num, title) {
  console.log(`\n${BOLD}=== Section ${num}: ${title} ===${RESET}\n`);
}

// --- Helpers ---

function readJson(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

function readText(filePath) {
  return readFileSync(filePath, "utf-8");
}

/**
 * Extract all ## headings from a markdown file.
 */
function extractH2Headings(markdownContent) {
  const lines = markdownContent.split("\n");
  return lines
    .filter((line) => /^## /.test(line))
    .map((line) => line.replace(/^## /, "").trim());
}

/**
 * Check if a specific ## heading exists in markdown content.
 */
function hasH2Heading(markdownContent, headingText) {
  const headings = extractH2Headings(markdownContent);
  return headings.some((h) => h === headingText);
}

/**
 * Extract all ${VAR} references from a string.
 */
function extractEnvVarRefs(content) {
  const matches = content.match(/\$\{([A-Z_][A-Z0-9_]*)\}/g) || [];
  return matches.map((m) => m.replace(/\$\{|\}/g, ""));
}

// --- Main validation ---

const projectRoot = join(import.meta.dirname, "..");

console.log(`\n${BOLD}=== Phase 10: Messaging Integration Validation ===${RESET}`);

// Load source files
const openclawJsonPath = join(projectRoot, "openclaw", "openclaw.json");
const cronJobsPath = join(projectRoot, "openclaw", "cron", "jobs.json");
const monitoringPath = join(projectRoot, "openclaw", "skills", "monitoring-protocols.md");
const analysisPath = join(projectRoot, "openclaw", "skills", "analysis-playbook.md");
const optimizationPath = join(projectRoot, "openclaw", "skills", "optimization-playbook.md");
const domainPath = join(projectRoot, "openclaw", "skills", "domain-knowledge.md");

let openclawConfig;
let cronJobs;
let monitoringContent;
let analysisContent;
let optimizationContent;
let domainContent;

try {
  openclawConfig = readJson(openclawJsonPath);
  cronJobs = readJson(cronJobsPath);
  monitoringContent = readText(monitoringPath);
  analysisContent = readText(analysisPath);
  optimizationContent = readText(optimizationPath);
  domainContent = readText(domainPath);
} catch (err) {
  console.log(`\n  ${RED}${BOLD}ERROR${RESET}  Failed to load source files: ${err.message}`);
  process.exit(1);
}

// ===================================================================
// Section 1: Channel Configuration
// ===================================================================
section(1, "Channel Configuration");

const channels = openclawConfig.channels || {};
const slackConfig = channels.slack || {};
const telegramConfig = channels.telegram || {};

// Slack checks
check("Slack channel config exists", !!channels.slack);
check("Slack enabled", slackConfig.enabled === true, `got ${slackConfig.enabled}`);
check("Slack socketMode enabled", slackConfig.socketMode === true, `got ${slackConfig.socketMode}`);
check("Slack threadReply enabled", slackConfig.threadReply === true, `got ${slackConfig.threadReply}`);
check(
  "Slack appToken references ${SLACK_APP_TOKEN}",
  slackConfig.appToken === "${SLACK_APP_TOKEN}",
  `got "${slackConfig.appToken}"`
);
check(
  "Slack botToken references ${SLACK_BOT_TOKEN}",
  slackConfig.botToken === "${SLACK_BOT_TOKEN}",
  `got "${slackConfig.botToken}"`
);

// Telegram checks
check("Telegram channel config exists", !!channels.telegram);
check("Telegram enabled", telegramConfig.enabled === true, `got ${telegramConfig.enabled}`);
check(
  "Telegram botToken references ${TELEGRAM_BOT_TOKEN}",
  telegramConfig.botToken === "${TELEGRAM_BOT_TOKEN}",
  `got "${telegramConfig.botToken}"`
);
check(
  "Telegram groups requireMention enabled",
  telegramConfig.groups?.requireMention === true,
  `got ${telegramConfig.groups?.requireMention}`
);

// Session/DM scope
const sessionDefaults = openclawConfig.agents?.defaults?.session || {};
check(
  "Agent session dmScope is per-channel-peer",
  sessionDefaults.dmScope === "per-channel-peer",
  `got "${sessionDefaults.dmScope}"`
);

// ===================================================================
// Section 2: Cron Job Targeting
// ===================================================================
section(2, "Cron Job Targeting");

check("jobs.json is an array", Array.isArray(cronJobs), `${cronJobs.length} jobs`);
check("4 cron jobs defined", cronJobs.length === 4, `got ${cronJobs.length}`);

const dailySlack = cronJobs.find((j) => j.name === "daily-portfolio-health-slack");
const dailyTelegram = cronJobs.find((j) => j.name === "daily-portfolio-health-telegram");
const weeklySlack = cronJobs.find((j) => j.name === "weekly-optimization-report-slack");
const weeklyTelegram = cronJobs.find((j) => j.name === "weekly-optimization-report-telegram");

check("daily-portfolio-health-slack exists", !!dailySlack);
check("daily-portfolio-health-telegram exists", !!dailyTelegram);
check("weekly-optimization-report-slack exists", !!weeklySlack);
check("weekly-optimization-report-telegram exists", !!weeklyTelegram);

// Daily Slack
if (dailySlack) {
  check("Daily Slack: schedule 0 8 * * *", dailySlack.schedule?.expr === "0 8 * * *", `got "${dailySlack.schedule?.expr}"`);
  check("Daily Slack: tz America/Chicago", dailySlack.schedule?.tz === "America/Chicago", `got "${dailySlack.schedule?.tz}"`);
  check("Daily Slack: channel slack", dailySlack.delivery?.channel === "slack", `got "${dailySlack.delivery?.channel}"`);
  check("Daily Slack: staggerMs 0", dailySlack.schedule?.staggerMs === 0, `got ${dailySlack.schedule?.staggerMs}`);
  check("Daily Slack: sessionTarget isolated", dailySlack.sessionTarget === "isolated", `got "${dailySlack.sessionTarget}"`);
  check("Daily Slack: delivery.bestEffort true", dailySlack.delivery?.bestEffort === true, `got ${dailySlack.delivery?.bestEffort}`);
}

// Daily Telegram
if (dailyTelegram) {
  check("Daily Telegram: schedule 0 8 * * *", dailyTelegram.schedule?.expr === "0 8 * * *", `got "${dailyTelegram.schedule?.expr}"`);
  check("Daily Telegram: tz America/Chicago", dailyTelegram.schedule?.tz === "America/Chicago", `got "${dailyTelegram.schedule?.tz}"`);
  check("Daily Telegram: channel telegram", dailyTelegram.delivery?.channel === "telegram", `got "${dailyTelegram.delivery?.channel}"`);
  check("Daily Telegram: staggerMs 30000", dailyTelegram.schedule?.staggerMs === 30000, `got ${dailyTelegram.schedule?.staggerMs}`);
  check("Daily Telegram: sessionTarget isolated", dailyTelegram.sessionTarget === "isolated", `got "${dailyTelegram.sessionTarget}"`);
  check("Daily Telegram: delivery.bestEffort true", dailyTelegram.delivery?.bestEffort === true, `got ${dailyTelegram.delivery?.bestEffort}`);
}

// Weekly Slack
if (weeklySlack) {
  check("Weekly Slack: schedule 0 10 * * 1", weeklySlack.schedule?.expr === "0 10 * * 1", `got "${weeklySlack.schedule?.expr}"`);
  check("Weekly Slack: tz America/Chicago", weeklySlack.schedule?.tz === "America/Chicago", `got "${weeklySlack.schedule?.tz}"`);
  check("Weekly Slack: channel slack", weeklySlack.delivery?.channel === "slack", `got "${weeklySlack.delivery?.channel}"`);
  check("Weekly Slack: staggerMs 0", weeklySlack.schedule?.staggerMs === 0, `got ${weeklySlack.schedule?.staggerMs}`);
  check("Weekly Slack: sessionTarget isolated", weeklySlack.sessionTarget === "isolated", `got "${weeklySlack.sessionTarget}"`);
  check("Weekly Slack: delivery.bestEffort true", weeklySlack.delivery?.bestEffort === true, `got ${weeklySlack.delivery?.bestEffort}`);
}

// Weekly Telegram
if (weeklyTelegram) {
  check("Weekly Telegram: schedule 0 10 * * 1", weeklyTelegram.schedule?.expr === "0 10 * * 1", `got "${weeklyTelegram.schedule?.expr}"`);
  check("Weekly Telegram: tz America/Chicago", weeklyTelegram.schedule?.tz === "America/Chicago", `got "${weeklyTelegram.schedule?.tz}"`);
  check("Weekly Telegram: channel telegram", weeklyTelegram.delivery?.channel === "telegram", `got "${weeklyTelegram.delivery?.channel}"`);
  check("Weekly Telegram: staggerMs 30000", weeklyTelegram.schedule?.staggerMs === 30000, `got ${weeklyTelegram.schedule?.staggerMs}`);
  check("Weekly Telegram: sessionTarget isolated", weeklyTelegram.sessionTarget === "isolated", `got "${weeklyTelegram.sessionTarget}"`);
  check("Weekly Telegram: delivery.bestEffort true", weeklyTelegram.delivery?.bestEffort === true, `got ${weeklyTelegram.delivery?.bestEffort}`);
}

// ===================================================================
// Section 3: Protocol Name Matching
// ===================================================================
section(3, "Protocol Name Matching");

info("Cross-referencing cron job payload.message against skill file ## headings");

// Build a map of skill file contents for protocol lookup
const skillFiles = {
  "monitoring-protocols.md": monitoringContent,
  "analysis-playbook.md": analysisContent,
  "optimization-playbook.md": optimizationContent,
  "domain-knowledge.md": domainContent,
};

// Show available headings per skill file for reference
for (const [file, content] of Object.entries(skillFiles)) {
  const headings = extractH2Headings(content);
  info(`${file}: ${headings.length} protocol headings`, headings.join(", "));
}

console.log();

// Daily cron protocol references
info("Daily cron protocol references:");

const dailyMessage = dailySlack?.payload?.message || "";

// "Daily Health Check Protocol" -> monitoring-protocols.md
check(
  '"Daily Health Check Protocol" in monitoring-protocols.md',
  dailyMessage.includes("Daily Health Check Protocol") &&
    hasH2Heading(monitoringContent, "Daily Health Check Protocol")
);

// "Cancellation Fill Strategy Protocol" -> optimization-playbook.md
check(
  '"Cancellation Fill Strategy Protocol" in optimization-playbook.md',
  dailyMessage.includes("Cancellation Fill Strategy Protocol") &&
    hasH2Heading(optimizationContent, "Cancellation Fill Strategy Protocol")
);

// "revenue impact assessments" -> references Revenue Impact Assessment Protocol in monitoring-protocols.md
check(
  '"Revenue Impact Assessment Protocol" in monitoring-protocols.md (referenced via "revenue impact assessments")',
  dailyMessage.includes("revenue impact assessments") &&
    hasH2Heading(monitoringContent, "Revenue Impact Assessment Protocol")
);

console.log();

// Weekly cron protocol references
info("Weekly cron protocol references:");

const weeklyMessage = weeklySlack?.payload?.message || "";

// "Weekly Optimization Report Protocol" -> analysis-playbook.md
check(
  '"Weekly Optimization Report Protocol" in analysis-playbook.md',
  weeklyMessage.includes("Weekly Optimization Report Protocol") &&
    hasH2Heading(analysisContent, "Weekly Optimization Report Protocol")
);

// "Orphan Day Detection Protocol" -> optimization-playbook.md
check(
  '"Orphan Day Detection Protocol" in optimization-playbook.md',
  weeklyMessage.includes("Orphan Day Detection Protocol") &&
    hasH2Heading(optimizationContent, "Orphan Day Detection Protocol")
);

// "Demand Spike Detection Protocol" -> optimization-playbook.md
check(
  '"Demand Spike Detection Protocol" in optimization-playbook.md',
  weeklyMessage.includes("Demand Spike Detection Protocol") &&
    hasH2Heading(optimizationContent, "Demand Spike Detection Protocol")
);

// "Base Price Calibration Check" -> optimization-playbook.md
check(
  '"Base Price Calibration Check" in optimization-playbook.md',
  weeklyMessage.includes("Base Price Calibration Check") &&
    hasH2Heading(optimizationContent, "Base Price Calibration Check")
);

// "Recommendation Prioritization" -> optimization-playbook.md
check(
  '"Recommendation Prioritization" in optimization-playbook.md',
  weeklyMessage.includes("Recommendation Prioritization") &&
    hasH2Heading(optimizationContent, "Recommendation Prioritization")
);

// ===================================================================
// Section 4: Health Summary Format Validation
// ===================================================================
section(4, "Health Summary Format Validation");

info("Validating Daily Health Check Protocol contains required format elements");

// Parse the Daily Health Check Protocol section from monitoring-protocols.md
const dhcpStart = monitoringContent.indexOf("## Daily Health Check Protocol");
const dhcpEnd = monitoringContent.indexOf("\n## ", dhcpStart + 1);
const dhcpContent = monitoringContent.slice(dhcpStart, dhcpEnd > -1 ? dhcpEnd : undefined);

// Portfolio count line
check(
  'Format: Portfolio count line ("Portfolio: {n} listings active")',
  dhcpContent.includes("Portfolio:") && dhcpContent.includes("listings active")
);

// Sync status line
check(
  'Format: Sync status line ("Sync Status:")',
  dhcpContent.includes("Sync Status:")
);

// Occupancy line
check(
  'Format: Occupancy line ("Avg Occupancy")',
  dhcpContent.includes("Avg Occupancy")
);

// Revenue line
check(
  'Format: Revenue line ("Revenue (past 7d)")',
  dhcpContent.includes("Revenue (past 7d)")
);

// Three severity tiers
check(
  'Format: Critical Alerts tier ("Critical Alerts:")',
  dhcpContent.includes("Critical Alerts:")
);

check(
  'Format: Warnings tier ("Warnings:")',
  dhcpContent.includes("Warnings:")
);

check(
  'Format: Opportunities tier ("Opportunities:")',
  dhcpContent.includes("Opportunities:")
);

// ===================================================================
// Section 5: Approval Flow Configuration
// ===================================================================
section(5, "Approval Flow Configuration");

// Slack threadReply (already validated in Section 1, re-confirm for approval context)
check(
  "Slack threadReply true (replies go to thread for approval context)",
  slackConfig.threadReply === true
);

// optimization-playbook.md contains recommendation output format
check(
  "optimization-playbook.md has Recommendation Prioritization section",
  hasH2Heading(optimizationContent, "Recommendation Prioritization")
);

// Check that the recommendation section mentions "Approval Required"
const recSection = optimizationContent.slice(
  optimizationContent.indexOf("## Recommendation Prioritization")
);
check(
  'Recommendation section includes "Approval Required" prompt',
  recSection.includes("Approval Required"),
  "guides agent to request owner approval"
);

// domain-knowledge.md references write safety gate
check(
  "domain-knowledge.md references write safety gate",
  domainContent.includes("PRICELABS_WRITES_ENABLED") &&
    domainContent.includes("Write Safety"),
  "documents write gate in agent instructions"
);

// PRICELABS_WRITES_ENABLED is "false" in openclaw.json MCP server env
const agents = openclawConfig.agents?.list || [];
const priceLabsAgent = agents.find((a) => a.id === "pricelabs");
const mcpEnv = priceLabsAgent?.mcp?.servers?.[0]?.env || {};
check(
  'PRICELABS_WRITES_ENABLED set to "false" in openclaw.json MCP env',
  mcpEnv.PRICELABS_WRITES_ENABLED === "false",
  `got "${mcpEnv.PRICELABS_WRITES_ENABLED}"`
);

// ===================================================================
// Section 6: Environment Variable Inventory
// ===================================================================
section(6, "Environment Variable Inventory");

// Collect all ${VAR} references from openclaw.json and jobs.json
const openclawJsonRaw = readFileSync(openclawJsonPath, "utf-8");
const cronJobsRaw = readFileSync(cronJobsPath, "utf-8");

const openclawVars = extractEnvVarRefs(openclawJsonRaw);
const cronVars = extractEnvVarRefs(cronJobsRaw);

const allVars = [...new Set([...openclawVars, ...cronVars])].sort();

info(`Found ${allVars.length} unique env var references across config files`);
console.log();

// Build source map
const varSourceMap = {};
for (const v of allVars) {
  varSourceMap[v] = [];
  if (openclawVars.includes(v)) varSourceMap[v].push("openclaw.json");
  if (cronVars.includes(v)) varSourceMap[v].push("jobs.json");
}

// Display env var inventory table
console.log(`  ${BOLD}Environment Variable Inventory:${RESET}`);
console.log(`  ${"Env Var".padEnd(30)} ${"Source(s)".padEnd(35)} Category`);
console.log(`  ${"─".repeat(30)} ${"─".repeat(35)} ${"─".repeat(15)}`);

const messagingVars = [
  "SLACK_APP_TOKEN",
  "SLACK_BOT_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "SLACK_HEALTH_CHANNEL",
  "TELEGRAM_HEALTH_CHAT_ID",
];

const infraVars = [
  "OPENCLAW_GATEWAY_TOKEN",
  "PRICELABS_API_KEY",
];

for (const v of allVars) {
  const sources = varSourceMap[v].join(", ");
  const category = messagingVars.includes(v)
    ? "messaging"
    : infraVars.includes(v)
      ? "infrastructure"
      : "agent";
  console.log(`  ${v.padEnd(30)} ${sources.padEnd(35)} ${category}`);
}

console.log();

// Verify expected messaging env vars exist
const expectedMessagingVars = [
  { name: "SLACK_APP_TOKEN", source: "openclaw.json channels.slack" },
  { name: "SLACK_BOT_TOKEN", source: "openclaw.json channels.slack" },
  { name: "TELEGRAM_BOT_TOKEN", source: "openclaw.json channels.telegram" },
  { name: "SLACK_HEALTH_CHANNEL", source: "jobs.json daily/weekly slack delivery.to" },
  { name: "TELEGRAM_HEALTH_CHAT_ID", source: "jobs.json daily/weekly telegram delivery.to" },
];

for (const { name, source } of expectedMessagingVars) {
  check(
    `${name} referenced (${source})`,
    allVars.includes(name),
    `found in: ${varSourceMap[name]?.join(", ") || "nowhere"}`
  );
}

check(
  `Total unique env vars: ${allVars.length}`,
  allVars.length > 0
);

// ===================================================================
// Results Summary
// ===================================================================

console.log(`\n${BOLD}=== RESULTS ===${RESET}\n`);
console.log(`  Passed: ${GREEN}${passes}${RESET}/${passes + failures}`);
console.log(`  Failed: ${failures > 0 ? RED : ""}${failures}${failures > 0 ? RESET : ""}`);
console.log();

if (failures === 0) {
  console.log(`  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} -- Phase 10 messaging integration validation complete.\n`);
} else {
  console.log(`  ${RED}${BOLD}${failures} CHECK(S) FAILED${RESET} -- see above for details.\n`);
}

process.exit(failures > 0 ? 1 : 0);
