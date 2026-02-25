/**
 * Prepared statement queries for the reservations table.
 *
 * Provides upsert (single + batch) with cancellation detection,
 * get-by-listing, booking pace calculation, STLY pace comparison,
 * and recent cancellation retrieval.
 *
 * @module db/queries/reservations
 */
/**
 * Create prepared statement queries for the reservations table.
 *
 * The upsert operation handles cancellation detection: when a reservation's
 * booking_status changes to 'cancelled', cancelled_on is automatically set.
 *
 * @param db - An open better-sqlite3 Database instance (with migrations applied).
 * @returns Object containing all reservation query operations.
 */
export function createReservationQueries(db) {
    /**
     * Upsert a single reservation.
     *
     * On conflict (same listing_id + pms + reservation_id):
     * - Updates all mutable fields
     * - Sets cancelled_on = datetime('now') when booking_status changes to 'cancelled'
     * - Preserves first_seen_date from the original insert
     */
    const upsertReservation = db.prepare(`
    INSERT INTO reservations (
      listing_id, pms, reservation_id,
      check_in, check_out, booked_date,
      booking_status, rental_revenue, total_cost,
      no_of_days, currency,
      first_seen_date, last_seen_date,
      data_json
    ) VALUES (
      @listing_id, @pms, @reservation_id,
      @check_in, @check_out, @booked_date,
      @booking_status, @rental_revenue, @total_cost,
      @no_of_days, @currency,
      @last_seen_date, @last_seen_date,
      @data_json
    )
    ON CONFLICT(listing_id, pms, reservation_id) DO UPDATE SET
      check_in = excluded.check_in,
      check_out = excluded.check_out,
      booked_date = excluded.booked_date,
      booking_status = excluded.booking_status,
      rental_revenue = excluded.rental_revenue,
      total_cost = excluded.total_cost,
      no_of_days = excluded.no_of_days,
      currency = excluded.currency,
      last_seen_date = excluded.last_seen_date,
      data_json = excluded.data_json,
      cancelled_on = CASE
        WHEN excluded.booking_status = 'cancelled' AND reservations.booking_status != 'cancelled'
        THEN datetime('now')
        ELSE reservations.cancelled_on
      END,
      updated_at = datetime('now')
  `);
    const getByListing = db.prepare(`
    SELECT * FROM reservations
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY check_in ASC
  `);
    /**
     * Calculate booking pace: count of reservations with check-in within date range.
     * Returns count, total booked nights, and total revenue.
     */
    const getBookingPace = db.prepare(`
    SELECT
      COUNT(*) as bookings,
      SUM(CASE WHEN no_of_days IS NOT NULL THEN no_of_days ELSE 0 END) as booked_nights,
      SUM(CASE WHEN rental_revenue IS NOT NULL THEN rental_revenue ELSE 0 END) as total_revenue
    FROM reservations
    WHERE listing_id = @listing_id AND pms = @pms
      AND booking_status = 'booked'
      AND check_in BETWEEN @start_date AND @end_date
  `);
    /**
     * Same-time-last-year booking pace: shifts dates back by 1 year for comparison.
     */
    const getStlyPace = db.prepare(`
    SELECT
      COUNT(*) as bookings,
      SUM(CASE WHEN no_of_days IS NOT NULL THEN no_of_days ELSE 0 END) as booked_nights,
      SUM(CASE WHEN rental_revenue IS NOT NULL THEN rental_revenue ELSE 0 END) as total_revenue
    FROM reservations
    WHERE listing_id = @listing_id AND pms = @pms
      AND booking_status = 'booked'
      AND check_in BETWEEN date(@start_date, '-1 year') AND date(@end_date, '-1 year')
  `);
    const getRecentCancellations = db.prepare(`
    SELECT * FROM reservations
    WHERE booking_status = 'cancelled'
      AND updated_at > @since
    ORDER BY updated_at DESC
  `);
    const upsertMany = db.transaction((reservations) => {
        for (const reservation of reservations) {
            upsertReservation.run(reservation);
        }
    });
    return {
        upsertReservation,
        getByListing,
        getBookingPace,
        getStlyPace,
        getRecentCancellations,
        upsertMany,
    };
}
