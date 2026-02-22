import type { Listing, PriceEntry, NeighborhoodData } from "./types.js";

// --- Demand color to human-readable label mapping ---

const DEMAND_COLOR_MAP: Record<string, string> = {
  "#FF0000": "high",
  "#ff0000": "high",
  "#FFA500": "medium-high",
  "#ffa500": "medium-high",
  "#FFFF00": "medium",
  "#ffff00": "medium",
  "#00FF00": "medium-low",
  "#00ff00": "medium-low",
  "#0000FF": "low",
  "#0000ff": "low",
};

// --- Health trend thresholds ---

const HEALTH_TREND_IMPROVING_THRESHOLD = 5;
const HEALTH_TREND_DECLINING_THRESHOLD = -5;

// --- Stale sync threshold (48 hours) ---

const STALE_SYNC_DAYS = 2;

// --- Helper: safely parse a number, returning null on failure ---

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  return isNaN(num) ? null : num;
}

// --- Helper: safely parse a health score string to a number ---

function parseHealthScore(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Compute derived fields from a listing's raw data.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export function computeListingFields(
  listing: Listing
): Record<string, unknown> {
  const computed: Record<string, unknown> = {};

  // --- occupancy_gap_pct ---
  // (market_occupancy_next_30 - occupancy_next_30) / market_occupancy_next_30 * 100
  const marketOcc = safeNumber(listing.market_occupancy_next_30);
  const listingOcc = safeNumber(listing.occupancy_next_30);
  if (marketOcc !== null && listingOcc !== null && marketOcc !== 0) {
    computed.occupancy_gap_pct =
      Math.round(((marketOcc - listingOcc) / marketOcc) * 10000) / 100;
  } else {
    computed.occupancy_gap_pct = null;
  }

  // --- revenue_vs_stly_pct ---
  // (revenue_past_7 - stly_revenue_past_7) / stly_revenue_past_7 * 100
  const revenue = safeNumber(listing.revenue_past_7);
  const stlyRevenue = safeNumber(listing.stly_revenue_past_7);
  if (
    revenue !== null &&
    stlyRevenue !== null &&
    stlyRevenue !== 0 &&
    stlyRevenue !== -1
  ) {
    computed.revenue_vs_stly_pct =
      Math.round(((revenue - stlyRevenue) / stlyRevenue) * 10000) / 100;
  } else {
    computed.revenue_vs_stly_pct = null;
  }

  // --- days_since_sync ---
  // (Date.now() - Date.parse(last_date_pushed)) / 86400000
  const lastPushed = listing.last_date_pushed;
  if (lastPushed) {
    const parsedTime = Date.parse(lastPushed);
    if (!isNaN(parsedTime)) {
      const daysSince = (Date.now() - parsedTime) / 86400000;
      computed.days_since_sync = Math.round(daysSince * 100) / 100;
    } else {
      computed.days_since_sync = null;
    }
  } else {
    computed.days_since_sync = null;
  }

  // --- is_stale_sync ---
  // days_since_sync > 2 (48 hours threshold)
  const daysSinceSync = computed.days_since_sync as number | null;
  if (daysSinceSync !== null) {
    computed.is_stale_sync = daysSinceSync > STALE_SYNC_DAYS;
  } else {
    computed.is_stale_sync = null;
  }

  // --- health_trend ---
  // Compare health_7_day vs health_30_day to derive trend
  const health7 = parseHealthScore(listing.health_7_day);
  const health30 = parseHealthScore(listing.health_30_day);
  if (health7 !== null && health30 !== null) {
    const diff = health7 - health30;
    if (diff > HEALTH_TREND_IMPROVING_THRESHOLD) {
      computed.health_trend = "improving";
    } else if (diff < HEALTH_TREND_DECLINING_THRESHOLD) {
      computed.health_trend = "declining";
    } else {
      computed.health_trend = "stable";
    }
  } else {
    computed.health_trend = null;
  }

  return computed;
}

/**
 * Compute derived fields from a single price entry.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export function computePriceFields(
  priceEntry: PriceEntry
): Record<string, unknown> {
  const computed: Record<string, unknown> = {};

  // --- demand_level ---
  // Map demand_color hex to human label, fall back to demand_desc if present
  const demandColor = priceEntry.demand_color;
  const demandDesc = priceEntry.demand_desc;
  if (demandColor && DEMAND_COLOR_MAP[demandColor]) {
    computed.demand_level = DEMAND_COLOR_MAP[demandColor];
  } else if (demandColor && DEMAND_COLOR_MAP[demandColor.toLowerCase()]) {
    computed.demand_level = DEMAND_COLOR_MAP[demandColor.toLowerCase()];
  } else if (demandDesc) {
    // Fall back to demand_desc: normalize to lowercase label
    computed.demand_level = demandDesc.toLowerCase().replace(/\s+/g, "-");
  } else {
    computed.demand_level = null;
  }

  // --- adr_vs_stly_pct ---
  // (ADR - ADR_STLY) / ADR_STLY * 100. Returns null if either is -1.
  const adr = safeNumber(priceEntry.ADR);
  const adrStly = safeNumber(priceEntry.ADR_STLY);
  if (
    adr !== null &&
    adrStly !== null &&
    adr !== -1 &&
    adrStly !== -1 &&
    adrStly !== 0
  ) {
    computed.adr_vs_stly_pct =
      Math.round(((adr - adrStly) / adrStly) * 10000) / 100;
  } else {
    computed.adr_vs_stly_pct = null;
  }

  // --- is_booked ---
  // Parse booking_status to determine if date is booked
  const bookingStatus = priceEntry.booking_status;
  if (bookingStatus !== null && bookingStatus !== undefined) {
    const statusLower =
      typeof bookingStatus === "string" ? bookingStatus.toLowerCase() : "";
    computed.is_booked =
      statusLower === "booked" ||
      statusLower === "reserved" ||
      statusLower.includes("book");
  } else {
    computed.is_booked = null;
  }

  return computed;
}

/**
 * Compute derived fields from neighborhood data combined with listing data.
 * Determines where the listing's base_price falls relative to market percentiles.
 * All computed fields return null when source data is missing or invalid.
 * Never throws on bad input data.
 */
export function computeNeighborhoodFields(
  neighborhood: NeighborhoodData,
  listing: Listing
): Record<string, unknown> {
  const computed: Record<string, unknown> = {};

  // --- price_percentile_position ---
  // Where the listing's base_price falls relative to 25th/50th/75th/90th percentiles
  const basePrice = safeNumber(listing.base);
  const futurePercentilePrices =
    neighborhood.data?.["Future Percentile Prices"];

  if (
    basePrice !== null &&
    futurePercentilePrices &&
    futurePercentilePrices.Y_values &&
    futurePercentilePrices.Y_values.length >= 5
  ) {
    // Y_values structure: [25th, 50th, 75th, median_booked, 90th]
    // Use the first data point (nearest future date) for percentile comparison
    const p25Array = futurePercentilePrices.Y_values[0];
    const p50Array = futurePercentilePrices.Y_values[1];
    const p75Array = futurePercentilePrices.Y_values[2];
    // index 3 is median booked, skip
    const p90Array = futurePercentilePrices.Y_values[4];

    // Get the first (nearest date) value from each percentile array
    const p25 = p25Array && p25Array.length > 0 ? safeNumber(p25Array[0]) : null;
    const p50 = p50Array && p50Array.length > 0 ? safeNumber(p50Array[0]) : null;
    const p75 = p75Array && p75Array.length > 0 ? safeNumber(p75Array[0]) : null;
    const p90 = p90Array && p90Array.length > 0 ? safeNumber(p90Array[0]) : null;

    if (p25 !== null && p50 !== null && p75 !== null && p90 !== null) {
      if (basePrice < p25) {
        computed.price_percentile_position = "below_25th";
      } else if (basePrice < p50) {
        computed.price_percentile_position = "25th_to_50th";
      } else if (basePrice < p75) {
        computed.price_percentile_position = "50th_to_75th";
      } else if (basePrice < p90) {
        computed.price_percentile_position = "75th_to_90th";
      } else {
        computed.price_percentile_position = "above_90th";
      }
    } else {
      computed.price_percentile_position = null;
    }
  } else {
    computed.price_percentile_position = null;
  }

  return computed;
}
