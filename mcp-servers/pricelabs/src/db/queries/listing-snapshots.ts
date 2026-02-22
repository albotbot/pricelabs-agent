/**
 * Prepared statement queries for the listing_snapshots table.
 *
 * Provides insert (single + batch), get-latest, get-range, and
 * get-latest-for-all-listings operations.
 *
 * @module db/queries/listing-snapshots
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape returned by listing_snapshots queries. */
export interface ListingSnapshotRow {
  id: number;
  listing_id: string;
  pms: string;
  snapshot_date: string;
  name: string | null;
  health_7_day: string | null;
  health_30_day: string | null;
  health_60_day: string | null;
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  occupancy_gap_pct: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  revenue_vs_stly_pct: number | null;
  base_price: number | null;
  recommended_base_price: number | null;
  last_date_pushed: string | null;
  days_since_sync: number | null;
  is_stale_sync: number | null;
  data_json: string;
  created_at: string;
}

/** Parameters for inserting a single listing snapshot. */
export interface InsertListingSnapshotParams {
  listing_id: string;
  pms: string;
  snapshot_date: string;
  name: string | null;
  health_7_day: string | null;
  health_30_day: string | null;
  health_60_day: string | null;
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  occupancy_gap_pct: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  revenue_vs_stly_pct: number | null;
  base_price: number | null;
  recommended_base_price: number | null;
  last_date_pushed: string | null;
  days_since_sync: number | null;
  is_stale_sync: number | null;
  data_json: string;
}

/**
 * Create prepared statement queries for the listing_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all listing snapshot query operations.
 */
export function createListingSnapshotQueries(db: BetterSqlite3.Database) {
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO listing_snapshots (
      listing_id, pms, snapshot_date, name,
      health_7_day, health_30_day, health_60_day,
      occupancy_next_30, market_occupancy_next_30, occupancy_gap_pct,
      revenue_past_7, stly_revenue_past_7, revenue_vs_stly_pct,
      base_price, recommended_base_price,
      last_date_pushed, days_since_sync, is_stale_sync,
      data_json
    ) VALUES (
      @listing_id, @pms, @snapshot_date, @name,
      @health_7_day, @health_30_day, @health_60_day,
      @occupancy_next_30, @market_occupancy_next_30, @occupancy_gap_pct,
      @revenue_past_7, @stly_revenue_past_7, @revenue_vs_stly_pct,
      @base_price, @recommended_base_price,
      @last_date_pushed, @days_since_sync, @is_stale_sync,
      @data_json
    )
  `);

  const getLatestSnapshot = db.prepare<
    { listing_id: string; pms: string },
    ListingSnapshotRow
  >(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY snapshot_date DESC
    LIMIT 1
  `);

  const getSnapshotRange = db.prepare<
    { listing_id: string; pms: string; start_date: string; end_date: string },
    ListingSnapshotRow
  >(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date BETWEEN @start_date AND @end_date
    ORDER BY snapshot_date ASC
  `);

  const getLatestForAllListings = db.prepare<[], ListingSnapshotRow>(`
    SELECT * FROM listing_snapshots
    WHERE snapshot_date = (
      SELECT MAX(snapshot_date) FROM listing_snapshots
    )
  `);

  const insertMany = db.transaction(
    (snapshots: InsertListingSnapshotParams[]) => {
      for (const snapshot of snapshots) {
        insertSnapshot.run(snapshot);
      }
    },
  );

  return {
    insertSnapshot,
    getLatestSnapshot,
    getSnapshotRange,
    getLatestForAllListings,
    insertMany,
  };
}
