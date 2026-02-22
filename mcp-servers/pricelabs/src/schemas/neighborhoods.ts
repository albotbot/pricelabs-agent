import { z } from "zod";
import { ListingIdSchema, PmsNameSchema, DateStringSchema } from "./common.js";

/**
 * Input for GET /v1/neighborhood_data - fetch neighborhood comparison data.
 * Returns percentile pricing, occupancy, and market KPI data for comparable listings.
 */
export const GetNeighborhoodInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The listing ID to fetch neighborhood data for"),
  pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
  start_date: DateStringSchema.optional().describe("Start date for neighborhood data range (YYYY-MM-DD)"),
  end_date: DateStringSchema.optional().describe("End date for neighborhood data range (YYYY-MM-DD)"),
});
