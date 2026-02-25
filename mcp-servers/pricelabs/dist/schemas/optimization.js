import { z } from "zod";
// --- Input schemas for optimization tools ---
/** Input for pricelabs_snapshot_before_write - capture listing state before write */
export const SnapshotBeforeWriteInputSchema = z.object({
    listing_id: z.string().describe("PriceLabs listing ID to snapshot"),
    pms: z.string().describe("PMS identifier (e.g., 'airbnb', 'bookingsync')"),
    operation_type: z
        .enum(["set_overrides", "update_listing", "delete_overrides"])
        .describe("Type of write operation about to be performed"),
    start_date: z
        .string()
        .optional()
        .describe("Start date for override date range (YYYY-MM-DD). Required for set_overrides and delete_overrides."),
    end_date: z
        .string()
        .optional()
        .describe("End date for override date range (YYYY-MM-DD). Required for set_overrides and delete_overrides."),
    channel: z
        .string()
        .optional()
        .describe("Channel context: 'slack', 'telegram', 'cron', 'interactive'"),
});
