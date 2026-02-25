import { z } from "zod";
import { ListingIdSchema, PmsNameSchema, DateStringSchema, CheckInOutSchema } from "./common.js";
/** Input for GET /v1/listings/{listing_id}/overrides - fetch DSOs for a listing */
export const GetOverridesInputSchema = z.object({
    listing_id: ListingIdSchema.describe("The listing ID to fetch overrides for"),
    pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
    start_date: DateStringSchema.optional().describe("Filter overrides starting from this date (YYYY-MM-DD)"),
    end_date: DateStringSchema.optional().describe("Filter overrides up to this date (YYYY-MM-DD)"),
});
/** A single date-specific override entry for the SetOverrides request */
export const OverrideWriteEntrySchema = z
    .object({
    date: DateStringSchema.describe("The date for this override (YYYY-MM-DD)"),
    price_type: z
        .enum(["fixed", "percentage"])
        .describe("Override price type: 'fixed' for absolute price, 'percentage' for percent adjustment (-75 to 500)"),
    price_value: z
        .number()
        .describe("Override price value: absolute price if 'fixed', percent adjustment if 'percentage'"),
    currency: z
        .string()
        .optional()
        .describe("Currency code (REQUIRED when price_type is 'fixed', must match PMS currency)"),
    min_stay: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Minimum stay override (integer > 0)"),
    check_in: CheckInOutSchema.optional().describe("Check-in day restriction (7-char binary Mon-Sun)"),
    check_out: CheckInOutSchema.optional().describe("Check-out day restriction (7-char binary Mon-Sun)"),
})
    .superRefine((data, ctx) => {
    // DSO validation: percentage must be in range -75 to 500
    if (data.price_type === "percentage") {
        if (data.price_value < -75 || data.price_value > 500) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Percentage override must be between -75 and 500",
                path: ["price_value"],
            });
        }
    }
    // DSO validation: fixed price requires currency
    if (data.price_type === "fixed" && !data.currency) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Currency is required when price_type is 'fixed' (must match PMS currency)",
            path: ["currency"],
        });
    }
});
/**
 * Input for POST /v1/listings/{listing_id}/overrides - set date-specific overrides.
 * Locked decision: write tools require a reason parameter for audit trail.
 * DSO validation enforces: percentage range -75 to 500, currency required for fixed.
 */
export const SetOverridesInputSchema = z.object({
    listing_id: ListingIdSchema.describe("The listing ID to set overrides for"),
    pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
    overrides: z
        .array(OverrideWriteEntrySchema)
        .min(1)
        .describe("Array of date-specific overrides to apply"),
    reason: z
        .string()
        .min(10)
        .describe("Rationale for this override change (min 10 chars, required for audit trail)"),
});
/**
 * Input for DELETE /v1/listings/{listing_id}/overrides - remove date-specific overrides.
 * Locked decision: write tools require a reason parameter for audit trail.
 */
export const DeleteOverridesInputSchema = z.object({
    listing_id: ListingIdSchema.describe("The listing ID to delete overrides from"),
    pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
    dates: z
        .array(DateStringSchema)
        .min(1)
        .describe("Array of dates to remove overrides for (YYYY-MM-DD format)"),
    reason: z
        .string()
        .min(10)
        .describe("Rationale for deleting these overrides (min 10 chars, required for audit trail)"),
});
