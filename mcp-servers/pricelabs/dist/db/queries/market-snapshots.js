/**
 * Prepared statement queries for the market_snapshots table.
 *
 * Provides insert (single + batch), get-latest-by-listing, and
 * get-snapshot-range operations.
 *
 * @module db/queries/market-snapshots
 */
/**
 * Create prepared statement queries for the market_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all market snapshot query operations.
 */
export function createMarketSnapshotQueries(db) {
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
    const getLatestByListing = db.prepare(`
    SELECT * FROM market_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY snapshot_date DESC
    LIMIT 1
  `);
    const getSnapshotRange = db.prepare(`
    SELECT * FROM market_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date BETWEEN @start_date AND @end_date
    ORDER BY snapshot_date ASC
  `);
    const insertMany = db.transaction((snapshots) => {
        for (const snapshot of snapshots) {
            insertSnapshot.run(snapshot);
        }
    });
    return {
        insertSnapshot,
        getLatestByListing,
        getSnapshotRange,
        insertMany,
    };
}
