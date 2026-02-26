# Analysis Playbook

## Weekly Optimization Report Protocol

Follow these steps every week to produce the portfolio optimization report. This protocol is triggered by the weekly cron job.

### Step 1: Fetch Listings and Current Snapshots

1. Call `pricelabs_get_listings` with `only_syncing_listings=true` to get all active listings
2. Call `pricelabs_get_snapshots` with `type=daily` and the past 14 days to retrieve recent stored metrics
3. If snapshots are missing for recent days, call `pricelabs_store_daily_snapshots` first to capture current state

### Step 2: Compute Portfolio KPIs

Call `pricelabs_get_portfolio_kpis` to compute aggregate metrics across the portfolio:

| KPI | Formula | Description |
|-----|---------|-------------|
| **ADR** | total revenue / booked nights | Average revenue per booked night |
| **RevPAR** | total revenue / available nights | Revenue per available night (combines rate + occupancy) |
| **Occupancy** | booked nights / available nights | Percentage of available nights that are booked |
| **Avg LOS** | total booked nights / number of reservations | Average length of stay |
| **Avg Lead Time** | avg(booking_date - check_in_date) | How far in advance guests are booking |

These KPIs are the primary health indicators for the portfolio.

### Step 3: Calculate Week-over-Week Deltas

Using stored snapshots from the past 14 days, compute changes:

- **ADR delta:** (this week ADR - last week ADR) / last week ADR * 100
- **Occupancy delta:** this week occupancy - last week occupancy (in percentage points)
- **RevPAR delta:** (this week RevPAR - last week RevPAR) / last week RevPAR * 100
- **Booking pace delta:** new bookings this week vs new bookings last week

Flag any KPI that changed by more than 10% week-over-week for closer examination.

### Step 4: Calculate STLY Comparisons

For each listing, compare current performance to same time last year:

- `revenue_past_7` vs `stly_revenue_past_7` -- revenue trend
- `occupancy_next_30` vs STLY occupancy at the same point last year (from stored snapshots if available)
- `booking_pace` current vs STLY (via `pricelabs_get_booking_pace`)

A positive STLY comparison indicates the portfolio is outperforming last year. A negative comparison warrants investigation.

### Step 5: Identify Underperforming Listings

Call `pricelabs_detect_underperformers` to flag listings meeting these criteria:

| Criterion | Threshold | Indicates |
|-----------|-----------|-----------|
| Low occupancy | occupancy_next_30 < market_occupancy_next_30 * 0.8 | Pricing too high or listing issues |
| Revenue decline | revenue_past_7 < stly_revenue_past_7 * 0.7 | Significant underperformance vs last year |
| Pace behind | booking_pace < STLY pace * 0.8 | Falling behind last year's booking rate |
| Health flagged | health_7_day or health_30_day indicates issue | PriceLabs detected a problem |

For each underperformer, note the specific metric(s) that triggered the flag.

### Step 6: Generate Recommended Actions

For each underperforming listing, determine a specific action:

**Low occupancy + high pricing (above p75):**
- Recommend base price reduction toward p50
- Show current base, recommended_base_price, and neighborhood percentiles

**Low occupancy + reasonable pricing (p25-p75):**
- Check for orphan days blocking bookings
- Review min-stay settings that may be too restrictive
- Consider last-minute discount adjustment

**Revenue decline despite good occupancy:**
- ADR has dropped -- check if base price was recently lowered
- Check if discounts or customizations are compressing rates

**Pace behind STLY:**
- If far-out dates are unbooked, consider far-out pricing adjustment
- If near-term dates are unbooked, check last-minute discount settings

## Report Format

Present the weekly report in this format:

```
Weekly Optimization Report - Week of {date}

Portfolio KPIs:
  ADR: ${x} ({+/-y}% vs last week)
  Occupancy: {x}% ({+/-y}pp vs last week)
  RevPAR: ${x} ({+/-y}% vs last week)
  Booking Pace: {x} nights booked ({+/-y}% vs STLY)

Underperforming Listings:
  1. [listing name]: occupancy {x}% vs market {y}%, revenue -{z}% vs STLY
     Recommended: [specific action]
  2. [listing name]: pace {x}% behind STLY
     Recommended: [specific action]

Top Performers:
  1. [listing name]: occupancy {x}%, ADR ${y} (+{z}% vs STLY)
  2. [listing name]: RevPAR ${x} (+{y}% vs last week)

Recommendations (see optimization skill for details):
  1. [priority action from optimization protocols]
  2. [priority action from optimization protocols]
  3. [priority action from optimization protocols]
```

## Underperformance Detection Criteria

Apply these thresholds consistently across all analyses:

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|--------------------|
| Occupancy vs market | < 80% of market | < 60% of market |
| Revenue vs STLY | < 70% of STLY | < 50% of STLY |
| Booking pace vs STLY | < 80% of STLY pace | < 60% of STLY pace |
| ADR vs neighborhood p50 | < 80% of p50 | < 60% of p50 |
| Health score | Any 7-day flag | 30-day flag persisting |

When multiple metrics are flagged simultaneously for the same listing, escalate the overall severity. A listing with both low occupancy and revenue decline should be treated as higher priority than either alone.
