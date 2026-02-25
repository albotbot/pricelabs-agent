import { z } from "zod";
/**
 * Input for POST /v1/listing_prices - fetch calculated prices for a listing.
 * This is the most important endpoint for agent development.
 */
export declare const GetPricesInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    start_date: z.ZodString;
    end_date: z.ZodString;
    currency: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pms: string;
    listing_id: string;
    start_date: string;
    end_date: string;
    currency?: string | undefined;
}, {
    pms: string;
    listing_id: string;
    start_date: string;
    end_date: string;
    currency?: string | undefined;
}>;
/**
 * Input for POST /v1/push_prices - trigger a price sync push to PMS.
 * This is a write action that forces PriceLabs to push current calculated prices to the PMS.
 */
export declare const PushPricesInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms_name: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    listing_id: string;
    pms_name: string;
}, {
    reason: string;
    listing_id: string;
    pms_name: string;
}>;
/**
 * Input for GET /v1/fetch_rate_plans - fetch rate plan adjustments for a listing.
 */
export declare const GetRatePlansInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    listing_id: string;
    pms_name: string;
}, {
    listing_id: string;
    pms_name: string;
}>;
