import type { Listing, PriceEntry, NeighborhoodData } from "./types.js";
/**
 * Compute derived fields from a listing's raw data.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export declare function computeListingFields(listing: Listing): Record<string, unknown>;
/**
 * Compute derived fields from a single price entry.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export declare function computePriceFields(priceEntry: PriceEntry): Record<string, unknown>;
/**
 * Compute derived fields from neighborhood data combined with listing data.
 * Determines where the listing's base_price falls relative to market percentiles.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export declare function computeNeighborhoodFields(neighborhood: NeighborhoodData, listing: Listing): Record<string, unknown>;
