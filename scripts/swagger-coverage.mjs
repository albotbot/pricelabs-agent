/**
 * PriceLabs Swagger API Coverage Report
 *
 * Static analysis script comparing implemented MCP tools against the
 * PriceLabs Swagger API specification (v1.0.0-oas3).
 *
 * No API calls -- pure static comparison of hardcoded endpoint/tool lists
 * derived from https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3
 * and the MCP server tool registrations in mcp-servers/pricelabs/src/tools/*.ts.
 *
 * Usage: node scripts/swagger-coverage.mjs
 */

// --- ANSI colors ---
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// ---------------------------------------------------------------
// PriceLabs Swagger API Endpoints
// Source: https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3
// ---------------------------------------------------------------

const SWAGGER_ENDPOINTS = [
  { method: "GET", path: "/v1/listings", description: "Get all listings" },
  { method: "GET", path: "/v1/listings/{id}", description: "Get single listing" },
  { method: "POST", path: "/v1/listings", description: "Update listings" },
  { method: "POST", path: "/v1/listing_prices", description: "Get prices for a listing" },
  { method: "GET", path: "/v1/neighborhood_data", description: "Get neighborhood comparison data" },
  { method: "GET", path: "/v1/reservation_data", description: "Get reservations" },
  { method: "GET", path: "/v1/fetch_rate_plans", description: "Get rate plans" },
  { method: "POST", path: "/v1/push_prices", description: "Push prices to PMS" },
  { method: "GET", path: "/v1/overrides", description: "Get price overrides" },
  { method: "POST", path: "/v1/overrides", description: "Set price overrides" },
  { method: "DELETE", path: "/v1/overrides", description: "Delete price overrides" },
  { method: "POST", path: "/v1/add_listing_data", description: "Add listing (BookingSync only)" },
];

// ---------------------------------------------------------------
// Implemented MCP Tools -> API Endpoint Mapping
// Source: mcp-servers/pricelabs/src/tools/*.ts (tool registrations)
// ---------------------------------------------------------------

const API_BACKED_TOOLS = [
  { tool: "pricelabs_get_listings", method: "GET", path: "/v1/listings", source: "tools/listings.ts" },
  { tool: "pricelabs_get_listing", method: "GET", path: "/v1/listings/{id}", source: "tools/listings.ts" },
  { tool: "pricelabs_update_listings", method: "POST", path: "/v1/listings", source: "tools/listings.ts" },
  { tool: "pricelabs_get_prices", method: "POST", path: "/v1/listing_prices", source: "tools/prices.ts" },
  { tool: "pricelabs_get_neighborhood", method: "GET", path: "/v1/neighborhood_data", source: "tools/neighborhood.ts" },
  { tool: "pricelabs_get_reservations", method: "GET", path: "/v1/reservation_data", source: "tools/reservations.ts" },
  { tool: "pricelabs_get_rate_plans", method: "GET", path: "/v1/fetch_rate_plans", source: "tools/rate-plans.ts" },
  { tool: "pricelabs_push_prices", method: "POST", path: "/v1/push_prices", source: "tools/sync.ts" },
  { tool: "pricelabs_get_overrides", method: "GET", path: "/v1/overrides", source: "tools/overrides.ts" },
  { tool: "pricelabs_set_overrides", method: "POST", path: "/v1/overrides", source: "tools/overrides.ts" },
  { tool: "pricelabs_delete_overrides", method: "DELETE", path: "/v1/overrides", source: "tools/overrides.ts" },
  { tool: "pricelabs_add_listing", method: "POST", path: "/v1/add_listing_data", source: "tools/sync.ts" },
];

// ---------------------------------------------------------------
// Internal MCP Tools (no external API endpoint)
// Source: mcp-servers/pricelabs/src/tools/*.ts
// ---------------------------------------------------------------

const INTERNAL_TOOLS = [
  { tool: "pricelabs_get_api_status", category: "Server Status", description: "Rate limit + cache monitoring", source: "tools/status.ts" },
  { tool: "pricelabs_store_daily_snapshots", category: "SQLite Persistence", description: "Store listing snapshots", source: "tools/snapshots.ts" },
  { tool: "pricelabs_store_price_snapshots", category: "SQLite Persistence", description: "Store price snapshots", source: "tools/snapshots.ts" },
  { tool: "pricelabs_store_reservations", category: "SQLite Persistence", description: "Upsert reservation data", source: "tools/snapshots.ts" },
  { tool: "pricelabs_store_market_snapshot", category: "SQLite Persistence", description: "Store neighborhood/market data", source: "tools/snapshots.ts" },
  { tool: "pricelabs_get_snapshots", category: "SQLite Query", description: "Query historical snapshots", source: "tools/snapshots.ts" },
  { tool: "pricelabs_get_booking_pace", category: "SQLite Analysis", description: "Calculate booking pace vs STLY", source: "tools/monitoring.ts" },
  { tool: "pricelabs_log_action", category: "SQLite Audit", description: "Record agent actions", source: "tools/audit.ts" },
  { tool: "pricelabs_get_audit_log", category: "SQLite Audit", description: "Retrieve audit trail", source: "tools/audit.ts" },
  { tool: "pricelabs_get_portfolio_kpis", category: "SQLite Analysis", description: "Portfolio KPIs with WoW/STLY", source: "tools/analysis.ts" },
  { tool: "pricelabs_detect_underperformers", category: "SQLite Analysis", description: "Flag underperforming listings", source: "tools/analysis.ts" },
  { tool: "pricelabs_snapshot_before_write", category: "Safety", description: "Pre-write state capture (API + SQLite)", source: "tools/optimization.ts" },
  { tool: "pricelabs_record_change", category: "SQLite Tracking", description: "Record executed pricing changes", source: "tools/scale.ts" },
  { tool: "pricelabs_get_change_impact", category: "SQLite Tracking", description: "Query revenue impact assessments", source: "tools/scale.ts" },
  { tool: "pricelabs_get_user_config", category: "SQLite Config", description: "Read alert thresholds", source: "tools/scale.ts" },
  { tool: "pricelabs_set_user_config", category: "SQLite Config", description: "Set alert thresholds", source: "tools/scale.ts" },
];

// ---------------------------------------------------------------
// Generate Report
// ---------------------------------------------------------------

console.log(`\n${BOLD}=== PriceLabs API Coverage Report ===${RESET}\n`);

// --- Swagger Endpoint Coverage ---
console.log(`${BOLD}Swagger API Endpoints (${SWAGGER_ENDPOINTS.length} total):${RESET}\n`);

let coveredCount = 0;
const missingEndpoints = [];

for (const endpoint of SWAGGER_ENDPOINTS) {
  const key = `${endpoint.method} ${endpoint.path}`;
  const matchingTool = API_BACKED_TOOLS.find(
    (t) => t.method === endpoint.method && t.path === endpoint.path
  );

  if (matchingTool) {
    coveredCount++;
    const padMethod = endpoint.method.padEnd(6);
    const padPath = endpoint.path.padEnd(28);
    console.log(`  ${GREEN}COVERED${RESET}   ${padMethod} ${padPath} -> ${matchingTool.tool}`);
  } else {
    missingEndpoints.push(endpoint);
    const padMethod = endpoint.method.padEnd(6);
    const padPath = endpoint.path.padEnd(28);
    console.log(`  ${RED}MISSING${RESET}   ${padMethod} ${padPath} -- ${endpoint.description}`);
  }
}

const coveragePct = Math.round((coveredCount / SWAGGER_ENDPOINTS.length) * 100);
console.log(`\n  ${BOLD}Coverage: ${coveredCount}/${SWAGGER_ENDPOINTS.length} endpoints implemented (${coveragePct}%)${RESET}`);

if (coveredCount === SWAGGER_ENDPOINTS.length) {
  console.log(`  ${GREEN}All Swagger endpoints have corresponding MCP tools.${RESET}`);
}

// --- Internal MCP Tools ---
console.log(`\n${BOLD}MCP Tools Beyond API (${INTERNAL_TOOLS.length} internal tools):${RESET}\n`);

// Group by category
const categories = {};
for (const tool of INTERNAL_TOOLS) {
  if (!categories[tool.category]) {
    categories[tool.category] = [];
  }
  categories[tool.category].push(tool);
}

for (const [category, tools] of Object.entries(categories)) {
  console.log(`  ${CYAN}${category}:${RESET}`);
  for (const tool of tools) {
    const padTool = tool.tool.padEnd(40);
    console.log(`    ${DIM}${padTool}${RESET} ${tool.description}`);
  }
}

// --- Totals ---
const totalTools = API_BACKED_TOOLS.length + INTERNAL_TOOLS.length;
console.log(`\n${BOLD}Total MCP Tools: ${totalTools} (${API_BACKED_TOOLS.length} API-backed + ${INTERNAL_TOOLS.length} internal)${RESET}`);

// --- Missing Endpoints ---
console.log(`\n${BOLD}Missing Endpoints:${RESET}`);
if (missingEndpoints.length === 0) {
  console.log(`  ${GREEN}None -- all Swagger API endpoints are implemented.${RESET}`);
} else {
  for (const ep of missingEndpoints) {
    console.log(`  ${RED}${ep.method} ${ep.path}${RESET} -- ${ep.description}`);
  }
}

// --- Recommendation ---
console.log(`\n${BOLD}Recommendation:${RESET}`);
if (coveragePct === 100) {
  console.log(`  ${GREEN}All Swagger endpoints have corresponding MCP tools. No expansion needed.${RESET}`);
  console.log(`  The ${INTERNAL_TOOLS.length} internal tools provide analytics, persistence, and safety capabilities`);
  console.log(`  beyond the base API, enabling portfolio monitoring and optimization workflows.`);
} else {
  console.log(`  ${YELLOW}${missingEndpoints.length} endpoint(s) not yet implemented.${RESET}`);
  console.log(`  Consider adding in a future phase (deferred per user decision).`);
  console.log(`  Missing endpoints:`);
  for (const ep of missingEndpoints) {
    console.log(`    - ${ep.method} ${ep.path}: ${ep.description}`);
  }
}

console.log("");
