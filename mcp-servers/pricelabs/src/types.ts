import { z } from "zod";

// --- Import all schemas ---

import {
  ListingResponseSchema,
  PriceEntrySchema,
  PricesResponseSchema,
  OverrideEntrySchema,
  NeighborhoodDataSchema,
  ReservationEntrySchema,
  ReservationsResponseSchema,
  ResponseMetaSchema,
} from "./schemas/common.js";

import {
  GetListingsInputSchema,
  GetListingInputSchema,
  UpdateListingsInputSchema,
  AddListingInputSchema,
  ListingUpdateEntrySchema,
} from "./schemas/listings.js";

import {
  GetPricesInputSchema,
  PushPricesInputSchema,
  GetRatePlansInputSchema,
} from "./schemas/prices.js";

import {
  GetOverridesInputSchema,
  SetOverridesInputSchema,
  DeleteOverridesInputSchema,
  OverrideWriteEntrySchema,
} from "./schemas/overrides.js";

import { GetNeighborhoodInputSchema } from "./schemas/neighborhoods.js";

import { GetReservationsInputSchema } from "./schemas/reservations.js";

// --- Inferred types from Zod schemas (no manual duplication) ---

// Listing types
export type GetListingsInput = z.infer<typeof GetListingsInputSchema>;
export type GetListingInput = z.infer<typeof GetListingInputSchema>;
export type UpdateListingsInput = z.infer<typeof UpdateListingsInputSchema>;
export type ListingUpdateEntry = z.infer<typeof ListingUpdateEntrySchema>;
export type AddListingInput = z.infer<typeof AddListingInputSchema>;
export type Listing = z.infer<typeof ListingResponseSchema>;

// Price types
export type GetPricesInput = z.infer<typeof GetPricesInputSchema>;
export type PushPricesInput = z.infer<typeof PushPricesInputSchema>;
export type GetRatePlansInput = z.infer<typeof GetRatePlansInputSchema>;
export type PriceEntry = z.infer<typeof PriceEntrySchema>;
export type PricesResponse = z.infer<typeof PricesResponseSchema>;

// Override types
export type GetOverridesInput = z.infer<typeof GetOverridesInputSchema>;
export type SetOverridesInput = z.infer<typeof SetOverridesInputSchema>;
export type DeleteOverridesInput = z.infer<typeof DeleteOverridesInputSchema>;
export type OverrideWriteEntry = z.infer<typeof OverrideWriteEntrySchema>;
export type OverrideEntry = z.infer<typeof OverrideEntrySchema>;

// Neighborhood types
export type GetNeighborhoodInput = z.infer<typeof GetNeighborhoodInputSchema>;
export type NeighborhoodData = z.infer<typeof NeighborhoodDataSchema>;

// Reservation types
export type GetReservationsInput = z.infer<typeof GetReservationsInputSchema>;
export type ReservationEntry = z.infer<typeof ReservationEntrySchema>;
export type ReservationsResponse = z.infer<typeof ReservationsResponseSchema>;

// Response metadata type
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

// --- Generic tool response envelope ---

/**
 * Every tool response wraps raw API data with computed fields and metadata.
 * Enforces the locked decision: every response includes cache_age_seconds and data_source.
 */
export interface ToolResponse<T> {
  /** Raw PriceLabs API response data */
  data: T;
  /** Computed/derived fields calculated from the raw data */
  computed: Record<string, unknown>;
  /** Response metadata including cache and rate limit info */
  meta: {
    /** Age of cached data in seconds (0 if live fetch) */
    cache_age_seconds: number;
    /** Whether data came from a live API call or the cache */
    data_source: "live" | "cached";
    /** Estimated remaining API calls in the current rate limit window */
    api_calls_remaining: number;
    /** ISO timestamp of when the data was fetched or served */
    fetched_at: string;
  };
}
