/**
 * Override (DSO) tool registration for the PriceLabs MCP server.
 *
 * Registers three tools for the full DSO lifecycle:
 * - pricelabs_get_overrides: read active date-specific overrides
 * - pricelabs_set_overrides: create/update DSOs with full safety validation
 * - pricelabs_delete_overrides: remove DSOs with audit trail
 *
 * DSOs have the HIGHEST priority in PriceLabs and override ALL other settings
 * including min price. The set_overrides tool implements critical safety checks:
 * 1. Percentage range validation (-75 to 500)
 * 2. Currency matching for fixed-price DSOs
 * 3. Price floor validation against listing min_price
 * 4. Post-write verification to detect silently dropped dates
 *
 * Write tools never use fetchWithFallback -- writes must go live.
 * All write tools require a reason parameter for audit trail.
 * All write tools invalidate the override cache after success.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PriceLabsApiClient } from "../services/api-client.js";
import { TtlCache } from "../services/cache.js";
import { TokenBucketRateLimiter } from "../services/rate-limiter.js";
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import {
  GetOverridesInputSchema,
  SetOverridesInputSchema,
  DeleteOverridesInputSchema,
} from "../schemas/overrides.js";
import type {
  OverrideEntry,
  SetOverridesInput,
  Listing,
} from "../types.js";

/** Cache TTL for overrides: 6 hours */
const OVERRIDES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 21600000ms

/**
 * Register the override tools on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerOverrideTools(
  server: McpServer,
  apiClient: PriceLabsApiClient,
  cache: TtlCache,
  rateLimiter: TokenBucketRateLimiter,
): void {
  // ---------------------------------------------------------------
  // Tool 1: pricelabs_get_overrides (read)
  // ---------------------------------------------------------------
  const getShape = GetOverridesInputSchema.shape;

  server.tool(
    "pricelabs_get_overrides",
    "Fetch active date-specific overrides (DSOs) for a listing. Shows price adjustments, min-stay rules, and check-in/check-out restrictions per date.",
    {
      listing_id: getShape.listing_id,
      pms: getShape.pms,
      start_date: getShape.start_date,
      end_date: getShape.end_date,
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
    },
    async (args) => {
      const { listing_id, pms, start_date, end_date } = args;

      const cacheKey = `overrides:${listing_id}:${pms}`;

      // Build query params for optional date filters
      let path = `/v1/listings/${listing_id}/overrides?pms=${encodeURIComponent(pms)}`;
      if (start_date) path += `&start_date=${start_date}`;
      if (end_date) path += `&end_date=${end_date}`;

      const result = await fetchWithFallback<OverrideEntry[]>(
        cacheKey,
        () =>
          apiClient
            .get<{ overrides: OverrideEntry[] }>(path)
            .then((r) => r.data.overrides),
        cache,
        rateLimiter,
        OVERRIDES_CACHE_TTL_MS,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------
  // Tool 2: pricelabs_set_overrides (write -- HIGHEST RISK)
  // ---------------------------------------------------------------
  const setShape = SetOverridesInputSchema.shape;

  server.tool(
    "pricelabs_set_overrides",
    "Create or update date-specific overrides (DSOs) for a listing. DSOs have the HIGHEST priority in PriceLabs and override ALL other settings including min price. REQUIRES reason for audit trail.",
    {
      listing_id: setShape.listing_id,
      pms: setShape.pms,
      overrides: setShape.overrides,
      reason: setShape.reason,
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
    },
    async (args) => {
      // --- Write safety gate (SAFE-01) ---
      const writesEnabled = process.env.PRICELABS_WRITES_ENABLED;
      if (writesEnabled !== "true") {
        return {
          content: [
            {
              type: "text" as const,
              text: "Write operations are disabled. Set PRICELABS_WRITES_ENABLED=true to enable.",
            },
          ],
          isError: true,
        };
      }

      const { listing_id, pms, overrides, reason } = args as SetOverridesInput;

      // ---- Step 1: Validate percentage range ----
      // Also in Zod schema, but double-check here for defense-in-depth
      for (const override of overrides) {
        if (
          override.price_type === "percentage" &&
          (override.price_value < -75 || override.price_value > 500)
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Validation failed: Percentage override for ${override.date} is ${override.price_value}%, which is outside the allowed range of -75% to 500%. All overrides rejected.`,
              },
            ],
            isError: true,
          };
        }
      }

      // ---- Step 2: Validate currency for fixed prices (Pitfall 3) ----
      const fixedOverrides = overrides.filter(
        (o) => o.price_type === "fixed",
      );

      if (fixedOverrides.length > 0) {
        // Check that all fixed overrides have currency specified
        const missingCurrency = fixedOverrides.filter((o) => !o.currency);
        if (missingCurrency.length > 0) {
          const dates = missingCurrency.map((o) => o.date).join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: `Validation failed: Fixed-price DSOs for dates [${dates}] are missing the currency field. Currency is required for fixed-price overrides to prevent applying the wrong price.`,
              },
            ],
            isError: true,
          };
        }

        // Fetch listing data to verify currency matches PMS listing currency
        let listingData: Listing | null = null;
        try {
          const listingResponse = await apiClient.get<{ listings: Listing[] }>(
            `/v1/listings/${listing_id}?pms=${encodeURIComponent(pms)}`,
          );
          // API returns { listings: [listing] } wrapper
          const listingsArr = listingResponse.data.listings;
          listingData = listingsArr && listingsArr.length > 0 ? listingsArr[0] : null;
        } catch {
          // If we can't fetch listing data, we can't validate currency --
          // fail safe by rejecting the write
          return {
            content: [
              {
                type: "text" as const,
                text: `Validation failed: Could not fetch listing data to verify currency match. Fixed-price DSOs require currency validation against the listing's PMS currency. Please try again.`,
              },
            ],
            isError: true,
          };
        }

        const listingCurrency = listingData?.currency;
        if (listingCurrency) {
          for (const override of fixedOverrides) {
            if (
              override.currency &&
              override.currency.toUpperCase() !==
                listingCurrency.toUpperCase()
            ) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Validation failed: Fixed-price DSO currency (${override.currency}) does not match listing currency (${listingCurrency}). This would apply the wrong price. Override date: ${override.date}.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }

        // ---- Step 3: Validate price floor (Pitfall 1) ----
        const minPrice = listingData?.min;
        if (minPrice != null && minPrice > 0) {
          for (const override of fixedOverrides) {
            if (override.price_value < minPrice) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Validation failed: DSO fixed price ($${override.price_value}) is below listing minimum price ($${minPrice}). DSOs override min price -- this would push a below-minimum rate to the OTA. Override date: ${override.date}.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }
      }

      // ---- Step 4: Execute write ----
      let writeResponse;
      try {
        writeResponse = await apiClient.post(
          `/v1/listings/${listing_id}/overrides`,
          { pms, overrides },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to set overrides: ${message}. The write was not applied.`,
            },
          ],
          isError: true,
        };
      }

      // ---- Step 5: Post-write verification (Pitfall 2) ----
      const requestedDates = overrides.map((o) => o.date);
      const minDate = requestedDates.sort()[0];
      const maxDate = requestedDates.sort()[requestedDates.length - 1];

      let verificationStatus = "verified";
      let droppedDates: string[] = [];

      try {
        const verifyPath =
          `/v1/listings/${listing_id}/overrides?pms=${encodeURIComponent(pms)}` +
          `&start_date=${minDate}&end_date=${maxDate}`;
        const verifyResponse = await apiClient.get<{ overrides: OverrideEntry[] }>(verifyPath);

        const confirmedDates = new Set(
          verifyResponse.data.overrides.map((entry) => entry.date),
        );
        droppedDates = requestedDates.filter(
          (date) => !confirmedDates.has(date),
        );

        if (droppedDates.length > 0) {
          verificationStatus = "partial";
        }
      } catch {
        verificationStatus = "unverified";
      }

      // ---- Step 6: Invalidate cache ----
      cache.invalidate(`overrides:${listing_id}`);

      // ---- Step 7: Return response ----
      const response: Record<string, unknown> = {
        status: "success",
        listing_id,
        pms,
        dates_requested: requestedDates.length,
        verification: verificationStatus,
        reason,
        write_response: writeResponse.data,
      };

      if (droppedDates.length > 0) {
        response.warning = `${droppedDates.length} dates were silently dropped by PriceLabs. Dates not confirmed: [${droppedDates.join(", ")}]. This usually means those dates are in the past or outside the sync window.`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------
  // Tool 3: pricelabs_delete_overrides (write)
  // ---------------------------------------------------------------
  const deleteShape = DeleteOverridesInputSchema.shape;

  server.tool(
    "pricelabs_delete_overrides",
    "Delete date-specific overrides for specified dates. Removes DSO pricing and restores dynamic pricing for those dates. REQUIRES reason for audit trail.",
    {
      listing_id: deleteShape.listing_id,
      pms: deleteShape.pms,
      dates: deleteShape.dates,
      reason: deleteShape.reason,
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
    },
    async (args) => {
      // --- Write safety gate (SAFE-01) ---
      const writesEnabled = process.env.PRICELABS_WRITES_ENABLED;
      if (writesEnabled !== "true") {
        return {
          content: [
            {
              type: "text" as const,
              text: "Write operations are disabled. Set PRICELABS_WRITES_ENABLED=true to enable.",
            },
          ],
          isError: true,
        };
      }

      const { listing_id, pms, dates, reason } = args;

      // Execute delete -- use request() directly since delete() doesn't accept body
      try {
        await apiClient.request(
          "DELETE",
          `/v1/listings/${listing_id}/overrides`,
          { pms, dates },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete overrides: ${message}. The delete was not applied.`,
            },
          ],
          isError: true,
        };
      }

      // Invalidate override cache for this listing
      cache.invalidate(`overrides:${listing_id}`);

      const response = {
        status: "success",
        listing_id,
        pms,
        dates_deleted: dates,
        reason,
        message: `Deleted ${dates.length} date-specific override(s). Dynamic pricing has been restored for those dates.`,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );
}
