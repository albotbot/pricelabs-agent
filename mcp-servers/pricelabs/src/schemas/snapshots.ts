import { z } from "zod";

// --- Input schemas for snapshot storage/retrieval tools ---

/** Input for pricelabs_store_daily_snapshots - persist today's listing data */
export const StoreDailySnapshotsInputSchema = z.object({
  snapshots: z
    .array(
      z.object({
        listing_id: z.string().describe("PriceLabs listing ID"),
        pms: z.string().describe("PMS name (e.g., 'bookingsync')"),
        name: z.string().optional().describe("Listing display name"),
        health_7_day: z
          .string()
          .optional()
          .describe("7-day health score"),
        health_30_day: z
          .string()
          .optional()
          .describe("30-day health score"),
        health_60_day: z
          .string()
          .optional()
          .describe("60-day health score"),
        occupancy_next_30: z
          .number()
          .optional()
          .describe("Listing occupancy next 30 days (0-100)"),
        market_occupancy_next_30: z
          .number()
          .optional()
          .describe("Market occupancy next 30 days (0-100)"),
        occupancy_gap_pct: z
          .number()
          .optional()
          .describe("Computed occupancy gap vs market (%)"),
        revenue_past_7: z
          .number()
          .optional()
          .describe("Revenue in past 7 days"),
        stly_revenue_past_7: z
          .number()
          .optional()
          .describe("STLY revenue for past 7 days"),
        revenue_vs_stly_pct: z
          .number()
          .optional()
          .describe("Computed revenue vs STLY (%)"),
        base_price: z
          .number()
          .optional()
          .describe("Current base price"),
        recommended_base_price: z
          .number()
          .optional()
          .describe("PriceLabs recommended base price"),
        last_date_pushed: z
          .string()
          .optional()
          .describe("ISO timestamp of last price sync push"),
        days_since_sync: z
          .number()
          .optional()
          .describe("Computed days since last sync"),
        is_stale_sync: z
          .boolean()
          .optional()
          .describe("True if days_since_sync > 2"),
        data_json: z
          .string()
          .describe("Full listing JSON blob for future-proofing"),
      }),
    )
    .describe("Array of listing snapshots to store"),
  snapshot_date: z
    .string()
    .optional()
    .describe(
      "Override snapshot date (YYYY-MM-DD). Defaults to today.",
    ),
});

/** Input for pricelabs_store_price_snapshots - persist daily price data */
export const StorePriceSnapshotsInputSchema = z.object({
  listing_id: z.string().describe("PriceLabs listing ID"),
  pms: z.string().describe("PMS name"),
  prices: z
    .array(
      z.object({
        price_date: z
          .string()
          .describe("Date this price is for (YYYY-MM-DD)"),
        price: z.number().describe("Price for this date"),
        demand_level: z
          .string()
          .optional()
          .describe("Demand level (high, medium, low)"),
        booking_status: z
          .string()
          .optional()
          .describe("Booking status for this date"),
        booking_status_stly: z
          .string()
          .optional()
          .describe("STLY booking status"),
        adr: z.number().optional().describe("Average daily rate"),
        adr_stly: z
          .number()
          .optional()
          .describe("STLY average daily rate"),
      }),
    )
    .describe("Array of price entries to store"),
  snapshot_date: z
    .string()
    .optional()
    .describe(
      "Override snapshot date (YYYY-MM-DD). Defaults to today.",
    ),
});

/** Input for pricelabs_store_reservations - upsert reservation data */
export const StoreReservationsInputSchema = z.object({
  listing_id: z.string().describe("PriceLabs listing ID"),
  pms: z.string().describe("PMS name"),
  reservations: z
    .array(
      z.object({
        reservation_id: z
          .string()
          .describe("Unique reservation identifier"),
        check_in: z
          .string()
          .optional()
          .describe("Check-in date (YYYY-MM-DD)"),
        check_out: z
          .string()
          .optional()
          .describe("Check-out date (YYYY-MM-DD)"),
        booked_date: z
          .string()
          .optional()
          .describe("Date reservation was made"),
        booking_status: z
          .string()
          .optional()
          .describe("'booked' or 'cancelled'"),
        rental_revenue: z
          .number()
          .optional()
          .describe("Revenue from this reservation"),
        total_cost: z
          .number()
          .optional()
          .describe("Total cost of reservation"),
        no_of_days: z
          .number()
          .optional()
          .describe("Number of nights"),
        currency: z.string().optional().describe("Currency code"),
        data_json: z
          .string()
          .optional()
          .describe("Full reservation JSON blob"),
      }),
    )
    .describe("Array of reservations to upsert"),
});

/** Input for pricelabs_get_snapshots - retrieve historical snapshots */
export const GetSnapshotsInputSchema = z.object({
  listing_id: z
    .string()
    .optional()
    .describe("Filter by listing ID. Omit for all listings."),
  pms: z
    .string()
    .optional()
    .describe(
      "Filter by PMS name. Required if listing_id is provided.",
    ),
  table: z
    .enum(["listing_snapshots", "price_snapshots", "market_snapshots"])
    .describe("Which snapshot table to query"),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start date for range query (YYYY-MM-DD). Defaults to 30 days ago.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End date for range query (YYYY-MM-DD). Defaults to today.",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum rows to return. Default 100."),
});

/** Input for pricelabs_store_market_snapshot - persist neighborhood data */
export const StoreMarketSnapshotInputSchema = z.object({
  snapshots: z
    .array(
      z.object({
        listing_id: z.string().describe("PriceLabs listing ID"),
        pms: z.string().describe("PMS name"),
        listings_used: z
          .number()
          .optional()
          .describe(
            "Number of comparable listings in neighborhood",
          ),
        p25_price: z
          .number()
          .optional()
          .describe("25th percentile price"),
        p50_price: z
          .number()
          .optional()
          .describe("50th percentile (median) price"),
        p75_price: z
          .number()
          .optional()
          .describe("75th percentile price"),
        p90_price: z
          .number()
          .optional()
          .describe("90th percentile price"),
        market_occupancy: z
          .number()
          .optional()
          .describe("Market occupancy rate"),
        data_json: z
          .string()
          .describe("Full neighborhood JSON blob"),
      }),
    )
    .describe("Array of market snapshots to store"),
  snapshot_date: z
    .string()
    .optional()
    .describe(
      "Override snapshot date (YYYY-MM-DD). Defaults to today.",
    ),
});
