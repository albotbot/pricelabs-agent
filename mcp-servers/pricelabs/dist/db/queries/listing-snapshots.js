/**
 * Prepared statement queries for the listing_snapshots table.
 *
 * Provides insert (single + batch), get-latest, get-range, and
 * get-latest-for-all-listings operations.
 *
 * @module db/queries/listing-snapshots
 */
/**
 * Create prepared statement queries for the listing_snapshots table.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all listing snapshot query operations.
 */
export function createListingSnapshotQueries(db) {
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
    const getLatestSnapshot = db.prepare(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY snapshot_date DESC
    LIMIT 1
  `);
    const getSnapshotRange = db.prepare(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date BETWEEN @start_date AND @end_date
    ORDER BY snapshot_date ASC
  `);
    const getLatestForAllListings = db.prepare(`
    SELECT * FROM listing_snapshots
    WHERE snapshot_date = (
      SELECT MAX(snapshot_date) FROM listing_snapshots
    )
  `);
    const insertMany = db.transaction((snapshots) => {
        for (const snapshot of snapshots) {
            insertSnapshot.run(snapshot);
        }
    });
    return {
        insertSnapshot,
        getLatestSnapshot,
        getSnapshotRange,
        getLatestForAllListings,
        insertMany,
    };
}
