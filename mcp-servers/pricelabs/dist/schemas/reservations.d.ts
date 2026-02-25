import { z } from "zod";
/**
 * Input for GET /v1/reservation_data - fetch reservations from PMS.
 * Note: start_date and end_date are REQUIRED by the PriceLabs API.
 * The tool handler should provide sensible defaults (e.g., past 90 days to next 30 days)
 * if the agent doesn't specify, but the schema marks them as required since the API
 * will reject requests without them.
 */
export declare const GetReservationsInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    start_date: z.ZodString;
    end_date: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pms: string;
    listing_id: string;
    start_date: string;
    end_date: string;
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    pms: string;
    listing_id: string;
    start_date: string;
    end_date: string;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
