import { z } from "zod";

// --- Input schemas for monitoring and audit tools ---

/** Input for pricelabs_get_booking_pace - calculate booking pace vs STLY */
export const GetBookingPaceInputSchema = z.object({
  listing_id: z.string().describe("PriceLabs listing ID"),
  pms: z.string().describe("PMS name"),
  cutoff_days: z
    .array(z.number())
    .optional()
    .describe(
      "Pace cutoff windows in days. Default: [7, 30, 60, 90]",
    ),
});

/** Input for pricelabs_log_action - record agent action in audit log */
export const LogActionInputSchema = z.object({
  action_type: z
    .enum([
      "recommendation",
      "approval",
      "execution",
      "alert",
      "report",
      "snapshot",
      "rollback",
    ])
    .describe("Type of agent action"),
  listing_id: z
    .string()
    .optional()
    .describe(
      "Listing ID if action is listing-specific. Omit for portfolio-level.",
    ),
  pms: z
    .string()
    .optional()
    .describe("PMS name if listing-specific"),
  description: z
    .string()
    .describe("Human-readable description of the action"),
  details_json: z
    .string()
    .optional()
    .describe("JSON string with action-specific details"),
  channel: z
    .string()
    .optional()
    .describe(
      "Channel context: 'slack', 'telegram', 'cron', 'interactive'",
    ),
});

/** Input for pricelabs_get_audit_log - retrieve audit trail entries */
export const GetAuditLogInputSchema = z.object({
  listing_id: z
    .string()
    .optional()
    .describe("Filter by listing ID"),
  action_type: z
    .enum([
      "recommendation",
      "approval",
      "execution",
      "alert",
      "report",
      "snapshot",
      "rollback",
    ])
    .optional()
    .describe("Filter by action type"),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start date for range query (ISO datetime). Defaults to 7 days ago.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End date for range query (ISO datetime). Defaults to now.",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum entries to return. Default 50."),
});
