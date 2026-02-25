/**
 * Monitoring MCP tool: pricelabs_get_booking_pace.
 *
 * Calculates booking pace at multiple cutoff windows (7/30/60/90 days)
 * compared to same-time-last-year (STLY). Supports MON-03 (pace tracking)
 * and MON-04 (pace alert detection) requirements.
 *
 * @module tools/monitoring
 */
import { GetBookingPaceInputSchema } from "../schemas/monitoring.js";
import { createReservationQueries } from "../db/queries/reservations.js";
/**
 * Register the pricelabs_get_booking_pace tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param db - An open better-sqlite3 Database instance (with migrations applied)
 */
export function registerMonitoringTools(server, db) {
    const reservationQueries = createReservationQueries(db);
    // --- pricelabs_get_booking_pace ---
    server.registerTool("pricelabs_get_booking_pace", {
        description: "Calculate booking pace at multiple cutoff windows (7/30/60/90 days) compared to same-time-last-year (STLY). Use for MON-03 (pace tracking) and MON-04 (pace alert detection).",
        inputSchema: GetBookingPaceInputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const cutoffDays = params.cutoff_days ?? [7, 30, 60, 90];
            const today = new Date().toISOString().slice(0, 10);
            const behindThresholdPct = -20;
            const paceResults = cutoffDays.map((cutoff) => {
                const endDate = today;
                const startDate = new Date(Date.now() - cutoff * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 10);
                const current = reservationQueries.getBookingPace.get({
                    listing_id: params.listing_id,
                    pms: params.pms,
                    start_date: startDate,
                    end_date: endDate,
                }) ?? { bookings: 0, booked_nights: 0, total_revenue: 0 };
                const stly = reservationQueries.getStlyPace.get({
                    listing_id: params.listing_id,
                    pms: params.pms,
                    start_date: startDate,
                    end_date: endDate,
                }) ?? { bookings: 0, booked_nights: 0, total_revenue: 0 };
                // Compute pace vs STLY percentage (null-safe)
                let paceVsStlyPct = null;
                if (stly.total_revenue > 0) {
                    paceVsStlyPct =
                        ((current.total_revenue - stly.total_revenue) /
                            stly.total_revenue) *
                            100;
                }
                const isBehindStly = paceVsStlyPct !== null
                    ? paceVsStlyPct < behindThresholdPct
                    : null;
                return {
                    cutoff_days: cutoff,
                    current: {
                        bookings: current.bookings,
                        booked_nights: current.booked_nights,
                        total_revenue: current.total_revenue,
                    },
                    stly: {
                        bookings: stly.bookings,
                        booked_nights: stly.booked_nights,
                        total_revenue: stly.total_revenue,
                    },
                    pace_vs_stly_pct: paceVsStlyPct,
                    is_behind_stly: isBehindStly,
                };
            });
            const result = {
                listing_id: params.listing_id,
                pms: params.pms,
                as_of: today,
                pace: paceResults,
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
}
