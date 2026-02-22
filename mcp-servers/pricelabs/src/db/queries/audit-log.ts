/**
 * Prepared statement queries for the audit_log table.
 *
 * Provides insert, get-by-date-range, get-by-listing, get-by-type,
 * and get-latest-alert (for dedup per Pitfall 6) operations.
 *
 * @module db/queries/audit-log
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape returned by audit_log queries. */
export interface AuditLogRow {
  id: number;
  action_type: string;
  listing_id: string | null;
  pms: string | null;
  description: string;
  details_json: string | null;
  channel: string | null;
  created_at: string;
}

/** Parameters for inserting an audit log entry. */
export interface InsertAuditLogParams {
  action_type: string;
  listing_id: string | null;
  pms: string | null;
  description: string;
  details_json: string | null;
  channel: string | null;
}

/**
 * Create prepared statement queries for the audit_log table.
 *
 * Includes a dedup query (getLatestAlert) to prevent stale sync alert
 * flooding (Pitfall 6 from research).
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all audit log query operations.
 */
export function createAuditLogQueries(db: BetterSqlite3.Database) {
  const insertEntry = db.prepare(`
    INSERT INTO audit_log (
      action_type, listing_id, pms,
      description, details_json, channel
    ) VALUES (
      @action_type, @listing_id, @pms,
      @description, @details_json, @channel
    )
  `);

  const getByDateRange = db.prepare<
    { start_date: string; end_date: string; limit: number },
    AuditLogRow
  >(`
    SELECT * FROM audit_log
    WHERE created_at BETWEEN @start_date AND @end_date
    ORDER BY created_at DESC
    LIMIT @limit
  `);

  const getByListing = db.prepare<
    { listing_id: string; limit: number },
    AuditLogRow
  >(`
    SELECT * FROM audit_log
    WHERE listing_id = @listing_id
    ORDER BY created_at DESC
    LIMIT @limit
  `);

  const getByType = db.prepare<
    { action_type: string; limit: number },
    AuditLogRow
  >(`
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
  const getLatestAlert = db.prepare<
    { listing_id: string },
    AuditLogRow
  >(`
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
