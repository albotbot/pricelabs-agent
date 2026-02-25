/**
 * Prepared statement queries for the change_tracking table.
 *
 * Provides insert, pending check retrieval, check completion,
 * and per-listing history for revenue impact follow-ups at
 * 7/14/30 day intervals after pricing changes.
 *
 * @module db/queries/change-tracking
 */
/**
 * Create prepared statement queries for the change_tracking table.
 *
 * Provides:
 * - insertTracking: Record a pricing change with scheduled follow-up checks
 * - getPendingChecks: Find changes with overdue check intervals
 * - markCheckDone: Complete a specific interval check with result data
 * - getByListing: Retrieve change history for a listing
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all change tracking query operations.
 */
export function createChangeTrackingQueries(db) {
    const insertTracking = db.prepare(`
    INSERT INTO change_tracking (
      audit_log_id, listing_id, pms,
      change_type, change_date,
      affected_dates_start, affected_dates_end,
      before_json, after_json,
      check_7d_due, check_14d_due, check_30d_due
    ) VALUES (
      @audit_log_id, @listing_id, @pms,
      @change_type, @change_date,
      @affected_dates_start, @affected_dates_end,
      @before_json, @after_json,
      @check_7d_due, @check_14d_due, @check_30d_due
    )
  `);
    /**
     * Find all change tracking entries where at least one check interval
     * is due (done=0 AND due date <= today). Ordered by change_date ASC
     * so oldest changes are checked first.
     */
    const getPendingChecks = db.prepare(`
    SELECT * FROM change_tracking
    WHERE
      (check_7d_done = 0 AND check_7d_due <= @today)
      OR (check_14d_done = 0 AND check_14d_due <= @today)
      OR (check_30d_done = 0 AND check_30d_due <= @today)
    ORDER BY change_date ASC
  `);
    /**
     * Mark a specific check interval as complete with result data.
     * Uses CASE expressions to update the correct interval based on
     * the @interval parameter (7, 14, or 30).
     */
    const markCheckDone = db.prepare(`
    UPDATE change_tracking SET
      check_7d_done = CASE WHEN @interval = 7 THEN 1 ELSE check_7d_done END,
      check_7d_result_json = CASE WHEN @interval = 7 THEN @result_json ELSE check_7d_result_json END,
      check_14d_done = CASE WHEN @interval = 14 THEN 1 ELSE check_14d_done END,
      check_14d_result_json = CASE WHEN @interval = 14 THEN @result_json ELSE check_14d_result_json END,
      check_30d_done = CASE WHEN @interval = 30 THEN 1 ELSE check_30d_done END,
      check_30d_result_json = CASE WHEN @interval = 30 THEN @result_json ELSE check_30d_result_json END
    WHERE id = @id
  `);
    /**
     * Get change tracking history for a specific listing,
     * ordered by most recent change first.
     */
    const getByListing = db.prepare(`
    SELECT * FROM change_tracking
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY change_date DESC
    LIMIT @limit
  `);
    return { insertTracking, getPendingChecks, markCheckDone, getByListing };
}
