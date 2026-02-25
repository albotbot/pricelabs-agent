/**
 * Snapshot MCP tools: store_daily_snapshots, store_price_snapshots,
 * store_reservations, get_snapshots, store_market_snapshot.
 *
 * Persistence layer for portfolio monitoring. These tools enable the agent
 * to store daily listing data, price data with demand signals, reservations,
 * and market/neighborhood data in SQLite. The get_snapshots tool retrieves
 * historical data for trend analysis.
 *
 * All store tools default snapshot_date to today when not provided.
 * Reservation tool detects and reports new cancellations after upsert.
 *
 * Implements PERS-01 through PERS-05 from the requirements specification.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type * as BetterSqlite3 from "better-sqlite3";
import {
  StoreDailySnapshotsInputSchema,
  StorePriceSnapshotsInputSchema,
  StoreReservationsInputSchema,
  GetSnapshotsInputSchema,
  StoreMarketSnapshotInputSchema,
} from "../schemas/snapshots.js";
import { createListingSnapshotQueries } from "../db/queries/listing-snapshots.js";
import { createPriceSnapshotQueries } from "../db/queries/price-snapshots.js";
import { createReservationQueries } from "../db/queries/reservations.js";
import { createMarketSnapshotQueries } from "../db/queries/market-snapshots.js";

// --- Helpers ---

/** Get today's date as YYYY-MM-DD string. */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get a date N days ago as YYYY-MM-DD string. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Register all snapshot MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_store_daily_snapshots (write, PERS-01)
 * - pricelabs_store_price_snapshots (write, PERS-02)
 * - pricelabs_store_reservations (write, PERS-03)
 * - pricelabs_get_snapshots (read, PERS-04)
 * - pricelabs_store_market_snapshot (write, PERS-05)
 */
export function registerSnapshotTools(
  server: McpServer,
  db: BetterSqlite3.Database,
): void {
  // Create query instances from factory functions
  const listingQueries = createListingSnapshotQueries(db);
  const priceQueries = createPriceSnapshotQueries(db);
  const reservationQueries = createReservationQueries(db);
  const marketQueries = createMarketSnapshotQueries(db);

  // --- pricelabs_store_daily_snapshots ---

  server.registerTool(
    "pricelabs_store_daily_snapshots",
    {
      description:
        "Store today's listing snapshots in the database for historical tracking. Call this during daily health checks after fetching all listings via pricelabs_get_listings.",
      inputSchema: StoreDailySnapshotsInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const snapshot_date = params.snapshot_date ?? todayDate();

        // Normalize string→number for fields that may arrive as strings from API
        // (e.g., "43 %" for occupancy, "Fully Blocked" for revenue)
        const toNum = (v: unknown): number | null => {
          if (v === null || v === undefined) return null;
          const n = typeof v === "string" ? parseFloat(v) : Number(v);
          return isNaN(n) ? null : n;
        };

        const mappedSnapshots = params.snapshots.map((s) => ({
          listing_id: s.listing_id,
          pms: s.pms,
          snapshot_date,
          name: s.name ?? null,
          health_7_day: s.health_7_day ?? null,
          health_30_day: s.health_30_day ?? null,
          health_60_day: s.health_60_day ?? null,
          occupancy_next_30: toNum(s.occupancy_next_30),
          market_occupancy_next_30: toNum(s.market_occupancy_next_30),
          occupancy_gap_pct: s.occupancy_gap_pct ?? null,
          revenue_past_7: toNum(s.revenue_past_7),
          stly_revenue_past_7: toNum(s.stly_revenue_past_7),
          revenue_vs_stly_pct: s.revenue_vs_stly_pct ?? null,
          base_price: s.base_price ?? null,
          recommended_base_price: s.recommended_base_price ?? null,
          last_date_pushed: s.last_date_pushed ?? null,
          days_since_sync: s.days_since_sync ?? null,
          is_stale_sync: s.is_stale_sync === true ? 1 : s.is_stale_sync === false ? 0 : null,
          data_json: s.data_json,
        }));

        listingQueries.insertMany(mappedSnapshots);

        const result = {
          stored: mappedSnapshots.length,
          snapshot_date,
          message: `Stored ${mappedSnapshots.length} listing snapshot(s) for ${snapshot_date}`,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );

  // --- pricelabs_store_price_snapshots ---

  server.registerTool(
    "pricelabs_store_price_snapshots",
    {
      description:
        "Store price data with demand signals for a listing. Call this during daily health checks after fetching prices via pricelabs_get_prices.",
      inputSchema: StorePriceSnapshotsInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const snapshot_date = params.snapshot_date ?? todayDate();

        const mappedPrices = params.prices.map((p) => ({
          listing_id: params.listing_id,
          pms: params.pms,
          snapshot_date,
          price_date: p.price_date,
          price: p.price,
          demand_level: p.demand_level ?? null,
          booking_status: p.booking_status ?? null,
          booking_status_stly: p.booking_status_stly ?? null,
          adr: p.adr ?? null,
          adr_stly: p.adr_stly ?? null,
        }));

        priceQueries.insertMany(mappedPrices);

        const result = {
          stored: mappedPrices.length,
          listing_id: params.listing_id,
          snapshot_date,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );

  // --- pricelabs_store_reservations ---

  server.registerTool(
    "pricelabs_store_reservations",
    {
      description:
        "Upsert reservation data for a listing. Detects new cancellations by comparing booking_status changes. Call after fetching reservation data via pricelabs_get_reservations.",
      inputSchema: StoreReservationsInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const today = todayDate();

        const mappedReservations = params.reservations.map((r) => ({
          listing_id: params.listing_id,
          pms: params.pms,
          reservation_id: r.reservation_id,
          check_in: r.check_in ?? null,
          check_out: r.check_out ?? null,
          booked_date: r.booked_date ?? null,
          booking_status: r.booking_status ?? null,
          rental_revenue: r.rental_revenue ?? null,
          total_cost: r.total_cost ?? null,
          no_of_days: r.no_of_days ?? null,
          currency: r.currency ?? null,
          last_seen_date: today,
          data_json: r.data_json ?? null,
        }));

        reservationQueries.upsertMany(mappedReservations);

        // Detect newly cancelled reservations (updated since the start of this upsert)
        const newCancellations = reservationQueries.getRecentCancellations.all({
          since: today,
        });

        const result = {
          upserted: mappedReservations.length,
          new_cancellations: newCancellations.map((c) => ({
            reservation_id: c.reservation_id,
            listing_id: c.listing_id,
            check_in: c.check_in,
            check_out: c.check_out,
            rental_revenue: c.rental_revenue,
            cancelled_on: c.cancelled_on,
          })),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );

  // --- pricelabs_get_snapshots ---

  server.registerTool(
    "pricelabs_get_snapshots",
    {
      description:
        "Retrieve historical snapshots for trend analysis. Query listing, price, or market snapshot tables by date range. Use for comparing current performance to past periods.",
      inputSchema: GetSnapshotsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const start_date = params.start_date ?? daysAgo(30);
        const end_date = params.end_date ?? todayDate();
        const limit = params.limit ?? 100;

        let rows: unknown[];

        switch (params.table) {
          case "listing_snapshots": {
            if (params.listing_id && params.pms) {
              rows = listingQueries.getSnapshotRange.all({
                listing_id: params.listing_id,
                pms: params.pms,
                start_date,
                end_date,
              });
            } else {
              rows = listingQueries.getLatestForAllListings.all();
            }
            break;
          }
          case "price_snapshots": {
            if (params.listing_id && params.pms) {
              // Use getLatestByListing to retrieve the most recent snapshot,
              // then filter by date range if needed
              rows = priceQueries.getLatestByListing.all({
                listing_id: params.listing_id,
                pms: params.pms,
              });
            } else {
              rows = [];
            }
            break;
          }
          case "market_snapshots": {
            if (params.listing_id && params.pms) {
              rows = marketQueries.getSnapshotRange.all({
                listing_id: params.listing_id,
                pms: params.pms,
                start_date,
                end_date,
              });
            } else {
              rows = [];
            }
            break;
          }
          default:
            rows = [];
        }

        // Apply limit
        if (rows.length > limit) {
          rows = rows.slice(0, limit);
        }

        const result = {
          table: params.table,
          rows,
          count: rows.length,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );

  // --- pricelabs_store_market_snapshot ---

  server.registerTool(
    "pricelabs_store_market_snapshot",
    {
      description:
        "Store neighborhood/market data snapshots. Call after fetching neighborhood data via pricelabs_get_neighborhood for each listing.",
      inputSchema: StoreMarketSnapshotInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const snapshot_date = params.snapshot_date ?? todayDate();

        const mappedSnapshots = params.snapshots.map((s) => ({
          listing_id: s.listing_id,
          pms: s.pms,
          snapshot_date,
          listings_used: s.listings_used ?? null,
          p25_price: s.p25_price ?? null,
          p50_price: s.p50_price ?? null,
          p75_price: s.p75_price ?? null,
          p90_price: s.p90_price ?? null,
          market_occupancy: s.market_occupancy ?? null,
          data_json: s.data_json,
        }));

        marketQueries.insertMany(mappedSnapshots);

        const result = {
          stored: mappedSnapshots.length,
          snapshot_date,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );
}

// --- Error formatting ---

/**
 * Format database/runtime errors for snapshot tool responses.
 * Returns structured error JSON with isError flag.
 */
function formatErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";

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
