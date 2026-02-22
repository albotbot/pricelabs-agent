/**
 * Prepared statement queries for the market_snapshots table.
 *
 * Provides insert (single + batch), get-latest-by-listing, and
 * get-snapshot-range operations.
 *
 * @module db/queries/market-snapshots
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape returned by market_snapshots queries. */
export interface MarketSnapshotRow {
  id: number;
  listing_id: string;
  pms: string;
  snapshot_date: string;
  listings_used: number | null;
  p25_price: number | null;
  p50_price: number | null;
  p75_price: number | null;
  p90_price: number | null;
  market_occupancy: number | null;
  data_json: string;
  created_at: string;
}

/** Parameters for inserting a single market snapshot. */
export interface InsertMarketSnapshotParams {
  listing_id: string;
  pms: string;
  snapshot_date: string;
  listings_used: number | null;
  p25_price: number | null;
  p50_price: number | null;
  p75_price: number | null;
  p90_price: number | null;
  market_occupancy: number | null;
  data_json: string;
}

/**
 * Create prepared statement queries for the market_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all market snapshot query operations.
 */
export function createMarketSnapshotQueries(db: BetterSqlite3.Database) {
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO market_snapshots (
      listing_id, pms, snapshot_date,
      listings_used, p25_price, p50_price, p75_price, p90_price,
      market_occupancy, data_json
    ) VALUES (
      @listing_id, @pms, @snapshot_date,
      @listings_used, @p25_price, @p50_price, @p75_price, @p90_price,
      @market_occupancy, @data_json
    )
  `);

  const getLatestByListing = db.prepare<
    { listing_id: string; pms: string },
    MarketSnapshotRow
  >(`
    SELECT * FROM market_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY snapshot_date DESC
    LIMIT 1
  `);

  const getSnapshotRange = db.prepare<
    { listing_id: string; pms: string; start_date: string; end_date: string },
    MarketSnapshotRow
  >(`
    SELECT * FROM market_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date BETWEEN @start_date AND @end_date
    ORDER BY snapshot_date ASC
  `);

  const insertMany = db.transaction(
    (snapshots: InsertMarketSnapshotParams[]) => {
      for (const snapshot of snapshots) {
        insertSnapshot.run(snapshot);
      }
    },
  );

  return {
    insertSnapshot,
    getLatestByListing,
    getSnapshotRange,
    insertMany,
  };
}
