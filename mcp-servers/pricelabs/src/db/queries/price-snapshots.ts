/**
 * Prepared statement queries for the price_snapshots table.
 *
 * Provides insert (single + batch), get-by-listing-and-date-range,
 * and get-latest-by-listing operations.
 *
 * @module db/queries/price-snapshots
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape returned by price_snapshots queries. */
export interface PriceSnapshotRow {
  id: number;
  listing_id: string;
  pms: string;
  snapshot_date: string;
  price_date: string;
  price: number;
  demand_level: string | null;
  booking_status: string | null;
  booking_status_stly: string | null;
  adr: number | null;
  adr_stly: number | null;
  created_at: string;
}

/** Parameters for inserting a single price snapshot. */
export interface InsertPriceSnapshotParams {
  listing_id: string;
  pms: string;
  snapshot_date: string;
  price_date: string;
  price: number;
  demand_level: string | null;
  booking_status: string | null;
  booking_status_stly: string | null;
  adr: number | null;
  adr_stly: number | null;
}

/**
 * Create prepared statement queries for the price_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all price snapshot query operations.
 */
export function createPriceSnapshotQueries(db: BetterSqlite3.Database) {
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO price_snapshots (
      listing_id, pms, snapshot_date, price_date,
      price, demand_level, booking_status, booking_status_stly,
      adr, adr_stly
    ) VALUES (
      @listing_id, @pms, @snapshot_date, @price_date,
      @price, @demand_level, @booking_status, @booking_status_stly,
      @adr, @adr_stly
    )
  `);

  const getByListingAndDateRange = db.prepare<
    {
      listing_id: string;
      pms: string;
      start_date: string;
      end_date: string;
      snapshot_date: string;
    },
    PriceSnapshotRow
  >(`
    SELECT * FROM price_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND price_date BETWEEN @start_date AND @end_date
      AND snapshot_date = @snapshot_date
    ORDER BY price_date ASC
  `);

  const getLatestByListing = db.prepare<
    { listing_id: string; pms: string },
    PriceSnapshotRow
  >(`
    SELECT * FROM price_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date = (
        SELECT MAX(snapshot_date) FROM price_snapshots
        WHERE listing_id = @listing_id AND pms = @pms
      )
    ORDER BY price_date ASC
  `);

  const insertMany = db.transaction(
    (snapshots: InsertPriceSnapshotParams[]) => {
      for (const snapshot of snapshots) {
        insertSnapshot.run(snapshot);
      }
    },
  );

  return {
    insertSnapshot,
    getByListingAndDateRange,
    getLatestByListing,
    insertMany,
  };
}
