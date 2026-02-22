import { z } from "zod";
import { ListingIdSchema, PmsNameSchema } from "./common.js";

// --- Input schemas ---

/** Input for GET /v1/listings - fetch all listings in an account */
export const GetListingsInputSchema = z.object({
  skip_hidden: z
    .boolean()
    .optional()
    .describe("Filter out hidden listings (default: include all)"),
  only_syncing: z
    .boolean()
    .optional()
    .describe("Only return listings with active price sync enabled"),
});

/** Input for GET /v1/listings/{listing_id} - fetch a single listing */
export const GetListingInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The PriceLabs listing ID to fetch"),
  pms: PmsNameSchema.describe("PMS identifier for this listing (e.g., 'airbnb')"),
});

/** A single listing update entry within the UpdateListings request */
export const ListingUpdateEntrySchema = z.object({
  id: z.string().describe("PriceLabs listing ID (required)"),
  pms: z.string().describe("PMS identifier (required, e.g., 'airbnb')"),
  min: z
    .number()
    .optional()
    .describe("New minimum nightly price"),
  base: z
    .number()
    .optional()
    .describe("New base price anchor"),
  max: z
    .number()
    .optional()
    .describe("New maximum nightly price"),
  tags: z
    .array(z.string())
    .max(10)
    .optional()
    .describe("Listing tags (max 10 tags)"),
});

/**
 * Input for POST /v1/listings - update one or more listings.
 * Locked decision: write tools require a reason parameter for audit trail.
 */
export const UpdateListingsInputSchema = z.object({
  listings: z
    .array(ListingUpdateEntrySchema)
    .min(1)
    .describe("Array of listing updates to apply"),
  reason: z
    .string()
    .min(10)
    .describe("Rationale for this change (min 10 chars, required for audit trail)"),
});

/** Input for POST /v1/add_listing_data - import a newly added listing from PMS */
export const AddListingInputSchema = z.object({
  listing_id: ListingIdSchema.describe("The listing ID to import from PMS"),
  pms_name: z
    .string()
    .describe("PMS name (currently only 'bookingsync' is supported)"),
});
