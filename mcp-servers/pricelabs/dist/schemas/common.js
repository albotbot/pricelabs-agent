import { z } from "zod";
// --- Shared primitives ---
/** PriceLabs listing ID */
export const ListingIdSchema = z
    .string()
    .describe("PriceLabs listing ID (unique identifier from the PMS)");
/** PMS name identifier (e.g., "airbnb", "vrbo", "rentalsunited") */
export const PmsNameSchema = z
    .string()
    .describe("PMS identifier (e.g., 'airbnb', 'vrbo', 'rentalsunited')");
/** Date string in YYYY-MM-DD format */
export const DateStringSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .describe("Date in YYYY-MM-DD format");
/**
 * Check-in/check-out day-of-week binary string.
 * 7-character string where each character is '0' or '1' representing Mon-Sun.
 * Example: "1111100" means Mon-Fri allowed, Sat-Sun not allowed.
 */
export const CheckInOutSchema = z
    .string()
    .regex(/^[01]{7}$/, "Must be a 7-character binary string (Mon-Sun, e.g., '1111100')")
    .describe("7-character binary string representing allowed days Mon-Sun (e.g., '1111100' = weekdays only)");
// --- Response envelope ---
/** Metadata included in every tool response */
export const ResponseMetaSchema = z.object({
    cache_age_seconds: z
        .number()
        .describe("Age of cached data in seconds (0 if live fetch)"),
    data_source: z
        .enum(["live", "cached"])
        .describe("Whether data came from a live API call or the cache"),
    api_calls_remaining: z
        .number()
        .describe("Estimated remaining API calls in the current rate limit window"),
    fetched_at: z
        .string()
        .describe("ISO timestamp of when the data was fetched or served"),
});
/**
 * Generic tool response envelope.
 * Every tool response wraps raw API data with computed fields and metadata.
 * This enforces the locked decision that every response includes cache_age_seconds and data_source.
 */
export function ToolResponseSchema(dataSchema) {
    return z.object({
        data: dataSchema.describe("Raw PriceLabs API response data"),
        computed: z
            .record(z.string(), z.unknown())
            .describe("Computed/derived fields calculated from the raw data"),
        meta: ResponseMetaSchema.describe("Response metadata including cache and rate limit info"),
    });
}
// --- Listing response schema (shared across listing endpoints) ---
export const ListingResponseSchema = z.object({
    id: z.string().describe("Listing ID"),
    pms: z.string().describe("PMS name (e.g., 'airbnb')"),
    name: z.string().describe("Listing name/title"),
    latitude: z.number().nullable().optional().describe("Listing latitude coordinate"),
    longitude: z.number().nullable().optional().describe("Listing longitude coordinate"),
    country: z.string().nullable().optional().describe("Country of the listing"),
    city_name: z.string().nullable().optional().describe("City name"),
    state: z.string().nullable().optional().describe("State or province"),
    no_of_bedrooms: z.number().nullable().optional().describe("Number of bedrooms"),
    min: z.number().nullable().optional().describe("Minimum nightly price"),
    base: z.number().nullable().optional().describe("Base price anchor"),
    max: z.unknown().nullable().optional().describe("Maximum nightly price (may be number or object)"),
    group: z.string().nullable().optional().describe("Listing group name"),
    subgroup: z.string().nullable().optional().describe("Listing subgroup name"),
    tags: z.array(z.string()).optional().describe("Listing tags"),
    notes: z.string().nullable().optional().describe("User notes on the listing"),
    isHidden: z.boolean().optional().describe("Whether the listing is hidden in PriceLabs"),
    push_enabled: z.boolean().optional().describe("Whether price sync is enabled"),
    occupancy_next_7: z.number().nullable().optional().describe("Listing occupancy rate for the next 7 days (0-100)"),
    occupancy_next_30: z.number().nullable().optional().describe("Listing occupancy rate for the next 30 days (0-100)"),
    occupancy_next_60: z.number().nullable().optional().describe("Listing occupancy rate for the next 60 days (0-100)"),
    occupancy_next_90: z.number().nullable().optional().describe("Listing occupancy rate for the next 90 days (0-100)"),
    market_occupancy_next_7: z.number().nullable().optional().describe("Market average occupancy for the next 7 days (0-100)"),
    market_occupancy_next_30: z.number().nullable().optional().describe("Market average occupancy for the next 30 days (0-100)"),
    market_occupancy_next_60: z.number().nullable().optional().describe("Market average occupancy for the next 60 days (0-100)"),
    market_occupancy_next_90: z.number().nullable().optional().describe("Market average occupancy for the next 90 days (0-100)"),
    revenue_past_7: z.number().nullable().optional().describe("Revenue earned in the past 7 days"),
    stly_revenue_past_7: z.number().nullable().optional().describe("Same-time-last-year revenue for the past 7-day window (-1 if unavailable)"),
    recommended_base_price: z.string().nullable().optional().describe("PriceLabs recommended base price (string, must parse to number)"),
    last_date_pushed: z.string().nullable().optional().describe("ISO timestamp of the last price sync push to PMS"),
    last_refreshed_at: z.string().nullable().optional().describe("ISO timestamp of the last data refresh from PMS"),
    health_7_day: z.string().nullable().optional().describe("7-day health score indicator"),
    health_30_day: z.string().nullable().optional().describe("30-day health score indicator"),
    health_60_day: z.string().nullable().optional().describe("60-day health score indicator"),
    currency: z.string().nullable().optional().describe("Listing currency code (e.g., 'USD', 'EUR')"),
});
// --- Price entry response schema ---
export const PriceEntrySchema = z.object({
    date: z.string().describe("Date for this price entry (YYYY-MM-DD)"),
    price: z.number().describe("Final calculated nightly price"),
    user_price: z.number().nullable().optional().describe("User-customized price override"),
    uncustomized_price: z.number().nullable().optional().describe("Price before user customizations"),
    min_stay: z.number().nullable().optional().describe("Minimum stay requirement for this date"),
    booking_status: z.string().nullable().optional().describe("Booking status for this date (e.g., 'available', 'booked', 'blocked')"),
    booking_status_STLY: z.string().nullable().optional().describe("Same-time-last-year booking status"),
    ADR: z.number().nullable().optional().describe("Average Daily Rate (-1 if unavailable)"),
    ADR_STLY: z.number().nullable().optional().describe("Same-time-last-year ADR (-1 if unavailable)"),
    unbookable: z.union([z.string(), z.number()]).nullable().optional().describe("Whether the date is unbookable ('0' or '1', or 0/1)"),
    weekly_discount: z.number().nullable().optional().describe("Weekly discount percentage"),
    monthly_discount: z.number().nullable().optional().describe("Monthly discount percentage"),
    extra_person_fee: z.number().nullable().optional().describe("Extra person fee amount"),
    extra_person_fee_trigger: z.number().nullable().optional().describe("Guest count threshold for extra person fee"),
    check_in: z.boolean().nullable().optional().describe("Whether check-in is allowed on this date"),
    check_out: z.boolean().nullable().optional().describe("Whether check-out is allowed on this date"),
    demand_color: z.string().nullable().optional().describe("Demand level color hex code (e.g., '#FF0000' for high demand)"),
    demand_desc: z.string().nullable().optional().describe("Human-readable demand description (e.g., 'High Demand')"),
    booked_date: z.string().nullable().optional().describe("Date when this reservation was booked"),
    booked_date_STLY: z.string().nullable().optional().describe("Same-time-last-year booked date"),
    reason: z.record(z.string(), z.unknown()).nullable().optional().describe("Detailed pricing breakdown (when requested)"),
});
// --- Prices response wrapper (includes listing metadata + data array) ---
export const PricesResponseSchema = z.object({
    id: z.string().describe("Listing ID"),
    pms: z.string().describe("PMS name"),
    group: z.string().nullable().optional().describe("Listing group"),
    currency: z.string().nullable().optional().describe("Currency code"),
    last_refreshed_at: z.string().nullable().optional().describe("ISO timestamp of last data refresh"),
    los_pricing: z.record(z.string(), z.unknown()).nullable().optional().describe("Length-of-stay pricing adjustments"),
    data: z.array(PriceEntrySchema).describe("Array of daily price entries"),
    status: z.string().optional().describe("Error status (e.g., 'LISTING_NOT_PRESENT', 'LISTING_NO_DATA', 'LISTING_TOGGLE_OFF')"),
});
// --- Override entry response schema ---
export const OverrideEntrySchema = z.object({
    date: z.string().describe("Override date (YYYY-MM-DD)"),
    price: z.string().nullable().optional().describe("Override price value"),
    price_type: z.string().nullable().optional().describe("Price type: 'fixed' or 'percent'"),
    currency: z.string().nullable().optional().describe("Currency code for fixed price overrides"),
    min_stay: z.number().nullable().optional().describe("Minimum stay override"),
    min_price: z.number().nullable().optional().describe("Minimum price override"),
    min_price_type: z.string().nullable().optional().describe("Min price type: 'fixed', 'percent_base', or 'percent_min'"),
    max_price: z.number().nullable().optional().describe("Maximum price override"),
    max_price_type: z.string().nullable().optional().describe("Max price type: 'fixed', 'percent_base', or 'percent_max'"),
    check_in_check_out_enabled: z.union([z.string(), z.number()]).nullable().optional().describe("Whether check-in/out restrictions are enabled ('0' or '1')"),
    check_in: z.string().nullable().optional().describe("Check-in day restriction (7-char binary Mon-Sun)"),
    check_out: z.string().nullable().optional().describe("Check-out day restriction (7-char binary Mon-Sun)"),
    reason: z.string().nullable().optional().describe("Reason for this override"),
});
// --- Neighborhood data response schema ---
export const NeighborhoodDataSchema = z.object({
    status: z.string().optional().describe("Response status"),
    data: z.object({
        "Listings Used": z.number().nullable().optional().describe("Number of comparable listings used"),
        currency: z.string().nullable().optional().describe("Currency code"),
        source: z.string().nullable().optional().describe("Data source (e.g., 'airbnb', 'vrbo')"),
        lat: z.number().nullable().optional().describe("Latitude of the neighborhood center"),
        lng: z.number().nullable().optional().describe("Longitude of the neighborhood center"),
        "Neighborhood Data Source": z.string().nullable().optional().describe("Source identifier for neighborhood data"),
        "Future Percentile Prices": z.object({
            X_values: z.array(z.string()).optional().describe("Date labels for percentile data"),
            Y_values: z.array(z.array(z.unknown())).optional().describe("Percentile price arrays: [25th, 50th, 75th, median booked, 90th]"),
        }).nullable().optional().describe("Future percentile price data by date"),
        "Summary Table Base Price": z.record(z.string(), z.unknown()).nullable().optional().describe("Summary base price statistics"),
        "Future Occ/New/Canc": z.record(z.string(), z.unknown()).nullable().optional().describe("Future occupancy, new bookings, and cancellations"),
        "Market KPI": z.record(z.string(), z.unknown()).nullable().optional().describe("Market key performance indicators"),
    }).describe("Neighborhood comparison data"),
});
// --- Reservation entry response schema ---
export const ReservationEntrySchema = z.object({
    listing_id: z.string().nullable().optional().describe("Listing ID for this reservation"),
    listing_name: z.string().nullable().optional().describe("Listing name"),
    reservation_id: z.string().nullable().optional().describe("Unique reservation ID"),
    check_in: z.string().nullable().optional().describe("Check-in date (ISO format)"),
    check_out: z.string().nullable().optional().describe("Check-out date (ISO format)"),
    booked_date: z.string().nullable().optional().describe("When the reservation was booked (ISO timestamp)"),
    cancelled_on: z.string().nullable().optional().describe("When the reservation was cancelled (ISO timestamp, null if active)"),
    booking_status: z.string().nullable().optional().describe("Reservation status: 'booked' or 'cancelled'"),
    rental_revenue: z.string().nullable().optional().describe("Rental revenue amount (string, parse to number)"),
    total_cost: z.string().nullable().optional().describe("Total cost amount (string, parse to number)"),
    no_of_days: z.number().nullable().optional().describe("Number of nights for this reservation"),
    currency: z.string().nullable().optional().describe("Currency code"),
});
export const ReservationsResponseSchema = z.object({
    pms_name: z.string().nullable().optional().describe("PMS name"),
    next_page: z.boolean().nullable().optional().describe("Whether more pages of results are available"),
    data: z.array(ReservationEntrySchema).describe("Array of reservation entries"),
});
