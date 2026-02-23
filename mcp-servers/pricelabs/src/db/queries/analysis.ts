/**
 * Prepared statement queries for portfolio analysis.
 *
 * Provides week-over-week KPI comparison, underperformer detection,
 * and market position analysis across all listings.
 *
 * @module db/queries/analysis
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape for portfolio KPI comparison (WoW / month / STLY). */
export interface PortfolioKpiRow {
  listing_id: string;
  pms: string;
  name: string | null;
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  base_price: number | null;
  recommended_base_price: number | null;
  health_7_day: string | null;
  health_30_day: string | null;
  occupancy_gap_pct: number | null;
  revenue_vs_stly_pct: number | null;
  prev_occupancy_next_30: number | null;
  prev_revenue_past_7: number | null;
  prev_occupancy_gap_pct: number | null;
  prev_revenue_vs_stly_pct: number | null;
}

/** Row shape for underperformer detection. */
export interface UnderperformerRow {
  listing_id: string;
  pms: string;
  name: string | null;
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  occupancy_gap_pct: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  revenue_vs_stly_pct: number | null;
  health_7_day: string | null;
  health_30_day: string | null;
  base_price: number | null;
  recommended_base_price: number | null;
  underperformance_type: string;
}

/** Row shape for market position analysis. */
export interface MarketPositionRow {
  listing_id: string;
  pms: string;
  name: string | null;
  base_price: number | null;
  p25_price: number | null;
  p50_price: number | null;
  p75_price: number | null;
  p90_price: number | null;
  market_occupancy: number | null;
  listings_used: number | null;
  price_position: string;
}

/**
 * Create prepared statement queries for portfolio analysis.
 *
 * Provides:
 * - getPortfolioWoW: Current vs previous period snapshot comparison
 * - getUnderperformers: Listings failing health/occupancy/revenue thresholds
 * - getMarketPosition: Listing price vs neighborhood percentiles
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all analysis query operations.
 */
export function createAnalysisQueries(db: BetterSqlite3.Database) {
  /**
   * Join current snapshot with a previous snapshot for WoW/month/STLY comparison.
   * Parameters: current_date, prev_date (both YYYY-MM-DD).
   */
  const getPortfolioWoW = db.prepare<
    { current_date: string; prev_date: string },
    PortfolioKpiRow
  >(`
    SELECT
      c.listing_id, c.pms, c.name,
      c.occupancy_next_30, c.market_occupancy_next_30,
      c.revenue_past_7, c.stly_revenue_past_7,
      c.base_price, c.recommended_base_price,
      c.health_7_day, c.health_30_day,
      c.occupancy_gap_pct, c.revenue_vs_stly_pct,
      p.occupancy_next_30 as prev_occupancy_next_30,
      p.revenue_past_7 as prev_revenue_past_7,
      p.occupancy_gap_pct as prev_occupancy_gap_pct,
      p.revenue_vs_stly_pct as prev_revenue_vs_stly_pct
    FROM listing_snapshots c
    LEFT JOIN listing_snapshots p
      ON c.listing_id = p.listing_id AND c.pms = p.pms
      AND p.snapshot_date = @prev_date
    WHERE c.snapshot_date = @current_date
  `);

  /**
   * Detect underperforming listings based on configurable thresholds.
   * Classifies underperformance type with priority ordering:
   * occupancy_and_revenue > occupancy_gap > revenue_drop > health_decline > multiple.
   */
  const getUnderperformers = db.prepare<
    {
      snapshot_date: string;
      occ_gap_threshold: number;
      revenue_stly_threshold: number;
    },
    UnderperformerRow
  >(`
    SELECT
      listing_id, pms, name,
      occupancy_next_30, market_occupancy_next_30, occupancy_gap_pct,
      revenue_past_7, stly_revenue_past_7, revenue_vs_stly_pct,
      health_7_day, health_30_day,
      base_price, recommended_base_price,
      CASE
        WHEN occupancy_gap_pct > @occ_gap_threshold
          AND revenue_vs_stly_pct < @revenue_stly_threshold THEN 'occupancy_and_revenue'
        WHEN occupancy_gap_pct > @occ_gap_threshold THEN 'occupancy_gap'
        WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 'revenue_drop'
        WHEN CAST(health_7_day AS REAL) < 50
          AND CAST(health_30_day AS REAL) < 50 THEN 'health_decline'
        ELSE 'multiple'
      END as underperformance_type
    FROM listing_snapshots
    WHERE snapshot_date = @snapshot_date
      AND (
        occupancy_gap_pct > @occ_gap_threshold
        OR revenue_vs_stly_pct < @revenue_stly_threshold
        OR (CAST(health_7_day AS REAL) < 50 AND CAST(health_30_day AS REAL) < 50)
      )
    ORDER BY
      CASE
        WHEN occupancy_gap_pct > @occ_gap_threshold
          AND revenue_vs_stly_pct < @revenue_stly_threshold THEN 0
        WHEN occupancy_gap_pct > @occ_gap_threshold THEN 1
        WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 2
        ELSE 3
      END,
      occupancy_gap_pct DESC
  `);

  /**
   * Get market position for each listing by joining listing_snapshots
   * with market_snapshots. Uses latest snapshot dates for each table.
   * Computes price_position based on base_price vs neighborhood percentiles.
   */
  const getMarketPosition = db.prepare<
    Record<string, never>,
    MarketPositionRow
  >(`
    SELECT
      l.listing_id, l.pms, l.name, l.base_price,
      m.p25_price, m.p50_price, m.p75_price, m.p90_price,
      m.market_occupancy, m.listings_used,
      CASE
        WHEN l.base_price < m.p25_price THEN 'below_25th'
        WHEN l.base_price < m.p50_price THEN '25th_to_50th'
        WHEN l.base_price < m.p75_price THEN '50th_to_75th'
        WHEN l.base_price < m.p90_price THEN '75th_to_90th'
        ELSE 'above_90th'
      END as price_position
    FROM listing_snapshots l
    JOIN market_snapshots m
      ON l.listing_id = m.listing_id AND l.pms = m.pms
    WHERE l.snapshot_date = (SELECT MAX(snapshot_date) FROM listing_snapshots)
      AND m.snapshot_date = (
        SELECT MAX(snapshot_date) FROM market_snapshots
        WHERE listing_id = l.listing_id AND pms = l.pms
      )
  `);

  return { getPortfolioWoW, getUnderperformers, getMarketPosition };
}
