/**
 * Scale/feedback-loop MCP tools: pricelabs_record_change,
 * pricelabs_get_change_impact, pricelabs_get_user_config,
 * pricelabs_set_user_config.
 *
 * Closes the feedback loop by tracking pricing changes for revenue
 * impact follow-ups (7/14/30 day checks) and gives users control
 * over alert sensitivity thresholds (global and per-listing).
 *
 * Supports requirements: SCALE-02 (change impact tracking),
 * SCALE-04 (configurable alert thresholds).
 *
 * @module tools/scale
 */
import { RecordChangeInputSchema, GetChangeImpactInputSchema, GetUserConfigInputSchema, SetUserConfigInputSchema, } from "../schemas/scale.js";
import { createChangeTrackingQueries } from "../db/queries/change-tracking.js";
import { createUserConfigQueries } from "../db/queries/user-config.js";
/** System default thresholds returned alongside user configs for context. */
const SYSTEM_DEFAULTS = {
    occupancy_gap_threshold: 20,
    revenue_drop_threshold: -25,
    pace_lag_threshold: -20,
    health_score_threshold: 50,
    stale_sync_hours: 48,
};
/** Validation bounds for each config key. */
const CONFIG_BOUNDS = {
    occupancy_gap_threshold: { min: 0, max: 100 },
    revenue_drop_threshold: { min: -100, max: 0 },
    pace_lag_threshold: { min: -100, max: 0 },
    health_score_threshold: { min: 0, max: 100 },
    stale_sync_hours: { min: 1, max: 720 },
};
/**
 * Format a Date as YYYY-MM-DD string.
 */
function toDateString(d) {
    return d.toISOString().slice(0, 10);
}
/**
 * Add days to a Date and return a new Date.
 */
function addDays(base, days) {
    const result = new Date(base);
    result.setDate(result.getDate() + days);
    return result;
}
/**
 * Register scale/feedback-loop MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_record_change (record an executed pricing change for impact tracking)
 * - pricelabs_get_change_impact (query pending and completed impact assessments)
 * - pricelabs_get_user_config (read alert thresholds with system defaults)
 * - pricelabs_set_user_config (set alert thresholds with validation)
 *
 * @param server - MCP server instance
 * @param db - An open better-sqlite3 Database instance (with migrations applied)
 */
export function registerScaleTools(server, db) {
    const changeTrackingQueries = createChangeTrackingQueries(db);
    const userConfigQueries = createUserConfigQueries(db);
    // --- pricelabs_record_change ---
    server.registerTool("pricelabs_record_change", {
        description: "Record an executed pricing change for revenue impact tracking. Creates a change_tracking entry with 7-day, 14-day, and 30-day follow-up check dates. Call this after every successful pricelabs_set_overrides, pricelabs_update_listings, or pricelabs_delete_overrides execution.",
        inputSchema: RecordChangeInputSchema.shape,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const today = new Date();
            const changeDate = toDateString(today);
            const check7dDue = toDateString(addDays(today, 7));
            const check14dDue = toDateString(addDays(today, 14));
            const check30dDue = toDateString(addDays(today, 30));
            const result = changeTrackingQueries.insertTracking.run({
                audit_log_id: params.audit_log_id,
                listing_id: params.listing_id,
                pms: params.pms,
                change_type: params.change_type,
                change_date: changeDate,
                affected_dates_start: params.affected_dates_start ?? null,
                affected_dates_end: params.affected_dates_end ?? null,
                before_json: params.before_json,
                after_json: params.after_json,
                check_7d_due: check7dDue,
                check_14d_due: check14dDue,
                check_30d_due: check30dDue,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            id: Number(result.lastInsertRowid),
                            change_date: changeDate,
                            check_7d_due: check7dDue,
                            check_14d_due: check14dDue,
                            check_30d_due: check30dDue,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
    // --- pricelabs_get_change_impact ---
    server.registerTool("pricelabs_get_change_impact", {
        description: "Query pending and completed revenue impact assessments from change tracking. Supports filtering by listing and/or pending-only (overdue checks). Use for daily impact review (SCALE-02) and 7/14/30 day follow-up workflows.",
        inputSchema: GetChangeImpactInputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const limit = params.limit ?? 20;
            let rows;
            if (params.pending_only) {
                // Get entries with overdue checks as of today
                const today = toDateString(new Date());
                rows = changeTrackingQueries.getPendingChecks.all({ today });
            }
            else if (params.listing_id && params.pms) {
                // Get entries for a specific listing
                rows = changeTrackingQueries.getByListing.all({
                    listing_id: params.listing_id,
                    pms: params.pms,
                    limit,
                });
            }
            else {
                // Get all entries -- use far-future date to match everything
                rows = changeTrackingQueries.getPendingChecks.all({
                    today: "9999-12-31",
                });
            }
            // Apply limit for pending checks (getByListing handles it via SQL)
            if (params.pending_only || (!params.listing_id && !params.pms)) {
                rows = rows.slice(0, limit);
            }
            // Parse JSON fields for readability
            const enriched = rows.map((row) => ({
                ...row,
                before_json: safeJsonParse(row.before_json),
                after_json: safeJsonParse(row.after_json),
                check_7d_result_json: row.check_7d_result_json
                    ? safeJsonParse(row.check_7d_result_json)
                    : null,
                check_14d_result_json: row.check_14d_result_json
                    ? safeJsonParse(row.check_14d_result_json)
                    : null,
                check_30d_result_json: row.check_30d_result_json
                    ? safeJsonParse(row.check_30d_result_json)
                    : null,
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ entries: enriched, count: enriched.length }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
    // --- pricelabs_get_user_config ---
    server.registerTool("pricelabs_get_user_config", {
        description: "Read alert threshold configuration. Returns per-listing values merged with global defaults, or global-only if no listing specified. Always includes system defaults so the agent knows effective values. Use to check current thresholds before detect_underperformers (SCALE-04).",
        inputSchema: GetUserConfigInputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            let configs;
            let scope;
            if (params.listing_id && params.pms) {
                configs = userConfigQueries.getAllForListing.all({
                    listing_id: params.listing_id,
                    pms: params.pms,
                });
                scope = "listing";
            }
            else {
                configs = userConfigQueries.getAllGlobal.all({});
                scope = "global";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            configs,
                            system_defaults: SYSTEM_DEFAULTS,
                            scope,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
    // --- pricelabs_set_user_config ---
    server.registerTool("pricelabs_set_user_config", {
        description: "Set an alert threshold configuration value. Validates bounds per config key. Set for a specific listing (with pms) or globally (omit both listing_id and pms). Returns the saved config entry. Use to customize alert sensitivity (SCALE-04).",
        inputSchema: SetUserConfigInputSchema.shape,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            // Validate listing_id / pms pairing
            if (params.listing_id && !params.pms) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: "pms is required when listing_id is provided. Both must be set for per-listing config, or both omitted for global.",
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            if (!params.listing_id && params.pms) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: "listing_id is required when pms is provided. Both must be set for per-listing config, or both omitted for global.",
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Validate config_value bounds
            const bounds = CONFIG_BOUNDS[params.config_key];
            if (bounds) {
                if (params.config_value < bounds.min ||
                    params.config_value > bounds.max) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: `${params.config_key} must be between ${bounds.min} and ${bounds.max}. Got: ${params.config_value}`,
                                }),
                            },
                        ],
                        isError: true,
                    };
                }
            }
            // Check if existing config exists (to report insert vs update)
            const listingId = params.listing_id ?? null;
            const pms = params.pms ?? null;
            const existing = userConfigQueries.getConfigValue.get({
                config_key: params.config_key,
                listing_id: listingId,
                pms: pms,
            });
            // Upsert the config
            userConfigQueries.upsertConfig.run({
                config_key: params.config_key,
                config_value: String(params.config_value),
                listing_id: listingId,
                pms: pms,
            });
            const action = existing ? "updated" : "inserted";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            action,
                            config_key: params.config_key,
                            config_value: params.config_value,
                            scope: listingId ? "listing" : "global",
                            listing_id: listingId,
                            pms: pms,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
}
/**
 * Safely parse a JSON string, returning the original string if parsing fails.
 */
function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    }
    catch {
        return str;
    }
}
