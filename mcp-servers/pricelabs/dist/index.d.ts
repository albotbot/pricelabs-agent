/**
 * PriceLabs MCP Server entry point.
 *
 * Wires all 13 tools (8 registration functions) to a single MCP server
 * connected via stdio transport. Validates environment on startup and
 * exits with actionable error if PRICELABS_API_KEY is missing.
 *
 * Uses top-level await (ES2022 + NodeNext). All imports use .js extensions
 * for ESM compatibility.
 */
export {};
