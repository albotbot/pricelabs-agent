import { z } from "zod";

// --- Input schemas for analysis tools ---

/** Input for pricelabs_get_portfolio_kpis - compute portfolio KPIs with comparisons */
export const GetPortfolioKpisInputSchema = z.object({
  current_date: z
    .string()
    .optional()
    .describe(
      "Snapshot date for current period (YYYY-MM-DD). Defaults to latest.",
    ),
  compare_to: z
    .enum(["previous_week", "previous_month", "stly"])
    .optional()
    .describe("Comparison period. Default: previous_week."),
});

/** Input for pricelabs_detect_underperformers - detect underperforming listings */
export const DetectUnderperformersInputSchema = z.object({
  snapshot_date: z
    .string()
    .optional()
    .describe(
      "Snapshot date to analyze (YYYY-MM-DD). Defaults to latest.",
    ),
  occupancy_gap_threshold: z
    .number()
    .optional()
    .describe("Occupancy gap threshold (%). Default: 20."),
  revenue_stly_threshold: z
    .number()
    .optional()
    .describe("Revenue vs STLY threshold (%). Default: -25."),
});
