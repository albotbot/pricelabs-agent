import { z } from "zod";
import { ListingIdSchema, PmsNameSchema, DateStringSchema } from "./common.js";
/**
 * Input for GET /v1/reservation_data - fetch reservations from PMS.
 * Note: start_date and end_date are REQUIRED by the PriceLabs API.
 * The tool handler should provide sensible defaults (e.g., past 90 days to next 30 days)
 * if the agent doesn't specify, but the schema marks them as required since the API
 * will reject requests without them.
 */
export const GetReservationsInputSchema = z.object({
    listing_id: ListingIdSchema.describe("The listing ID to fetch reservations for"),
    pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
    start_date: DateStringSchema.describe("Start date for the reservation query range (YYYY-MM-DD, required by API)"),
    end_date: DateStringSchema.describe("End date for the reservation query range (YYYY-MM-DD, required by API)"),
    limit: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe("Maximum number of reservations to return (default: 100, max: 1000)"),
    offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Offset for pagination (default: 0)"),
});
