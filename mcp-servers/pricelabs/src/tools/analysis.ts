/**
 * Analysis MCP tools: pricelabs_get_portfolio_kpis, pricelabs_detect_underperformers.
 *
 * Provides portfolio-level KPI computation with week-over-week and STLY
 * comparisons, and underperformer detection with configurable thresholds.
 * These tools return structured data for the analysis skill to interpret
 * and present as weekly reports and underperformance alerts.
 *
 * Supports requirements: ANLY-01 (underperformance detection), ANLY-02
 * (recommended actions via enriched data), ANLY-03/04 (portfolio KPIs),
 * ANLY-05 (competitive positioning via market position data).
 *
 * @module tools/analysis
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import {
  GetPortfolioKpisInputSchema,
  DetectUnderperformersInputSchema,
} from "../schemas/analysis.js";
import { createAnalysisQueries } from "../db/queries/analysis.js";

/**
 * Register analysis MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_get_portfolio_kpis (portfolio KPIs with period comparison)
 * - pricelabs_detect_underperformers (threshold-based underperformance scan)
 *
 * @param server - MCP server instance
 * @param db - An open better-sqlite3 Database instance (with migrations applied)
 */
export function registerAnalysisTools(
  server: McpServer,
  db: Database.Database,
): void {
  const analysisQueries = createAnalysisQueries(db);

  // --- pricelabs_get_portfolio_kpis ---

  server.registerTool(
    "pricelabs_get_portfolio_kpis",
    {
      description:
        "Compute portfolio KPIs (occupancy, revenue, health) with week-over-week and STLY comparisons for each listing. Returns per-listing data with current and previous period metrics. Use for weekly optimization reports (ANLY-03, ANLY-04) and competitive position analysis (ANLY-05).",
      inputSchema: GetPortfolioKpisInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        // Determine current date: use provided or latest snapshot
        const currentDate: string =
          params.current_date ??
          (db
            .prepare("SELECT MAX(snapshot_date) FROM listing_snapshots")
            .pluck()
            .get() as string | null) ??
          new Date().toISOString().slice(0, 10);

        // Determine previous date based on comparison period
        const compareTo = params.compare_to ?? "previous_week";
        const current = new Date(currentDate);
        let daysBefore: number;
        switch (compareTo) {
          case "previous_month":
            daysBefore = 30;
            break;
          case "stly":
            daysBefore = 365;
            break;
          default:
            daysBefore = 7;
        }
        current.setDate(current.getDate() - daysBefore);
        const prevDate = current.toISOString().slice(0, 10);

        // Fetch portfolio KPIs with comparison
        const kpiRows = analysisQueries.getPortfolioWoW.all({
          current_date: currentDate,
          prev_date: prevDate,
        });

        // Fetch market position data for competitive context
        const marketRows = analysisQueries.getMarketPosition.all({});

        const result = {
          as_of: currentDate,
          compare_to: compareTo,
          prev_date: prevDate,
          listings: kpiRows,
          market_position: marketRows,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
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

  // --- pricelabs_detect_underperformers ---

  server.registerTool(
    "pricelabs_detect_underperformers",
    {
      description:
        "Detect underperforming listings based on configurable thresholds for occupancy gap vs market, revenue vs STLY, and health score decline. Returns flagged listings with underperformance type classification. Use for underperformance alerting (ANLY-01, ANLY-02).",
      inputSchema: DetectUnderperformersInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        // Determine snapshot date: use provided or latest
        const snapshotDate: string =
          params.snapshot_date ??
          (db
            .prepare("SELECT MAX(snapshot_date) FROM listing_snapshots")
            .pluck()
            .get() as string | null) ??
          new Date().toISOString().slice(0, 10);

        // Apply threshold defaults
        const occGapThreshold = params.occupancy_gap_threshold ?? 20;
        const revenueStlyThreshold = params.revenue_stly_threshold ?? -25;

        // Detect underperformers
        const underperformers = analysisQueries.getUnderperformers.all({
          snapshot_date: snapshotDate,
          occ_gap_threshold: occGapThreshold,
          revenue_stly_threshold: revenueStlyThreshold,
        });

        // Enrich with market position for competitive context
        const marketPositions = analysisQueries.getMarketPosition.all({});
        const marketMap = new Map(
          marketPositions.map((m) => [`${m.listing_id}:${m.pms}`, m]),
        );

        const enrichedRows = underperformers.map((u) => {
          const market = marketMap.get(`${u.listing_id}:${u.pms}`);
          return {
            ...u,
            market_position: market
              ? {
                  price_position: market.price_position,
                  p25_price: market.p25_price,
                  p50_price: market.p50_price,
                  p75_price: market.p75_price,
                  p90_price: market.p90_price,
                  market_occupancy: market.market_occupancy,
                  listings_used: market.listings_used,
                }
              : null,
          };
        });

        const result = {
          as_of: snapshotDate,
          thresholds: {
            occupancy_gap_pct: occGapThreshold,
            revenue_vs_stly_pct: revenueStlyThreshold,
            health_score: 50,
          },
          underperformers: enrichedRows,
          count: enrichedRows.length,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
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
