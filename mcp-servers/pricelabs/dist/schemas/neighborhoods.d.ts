import { z } from "zod";
/**
 * Input for GET /v1/neighborhood_data - fetch neighborhood comparison data.
 * Returns percentile pricing, occupancy, and market KPI data for comparable listings.
 */
export declare const GetNeighborhoodInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pms: string;
    listing_id: string;
    start_date?: string | undefined;
    end_date?: string | undefined;
}, {
    pms: string;
    listing_id: string;
    start_date?: string | undefined;
    end_date?: string | undefined;
}>;
