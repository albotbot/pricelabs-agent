/**
 * Prepared statement queries for the audit_log table.
 *
 * Provides insert, get-by-date-range, get-by-listing, get-by-type,
 * and get-latest-alert (for dedup per Pitfall 6) operations.
 *
 * @module db/queries/audit-log
 */
/**
 * Create prepared statement queries for the audit_log table.
 *
 * Includes a dedup query (getLatestAlert) to prevent stale sync alert
 * flooding (Pitfall 6 from research).
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all audit log query operations.
 */
export function createAuditLogQueries(db) {
    const insertEntry = db.prepare(`
    INSERT INTO audit_log (
      action_type, listing_id, pms,
      description, details_json, channel
    ) VALUES (
      @action_type, @listing_id, @pms,
      @description, @details_json, @channel
    )
  `);
    const getByDateRange = db.prepare(`
    SELECT * FROM audit_log
    WHERE created_at BETWEEN @start_date AND @end_date
    ORDER BY created_at DESC
    LIMIT @limit
  `);
    const getByListing = db.prepare(`
    SELECT * FROM audit_log
    WHERE listing_id = @listing_id
    ORDER BY created_at DESC
    LIMIT @limit
  `);
    const getByType = db.prepare(`
    SELECT * FROM audit_log
    WHERE action_type = @action_type
    ORDER BY created_at DESC
    LIMIT @limit
  `);
    /**
     * Get the latest alert for a specific listing.
     * Used for dedup: before sending a stale sync alert, check if an
     * unresolved alert already exists within the cooldown window (Pitfall 6).
     */
    const getLatestAlert = db.prepare(`
    SELECT * FROM audit_log
    WHERE action_type = 'alert'
      AND listing_id = @listing_id
    ORDER BY created_at DESC
    LIMIT 1
  `);
    return {
        insertEntry,
        getByDateRange,
        getByListing,
        getByType,
        getLatestAlert,
    };
}
