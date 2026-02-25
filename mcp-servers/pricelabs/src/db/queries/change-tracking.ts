/**
 * Prepared statement queries for the change_tracking table.
 *
 * Provides insert, pending check retrieval, check completion,
 * and per-listing history for revenue impact follow-ups at
 * 7/14/30 day intervals after pricing changes.
 *
 * @module db/queries/change-tracking
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape returned by change_tracking queries. */
export interface ChangeTrackingRow {
  id: number;
  audit_log_id: number;
  listing_id: string;
  pms: string;
  change_type: string;
  change_date: string;
  affected_dates_start: string | null;
  affected_dates_end: string | null;
  before_json: string;
  after_json: string;
  check_7d_due: string;
  check_7d_done: number;
  check_7d_result_json: string | null;
  check_14d_due: string;
  check_14d_done: number;
  check_14d_result_json: string | null;
  check_30d_due: string;
  check_30d_done: number;
  check_30d_result_json: string | null;
  created_at: string;
}

/** Parameters for inserting a change tracking entry. */
export interface InsertChangeTrackingParams {
  audit_log_id: number;
  listing_id: string;
  pms: string;
  change_type: string;
  change_date: string;
  affected_dates_start: string | null;
  affected_dates_end: string | null;
  before_json: string;
  after_json: string;
  check_7d_due: string;
  check_14d_due: string;
  check_30d_due: string;
}

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
export function createChangeTrackingQueries(db: BetterSqlite3.Database) {
  const insertTracking = db.prepare<InsertChangeTrackingParams>(`
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
  const getPendingChecks = db.prepare<
    { today: string },
    ChangeTrackingRow
  >(`
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
  const markCheckDone = db.prepare<{
    id: number;
    interval: number;
    result_json: string;
  }>(`
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
  const getByListing = db.prepare<
    { listing_id: string; pms: string; limit: number },
    ChangeTrackingRow
  >(`
    SELECT * FROM change_tracking
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY change_date DESC
    LIMIT @limit
  `);

  return { insertTracking, getPendingChecks, markCheckDone, getByListing };
}
