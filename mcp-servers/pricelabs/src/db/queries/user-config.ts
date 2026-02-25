/**
 * Prepared statement queries for the user_config table.
 *
 * Provides config value retrieval (with per-listing override fallback
 * to global), listing-scoped merged view, global listing, upsert,
 * and listing override deletion.
 *
 * @module db/queries/user-config
 */

// Namespace import required: TypeScript declaration emit needs the
// BetterSqlite3 namespace to name Statement/Transaction in .d.ts files.
// The `export =` pattern in @types/better-sqlite3 requires `import *`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as BetterSqlite3 from "better-sqlite3";

/** Full row shape returned by user_config queries. */
export interface UserConfigRow {
  id: number;
  config_key: string;
  config_value: string;
  listing_id: string | null;
  pms: string | null;
  listing_id_key: string;
  pms_key: string;
  updated_at: string;
}

/** Row shape for getConfigValue (single value lookup). */
export interface UserConfigValueRow {
  config_value: string;
}

/** Row shape for getAllForListing (merged global + per-listing view). */
export interface UserConfigMergedRow {
  config_key: string;
  config_value: string;
  source: string;
}

/**
 * Create prepared statement queries for the user_config table.
 *
 * Provides:
 * - getConfigValue: Per-listing value with fallback to global default
 * - getAllForListing: Merged view of global defaults + listing overrides
 * - getAllGlobal: All global (non-listing-scoped) config entries
 * - upsertConfig: Insert or update a config value (global or per-listing)
 * - deleteListingOverride: Remove a per-listing override
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all user config query operations.
 */
export function createUserConfigQueries(db: BetterSqlite3.Database) {
  /**
   * Get a single config value for a key. Returns per-listing value if
   * one exists, otherwise falls back to global. The ORDER BY + LIMIT 1
   * ensures per-listing takes priority (listing_id IS NOT NULL sorts first).
   */
  const getConfigValue = db.prepare<
    { config_key: string; listing_id: string; pms: string },
    UserConfigValueRow
  >(`
    SELECT config_value FROM user_config
    WHERE config_key = @config_key
      AND (
        (listing_id = @listing_id AND pms = @pms)
        OR (listing_id IS NULL AND pms IS NULL)
      )
    ORDER BY CASE WHEN listing_id IS NOT NULL THEN 0 ELSE 1 END
    LIMIT 1
  `);

  /**
   * Get all config values for a listing, merging per-listing overrides
   * with global defaults. Uses LEFT JOIN so global keys without listing
   * overrides still appear. The source column indicates provenance.
   */
  const getAllForListing = db.prepare<
    { listing_id: string; pms: string },
    UserConfigMergedRow
  >(`
    SELECT
      g.config_key,
      COALESCE(o.config_value, g.config_value) AS config_value,
      CASE WHEN o.id IS NOT NULL THEN 'listing' ELSE 'global' END AS source
    FROM user_config g
    LEFT JOIN user_config o
      ON g.config_key = o.config_key
      AND o.listing_id = @listing_id
      AND o.pms = @pms
    WHERE g.listing_id IS NULL AND g.pms IS NULL
    ORDER BY g.config_key ASC
  `);

  /**
   * Get all global config entries (no listing scope).
   */
  const getAllGlobal = db.prepare<
    Record<string, never>,
    { config_key: string; config_value: string; updated_at: string }
  >(`
    SELECT config_key, config_value, updated_at FROM user_config
    WHERE listing_id IS NULL AND pms IS NULL
    ORDER BY config_key ASC
  `);

  /**
   * Insert or update a config value. ON CONFLICT targets the UNIQUE
   * constraint on (config_key, listing_id_key, pms_key) -- the generated
   * stored columns that map NULL to '__global__' sentinel values.
   */
  const upsertConfig = db.prepare<{
    config_key: string;
    config_value: string;
    listing_id: string | null;
    pms: string | null;
  }>(`
    INSERT INTO user_config (config_key, config_value, listing_id, pms)
    VALUES (@config_key, @config_value, @listing_id, @pms)
    ON CONFLICT(config_key, listing_id_key, pms_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = datetime('now')
  `);

  /**
   * Delete a per-listing override. Only removes listing-scoped entries,
   * never global defaults (listing_id and pms must match non-NULL values).
   */
  const deleteListingOverride = db.prepare<{
    config_key: string;
    listing_id: string;
    pms: string;
  }>(`
    DELETE FROM user_config
    WHERE config_key = @config_key
      AND listing_id = @listing_id
      AND pms = @pms
  `);

  return {
    getConfigValue,
    getAllForListing,
    getAllGlobal,
    upsertConfig,
    deleteListingOverride,
  };
}
