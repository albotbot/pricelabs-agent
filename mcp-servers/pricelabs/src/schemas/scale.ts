import { z } from "zod";

// --- Input schemas for scale/feedback-loop tools ---

/** Input for pricelabs_get_change_impact - query change tracking entries */
export const GetChangeImpactInputSchema = z.object({
  listing_id: z
    .string()
    .optional()
    .describe("Filter by listing ID. Returns only changes for this listing."),
  pms: z
    .string()
    .optional()
    .describe(
      "PMS name (e.g., 'airbnb', 'bookingsync'). Required if listing_id is provided.",
    ),
  pending_only: z
    .boolean()
    .optional()
    .describe(
      "If true, only return changes with pending (overdue) check intervals. Default false.",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of entries to return. Default 20."),
});

/** Inferred type for GetChangeImpactInputSchema */
export type GetChangeImpactInput = z.infer<typeof GetChangeImpactInputSchema>;

/** Input for pricelabs_record_change - record an executed pricing change */
export const RecordChangeInputSchema = z.object({
  audit_log_id: z
    .number()
    .describe("FK to audit_log.id for the execution entry"),
  listing_id: z.string().describe("PriceLabs listing ID"),
  pms: z.string().describe("PMS identifier (e.g., 'airbnb', 'bookingsync')"),
  change_type: z
    .enum(["set_overrides", "update_listing", "delete_overrides"])
    .describe("Type of pricing change that was executed"),
  affected_dates_start: z
    .string()
    .optional()
    .describe(
      "Start of affected date range for DSO changes (YYYY-MM-DD). Optional for non-DSO changes.",
    ),
  affected_dates_end: z
    .string()
    .optional()
    .describe(
      "End of affected date range for DSO changes (YYYY-MM-DD). Optional for non-DSO changes.",
    ),
  before_json: z
    .string()
    .describe("JSON snapshot of values before the change"),
  after_json: z.string().describe("JSON of what was changed to"),
});

/** Inferred type for RecordChangeInputSchema */
export type RecordChangeInput = z.infer<typeof RecordChangeInputSchema>;

/** Input for pricelabs_get_user_config - read alert thresholds */
export const GetUserConfigInputSchema = z.object({
  listing_id: z
    .string()
    .optional()
    .describe(
      "Get config for specific listing (merged with global defaults). Omit for global-only.",
    ),
  pms: z
    .string()
    .optional()
    .describe(
      "PMS name (e.g., 'airbnb', 'bookingsync'). Required if listing_id is provided.",
    ),
});

/** Inferred type for GetUserConfigInputSchema */
export type GetUserConfigInput = z.infer<typeof GetUserConfigInputSchema>;

/** Input for pricelabs_set_user_config - set alert thresholds */
export const SetUserConfigInputSchema = z.object({
  config_key: z
    .enum([
      "occupancy_gap_threshold",
      "revenue_drop_threshold",
      "pace_lag_threshold",
      "health_score_threshold",
      "stale_sync_hours",
    ])
    .describe("Configuration key to set"),
  config_value: z.number().describe("Numeric threshold value"),
  listing_id: z
    .string()
    .optional()
    .describe(
      "Set for specific listing. Omit for global default. Both listing_id and pms must be provided together or both omitted.",
    ),
  pms: z
    .string()
    .optional()
    .describe(
      "PMS name (e.g., 'airbnb', 'bookingsync'). Required if listing_id is provided.",
    ),
});

/** Inferred type for SetUserConfigInputSchema */
export type SetUserConfigInput = z.infer<typeof SetUserConfigInputSchema>;
