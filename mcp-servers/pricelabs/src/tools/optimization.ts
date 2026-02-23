/**
 * Optimization MCP tools: pricelabs_snapshot_before_write.
 *
 * Captures current listing state (base/min/max prices, currency) and
 * existing overrides before a write operation. Stores the snapshot in
 * the audit log for rollback capability.
 *
 * Supports requirements: OPT-03 (pre-write snapshot for rollback).
 *
 * @module tools/optimization
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
import type { Listing, OverrideEntry } from "../types.js";
import { SnapshotBeforeWriteInputSchema } from "../schemas/optimization.js";
import { createAuditLogQueries } from "../db/queries/audit-log.js";
import { fetchWithFallback } from "../services/fetch-with-fallback.js";

/** Cache TTL for snapshot data: 5 minutes */
const SNAPSHOT_CACHE_TTL_MS = 300_000;

/**
 * Register optimization MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_snapshot_before_write (capture listing state before write)
 *
 * @param server - MCP server instance
 * @param db - An open better-sqlite3 Database instance (with migrations applied)
 * @param apiClient - PriceLabs API client for fetching listing data
 * @param cache - TtlCache instance for caching API responses
 * @param rateLimiter - TokenBucketRateLimiter for rate limit status
 */
export function registerOptimizationTools(
  server: McpServer,
  db: Database.Database,
  apiClient: PriceLabsApiClient,
  cache: TtlCache,
  rateLimiter: TokenBucketRateLimiter,
): void {
  const auditQueries = createAuditLogQueries(db);

  // --- pricelabs_snapshot_before_write ---

  server.registerTool(
    "pricelabs_snapshot_before_write",
    {
      description:
        "Capture current listing state (base/min/max prices, currency) and existing overrides before a write operation. MUST be called before every pricelabs_set_overrides, pricelabs_update_listings, or pricelabs_delete_overrides call. Returns a structured snapshot and stores it in the audit log for rollback capability.",
      inputSchema: SnapshotBeforeWriteInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        // a. Fetch current listing data
        const listingCacheKey = `listing:${params.listing_id}:${params.pms}`;
        const listingResponse = await fetchWithFallback<Listing>(
          listingCacheKey,
          () =>
            apiClient
              .get<Listing>(
                `/v1/listings/${params.listing_id}?pms=${encodeURIComponent(params.pms)}`,
              )
              .then((r) => r.data),
          cache,
          rateLimiter,
          SNAPSHOT_CACHE_TTL_MS,
        );
        const listing = listingResponse.data;

        // b. Fetch existing overrides if date range provided
        let existingOverrides: OverrideEntry[] = [];
        if (params.start_date && params.end_date) {
          const overridesCacheKey = `overrides:${params.listing_id}:${params.pms}:${params.start_date}:${params.end_date}`;
          const overridesResponse = await fetchWithFallback<OverrideEntry[]>(
            overridesCacheKey,
            () =>
              apiClient
                .get<OverrideEntry[]>(
                  `/v1/listings/${params.listing_id}/overrides?pms=${encodeURIComponent(params.pms)}&start_date=${params.start_date}&end_date=${params.end_date}`,
                )
                .then((r) => r.data),
            cache,
            rateLimiter,
            SNAPSHOT_CACHE_TTL_MS,
          );
          existingOverrides = overridesResponse.data;
        }

        // c. Build snapshot object
        const snapshot = {
          snapshot_type: params.operation_type,
          listing_id: params.listing_id,
          pms: params.pms,
          captured_at: new Date().toISOString(),
          listing_state: {
            base_price: listing.base ?? null,
            min_price: listing.min ?? null,
            max_price: listing.max ?? null,
            currency: listing.currency ?? null,
          },
          existing_overrides: existingOverrides,
        };

        // d. Store in audit log
        auditQueries.insertEntry.run({
          action_type: "snapshot",
          listing_id: params.listing_id,
          pms: params.pms,
          description: `Pre-write snapshot before ${params.operation_type}`,
          details_json: JSON.stringify(snapshot),
          channel: params.channel ?? null,
        });

        // e. Return snapshot as JSON
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: message }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
