/**
 * Prepared statement queries for the price_snapshots table.
 *
 * Provides insert (single + batch), get-by-listing-and-date-range,
 * and get-latest-by-listing operations.
 *
 * @module db/queries/price-snapshots
 */
/**
 * Create prepared statement queries for the price_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all price snapshot query operations.
 */
export function createPriceSnapshotQueries(db) {
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
    const getByListingAndDateRange = db.prepare(`
    SELECT * FROM price_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND price_date BETWEEN @start_date AND @end_date
      AND snapshot_date = @snapshot_date
    ORDER BY price_date ASC
  `);
    const getLatestByListing = db.prepare(`
    SELECT * FROM price_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date = (
        SELECT MAX(snapshot_date) FROM price_snapshots
        WHERE listing_id = @listing_id AND pms = @pms
      )
    ORDER BY price_date ASC
  `);
    const insertMany = db.transaction((snapshots) => {
        for (const snapshot of snapshots) {
            insertSnapshot.run(snapshot);
        }
    });
    return {
        insertSnapshot,
        getByListingAndDateRange,
        getLatestByListing,
        insertMany,
    };
}
