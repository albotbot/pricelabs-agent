/**
 * Versioned schema migrations for all Phase 2 and Phase 5 tables.
 *
 * Uses SQLite `user_version` pragma for version tracking. Migrations are
 * idempotent -- running twice does not error or duplicate tables.
 *
 * Phase 2 tables: listing_snapshots, price_snapshots, reservations,
 * audit_log, market_snapshots.
 *
 * Phase 5 tables: change_tracking, user_config.
 *
 * @module db/migrations
 */

import type Database from "better-sqlite3";

/** A single versioned migration. */
interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

/**
 * All schema migrations, ordered by version.
 * Phase 2: migrations 1-5. Phase 5: migrations 6-7.
 */
const migrations: Migration[] = [
  // --- Migration 1: listing_snapshots (PERS-01) ---
  {
    version: 1,
    description: "Create listing_snapshots table",
    up(db) {
      db.exec(`
        CREATE TABLE listing_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          name TEXT,
          health_7_day TEXT,
          health_30_day TEXT,
          health_60_day TEXT,
          occupancy_next_30 REAL,
          market_occupancy_next_30 REAL,
          occupancy_gap_pct REAL,
          revenue_past_7 REAL,
          stly_revenue_past_7 REAL,
          revenue_vs_stly_pct REAL,
          base_price REAL,
          recommended_base_price REAL,
          last_date_pushed TEXT,
          days_since_sync REAL,
          is_stale_sync INTEGER,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date)
        );
        CREATE INDEX idx_ls_date ON listing_snapshots(snapshot_date);
        CREATE INDEX idx_ls_listing ON listing_snapshots(listing_id, pms);
      `);
    },
  },

  // --- Migration 2: price_snapshots (PERS-02) ---
  {
    version: 2,
    description: "Create price_snapshots table",
    up(db) {
      db.exec(`
        CREATE TABLE price_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          price_date TEXT NOT NULL,
          price REAL NOT NULL,
          demand_level TEXT,
          booking_status TEXT,
          booking_status_stly TEXT,
          adr REAL,
          adr_stly REAL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date, price_date)
        );
        CREATE INDEX idx_ps_listing_date ON price_snapshots(listing_id, pms, price_date);
        CREATE INDEX idx_ps_snapshot ON price_snapshots(snapshot_date);
      `);
    },
  },

  // --- Migration 3: reservations (PERS-03) ---
  {
    version: 3,
    description: "Create reservations table",
    up(db) {
      db.exec(`
        CREATE TABLE reservations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          reservation_id TEXT NOT NULL,
          check_in TEXT,
          check_out TEXT,
          booked_date TEXT,
          cancelled_on TEXT,
          booking_status TEXT,
          rental_revenue REAL,
          total_cost REAL,
          no_of_days INTEGER,
          currency TEXT,
          first_seen_date TEXT NOT NULL,
          last_seen_date TEXT NOT NULL,
          data_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, reservation_id)
        );
        CREATE INDEX idx_res_listing ON reservations(listing_id, pms);
        CREATE INDEX idx_res_checkin ON reservations(check_in);
        CREATE INDEX idx_res_status ON reservations(booking_status);
      `);
    },
  },

  // --- Migration 4: audit_log (PERS-04) ---
  {
    version: 4,
    description: "Create audit_log table",
    up(db) {
      db.exec(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          listing_id TEXT,
          pms TEXT,
          description TEXT NOT NULL,
          details_json TEXT,
          channel TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_audit_date ON audit_log(created_at);
        CREATE INDEX idx_audit_listing ON audit_log(listing_id);
        CREATE INDEX idx_audit_type ON audit_log(action_type);
      `);
    },
  },

  // --- Migration 5: market_snapshots (PERS-05) ---
  {
    version: 5,
    description: "Create market_snapshots table",
    up(db) {
      db.exec(`
        CREATE TABLE market_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          listings_used INTEGER,
          p25_price REAL,
          p50_price REAL,
          p75_price REAL,
          p90_price REAL,
          market_occupancy REAL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date)
        );
        CREATE INDEX idx_ms_listing_date ON market_snapshots(listing_id, pms, snapshot_date);
      `);
    },
  },

  // --- Migration 6: change_tracking (SCALE-02) ---
  {
    version: 6,
    description: "Create change_tracking table for revenue impact follow-ups",
    up(db) {
      db.exec(`
        CREATE TABLE change_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          audit_log_id INTEGER NOT NULL,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          change_type TEXT NOT NULL,
          change_date TEXT NOT NULL,
          affected_dates_start TEXT,
          affected_dates_end TEXT,
          before_json TEXT NOT NULL,
          after_json TEXT NOT NULL,
          check_7d_due TEXT NOT NULL,
          check_7d_done INTEGER NOT NULL DEFAULT 0,
          check_7d_result_json TEXT,
          check_14d_due TEXT NOT NULL,
          check_14d_done INTEGER NOT NULL DEFAULT 0,
          check_14d_result_json TEXT,
          check_30d_due TEXT NOT NULL,
          check_30d_done INTEGER NOT NULL DEFAULT 0,
          check_30d_result_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_ct_listing ON change_tracking(listing_id, pms);
        CREATE INDEX idx_ct_pending ON change_tracking(check_7d_done, check_14d_done, check_30d_done);
      `);
    },
  },

  // --- Migration 7: user_config (SCALE-04) ---
  {
    version: 7,
    description: "Create user_config table for configurable alert thresholds",
    up(db) {
      db.exec(`
        CREATE TABLE user_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT NOT NULL,
          config_value TEXT NOT NULL,
          listing_id TEXT,
          pms TEXT,
          listing_id_key TEXT GENERATED ALWAYS AS (COALESCE(listing_id, '__global__')) STORED,
          pms_key TEXT GENERATED ALWAYS AS (COALESCE(pms, '__global__')) STORED,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(config_key, listing_id_key, pms_key)
        );
        CREATE INDEX idx_uc_key ON user_config(config_key);
        CREATE INDEX idx_uc_listing ON user_config(listing_id, pms);
      `);
    },
  },
];

/**
 * Run all pending migrations against the given database.
 *
 * Uses `user_version` pragma to track which migrations have been applied.
 * Each migration runs in its own transaction. Idempotent -- safe to call
 * multiple times.
 *
 * @param db - An open better-sqlite3 Database instance.
 * @returns The number of migrations applied (0 if already up to date).
 */
export function runMigrations(db: Database.Database): number {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return 0;
  }

  for (const migration of pending) {
    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });

    applyMigration();
  }

  return pending.length;
}
