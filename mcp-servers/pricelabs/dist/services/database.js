/**
 * Database service -- SQLite singleton factory.
 *
 * Creates a better-sqlite3 database instance with WAL mode, busy timeout,
 * foreign keys, and synchronous NORMAL. Does NOT export a singleton --
 * the caller (index.ts) creates and manages the instance.
 *
 * @module services/database
 */
import Database from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
/**
 * Initialize a SQLite database at the given path with production-ready pragmas.
 *
 * @param dbPath - Optional path to the database file. Defaults to
 *   `PRICELABS_DB_PATH` env var, or `~/.pricelabs-agent/data.sqlite`.
 * @returns An open better-sqlite3 Database instance.
 */
export function initializeDatabase(dbPath) {
    const resolvedPath = dbPath ??
        process.env.PRICELABS_DB_PATH ??
        path.join(process.env.HOME || "/tmp", ".pricelabs-agent", "data.sqlite");
    // Ensure parent directory exists before opening
    const dir = path.dirname(resolvedPath);
    mkdirSync(dir, { recursive: true });
    const db = new Database(resolvedPath);
    // Set pragmas in order: WAL, busy timeout, foreign keys, synchronous
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
    return db;
}
