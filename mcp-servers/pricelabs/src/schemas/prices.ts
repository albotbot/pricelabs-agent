import { z } from "zod";
import { ListingIdSchema, PmsNameSchema, DateStringSchema } from "./common.js";

/**
 * Input for POST /v1/listing_prices - fetch calculated prices for a listing.
 * This is the most important endpoint for agent development.
 */
export const GetPricesInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The PriceLabs listing ID to fetch prices for"),
  pms: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
  start_date: DateStringSchema.describe("Start date for the price range (YYYY-MM-DD)"),
  end_date: DateStringSchema.describe("End date for the price range (YYYY-MM-DD)"),
  currency: z
    .string()
    .optional()
    .describe("Currency code to return prices in (defaults to listing currency)"),
});

/**
 * Input for POST /v1/push_prices - trigger a price sync push to PMS.
 * This is a write action that forces PriceLabs to push current calculated prices to the PMS.
 */
export const PushPricesInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The listing ID to push prices for"),
  pms_name: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
  reason: z
    .string()
    .min(10)
    .describe("Rationale for triggering a manual price push (min 10 chars, required for audit trail)"),
});

/**
 * Input for GET /v1/fetch_rate_plans - fetch rate plan adjustments for a listing.
 */
export const GetRatePlansInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The listing ID to fetch rate plans for"),
  pms_name: PmsNameSchema.describe("PMS identifier (e.g., 'airbnb')"),
});
