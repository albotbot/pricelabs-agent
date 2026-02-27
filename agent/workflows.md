# PriceLabs Agent Workflows

## Workflow 1: Daily Health Check

**Schedule:** Every morning at 8am
**Duration:** ~2 minutes for 50 listings

```
STEP 1: Fetch all listings
  → GET /v1/listings?only_syncing_listings=true

STEP 2: Check health scores
  → Flag listings where health_7_day indicates underperformance

STEP 3: Check sync freshness
  → Flag listings where last_date_pushed > 48 hours

STEP 4: Compare occupancy vs market
  → Flag where occupancy_next_30 < market_occupancy_next_30 * 0.8

STEP 5: Check revenue vs STLY
  → Flag where revenue_past_7 < stly_revenue_past_7 * 0.7

STEP 6: Generate alert summary
  → Critical: Stale syncs
  → Warning: Health issues, low occupancy, revenue drops
  → Info: Potential optimization opportunities
```

---

## Workflow 2: Price Optimization Scan

**Schedule:** Every Monday & Thursday at 9am
**Duration:** ~5 minutes for 50 listings

```
STEP 1: Fetch prices with reasons
  → POST /v1/listing_prices (all listings, reason: true, next 90 days)

STEP 2: Identify pricing anomalies
  → Dates where price < min (shouldn't happen, but verify)
  → Dates where price = max (may be leaving money on table)
  → Large day-over-day price swings (>30%)
  → Dates with demand_color = red but low price

STEP 3: Identify orphan gaps
  → Find unbookable dates (unbookable=1) in next 30 days
  → Count orphan gaps by length

STEP 4: Compare vs STLY booking status
  → Dates booked this year but not STLY (potential to raise price)
  → Dates unbooked this year but booked STLY (potential to lower price)

STEP 5: Generate optimization recommendations
  → "Listing X has 5 orphan gaps in next 30 days"
  → "Listing Y is hitting max price on 12 dates — consider raising max"
  → "Listing Z has high demand dates priced below market median"
```

---

## Workflow 3: Weekly Neighborhood Analysis

**Schedule:** Every Monday at 10am
**Duration:** ~10 minutes for 50 listings

```
STEP 1: Fetch neighborhood data for all listings
  → GET /v1/neighborhood_data (one per listing)

STEP 2: Calculate market position
  → For each listing, determine pricing percentile (25th/50th/75th)
  → Compare current base price to recommended percentile

STEP 3: Analyze market trends
  → Is market occupancy trending up or down?
  → Are new bookings accelerating or decelerating?
  → How does cancellation rate compare to normal?

STEP 4: Base price drift analysis
  → Compare recommended_base_price vs current base
  → Flag listings where drift > 10%

STEP 5: Generate market intelligence report
  → Market conditions summary
  → Base price adjustment recommendations
  → Upcoming demand changes
```

---

## Workflow 4: Monthly Strategy Review

**Schedule:** 1st of each month at 9am
**Duration:** ~15 minutes

```
STEP 1: Fetch 90-day reservation history
  → GET /v1/reservation_data (past 90 days)

STEP 2: Calculate portfolio KPIs
  → ADR, RevPAR, Occupancy, Avg LOS, Avg Lead Time
  → Compare vs. previous 90 days
  → Compare vs. STLY

STEP 3: Revenue analysis by listing
  → Rank listings by revenue contribution
  → Identify top performers and underperformers
  → Calculate revenue per bedroom

STEP 4: Booking pace analysis
  → Compare 30/60/90 day forward occupancy vs STLY
  → Identify listings with concerning pace gaps

STEP 5: Base price recalibration
  → For underperformers: suggest base price reduction
  → For outperformers: suggest base price increase
  → Apply via POST /v1/listings (with user approval)

STEP 6: DSO cleanup
  → DELETE expired overrides
  → Review upcoming DSOs for relevance

STEP 7: Generate monthly strategy report
```

---

## Workflow 5: Event Detection & DSO Creation

**Schedule:** Triggered by external event data (or weekly scan)
**Duration:** Variable

```
STEP 1: Detect upcoming events
  → External source: local events API, concert schedules, conferences
  → Or manual trigger: user inputs event details

STEP 2: Determine affected listings
  → Match event location to listings within radius
  → Consider event type and expected demand impact

STEP 3: Calculate premium
  → Check current pricing for affected dates
  → Review historical event pricing
  → Suggest premium: typically +15% to +50%

STEP 4: Create DSOs
  → POST /v1/listings/{id}/overrides
  → price_type: "percent"
  → Include reason: "Event: {event name}"

STEP 5: Monitor and adjust
  → Track booking pace for event dates
  → If booking too fast: increase premium
  → If booking too slow: decrease premium
```

---

## Workflow 6: New Listing Onboarding

**Trigger:** New listing detected in GET /v1/listings
**Duration:** ~5 minutes per listing

```
STEP 1: Detect new listing
  → Compare current listing IDs to previous scan
  → New ID found → begin onboarding

STEP 2: Gather market context
  → GET /v1/neighborhood_data for new listing
  → Identify market percentiles

STEP 3: Set initial pricing
  → New listing with few reviews: Base at 25th-50th percentile
  → Min: 30-40% below base
  → Max: 200% above base

STEP 4: Apply recommended settings
  → Enable orphan day management
  → Set occupancy-based adjustments (medium booking window profile)
  → Set last-minute discounts (market-appropriate curve)
  → Set min-stay recommendations

STEP 5: Apply via API
  → POST /v1/listings with initial min/base/max
  → Document settings applied

STEP 6: Schedule 7-day review
  → After 7 days, run health check
  → Adjust if booking pace is too fast/slow
```

---

## Workflow 7: Cancellation Response

**Trigger:** New cancellation detected in reservation data
**Duration:** ~2 minutes

```
STEP 1: Detect cancellation
  → GET /v1/reservation_data → filter status = "cancelled"
  → Identify newly cancelled reservations

STEP 2: Assess impact
  → How many nights freed up?
  → How far out are the dates?
  → What's the current demand for those dates?

STEP 3: Respond
  → If dates < 14 days out: check if last-minute discount is aggressive enough
  → If dates in high-demand period: no action (will rebook at similar or higher rate)
  → If dates in low-demand period: consider temporary DSO with additional discount

STEP 4: Monitor rebook
  → Track whether dates get rebooked
  → Remove temporary DSOs if rebooked
```

---

## Agent Output Formats

### Daily Summary (Slack/Email/Dashboard)
```
📊 PriceLabs Daily Summary - {date}

Portfolio: {n} listings active
Sync Status: {n} current / {n} stale ⚠️
Avg Occupancy (30d): {x}% (market: {y}%)
Revenue (past 7d): ${x} (STLY: ${y})

🔴 Critical Alerts:
- [listing] sync hasn't pushed in 52 hours

⚠️ Warnings:
- [listing] occupancy 30d at 45% vs market 68%
- [listing] revenue -35% vs STLY

💡 Opportunities:
- [listing] has 3 orphan gaps in next 14 days
- [listing] hitting max price on 8 dates
```

### Weekly Report
```
📈 Weekly Optimization Report - Week of {date}

Portfolio KPIs:
  ADR: ${x} ({+/-y}% vs last week)
  Occupancy: {x}% ({+/-y}pp vs last week)
  RevPAR: ${x} ({+/-y}% vs last week)
  Booking Pace: {x} nights booked ({+/-y}% vs STLY)

Recommendations:
1. [listing]: Raise base price $X → $Y (consistently above 75th pct)
2. [listing]: Lower base price $X → $Y (pace 30% behind STLY)
3. Create DSO: +25% for [event] on [dates] for [n] listings

Actions Taken This Week:
- Cleaned up 12 expired DSOs
- Triggered manual sync for 3 stale listings
```
