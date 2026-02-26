# Optimization Playbook

## Orphan Day Detection Protocol

Orphan days are short unbookable gaps between reservations. They represent immediate lost revenue because the gap is too short for most guests to book. Filling orphan days is the highest-impact quick win in revenue optimization.

### Detection Steps

1. Call `pricelabs_get_prices` for each listing, covering the next 30 days
2. Scan the pricing data for gaps where:
   - The date is **not booked** (booking_status is not "booked")
   - The date is **not unbookable** due to owner blocks (unbookable = false)
   - The gap between two booked dates is 1-3 nights
3. Exclude dates that are already covered by an existing DSO (call `pricelabs_get_overrides` to check)
4. For each orphan gap found, record:
   - Listing name and ID
   - Gap dates (start and end)
   - Gap length in nights
   - Current price for those dates
   - Prices of adjacent booked dates (for context)

### Recommended DSO Discounts

| Gap Length | Recommended Discount | Rationale |
|-----------|---------------------|-----------|
| 1 night | -20% (percentage DSO) | Aggressive discount needed to attract 1-night stays |
| 2 nights | -20% (percentage DSO) | Still a hard sell; strong discount moves bookings |
| 3 nights | -15% to -20% (percentage DSO) | More attractive gap; moderate discount sufficient on weekdays, slightly less on weekends |

### Presenting Fill Strategies

For each orphan gap, present:
```
Listing: [name]
Gap: [start_date] to [end_date] ({n} nights)
Current price: ${x}/night
Recommended: Create DSO at -{y}% for these dates
Expected price after DSO: ${z}/night
Adjacent bookings: [date] at ${a}/night | [date] at ${b}/night
```

Also recommend reducing minimum stay for orphan gap dates if the current min-stay exceeds the gap length.

---

## Demand Spike Detection Protocol

Demand spikes represent events or periods where pricing should be elevated above the algorithm's base calculation to capture maximum revenue.

### Detection Steps

1. Call `pricelabs_get_prices` for each listing, covering the next 90 days with `reason=true`
2. Identify clusters of dates where `demand_color` indicates high demand (orange or red)
3. For each cluster:
   - Check if existing DSOs already cover those dates (`pricelabs_get_overrides`)
   - Check if the algorithm has already elevated pricing significantly (compare `price` to `uncustomized_price` -- if already > 120% of uncustomized, the algorithm is responding)
   - Check ADR_STLY comparison -- if current ADR significantly exceeds STLY ADR, pricing may already be optimal
4. Only recommend additional DSOs when the algorithm appears to underweight the demand signal

### Recommended Overrides

| Demand Intensity | Override Range | When to Apply |
|-----------------|---------------|---------------|
| Orange (high) | +15% to +25% | Only if algorithm hasn't already elevated pricing |
| Red (very high) | +25% to +50% | Significant events; verify with neighborhood occupancy data |
| Red cluster (3+ consecutive days) | +30% to +50% | Multi-day events; strongest pricing opportunity |

### Presentation Format

```
Demand Spike Detected:
Listing: [name]
Dates: [start] to [end] ({n} days)
Demand: [color/description]
Current algorithm price: ${x}/night
Uncustomized price: ${y}/night (algorithm already applying +{z}%)
Recommendation: [Create DSO at +{pct}% | No action needed -- algorithm is responding]
```

---

## Base Price Calibration Check

The base price is the anchor for all dynamic pricing. Periodic calibration ensures listings remain competitive without leaving revenue on the table.

### When to Check

- At least once every 30 days per listing
- When underperformance is detected (occupancy < 80% of market)
- When the listing consistently hits max price (capping potential revenue)
- After significant market changes (seasonal shifts, new supply)

### Calibration Steps

1. Call `pricelabs_get_neighborhood` for the listing to get market percentiles (p25, p50, p75, p90)
2. Compare current `base_price` to `recommended_base_price` from the listings data
3. Calculate deviation: `(base_price - recommended_base_price) / recommended_base_price * 100`
4. Flag if absolute deviation exceeds 10%

### Decision Framework

| Current Position | Occupancy Signal | Recommendation |
|-----------------|-----------------|----------------|
| Base > p75 | Low occupancy (< 80% market) | Reduce base toward p50 |
| Base > p75 | Good occupancy (> 80% market) | Base may be appropriate; monitor |
| Base at p50 | Low occupancy (< 80% market) | Check listing quality, photos, reviews |
| Base at p50 | Good occupancy (> 80% market) | Optimal position |
| Base < p25 | High occupancy, fast pace | Raise base toward p50 -- leaving money on table |
| Base < p25 | Low occupancy | Market/listing issue; do NOT lower further |

### Impact Presentation

```
Base Price Calibration - [listing name]:
Current base: ${current}
Recommended base: ${recommended}
Deviation: {pct}%
Neighborhood: p25=${p25} | p50=${p50} | p75=${p75}
Current occupancy: {occ}% (market: {market_occ}%)

If adjusted to ${recommended}:
  New min price: ${new_min} (at current min/base ratio)
  New max price: ${new_max} (at current max/base ratio)
  Expected impact: [narrative based on position and occupancy]
```

Always use `pricelabs_snapshot_before_write` before any base price change to capture the baseline for impact assessment.

---

## Recommendation Prioritization

When multiple optimization opportunities are identified, present them in this priority order:

### Priority 1: Orphan Days (Immediate Revenue)
- Revenue is being lost right now on dates that could be filled
- Short time horizon -- must act quickly before dates pass
- Low risk -- a discount on empty dates has no downside

### Priority 2: Demand Spikes (Upcoming Events)
- Time-sensitive -- event dates are approaching
- High revenue potential per night
- Moderate risk -- over-pricing can suppress bookings, but under-pricing definitely leaves money on the table

### Priority 3: Base Price Calibration (Long-Term Positioning)
- Important but not urgent -- affects future pricing
- Highest long-term impact on portfolio revenue
- Requires careful consideration -- base price changes ripple through all dynamic pricing

### Presenting Prioritized Recommendations

Present the top 3-5 highest-priority recommendations that require owner approval:

```
Top Recommendations (Approval Required):

1. [ORPHAN] Listing "Beach House" - 2 night gap Mar 5-6
   Action: Create DSO at -20% ($180 -> $144/night)
   Impact: Recover ~$288 in otherwise-lost revenue

2. [DEMAND] Listing "Downtown Loft" - Red demand Mar 15-18
   Action: Create DSO at +35% ($200 -> $270/night)
   Impact: Capture ~$280 additional revenue over 4 nights

3. [BASE PRICE] Listing "Mountain Cabin" - Base $150 vs recommended $175
   Action: Raise base to $175 (p50 for market)
   Impact: Expected +$2,500/month in peak season revenue
```

Each recommendation must include: listing name, action type, specific values, and expected impact. Never execute pricing changes without owner approval.

---

## Cancellation Fill Strategy Protocol

When a cancellation is detected during daily reservation sync, assess urgency and formulate a fill strategy.

### Urgency Assessment

Calculate days until the cancelled reservation's check-in date:

| Days Until Check-in | Urgency Level | Response |
|-------------------|---------------|----------|
| < 7 days | **URGENT** | Immediate action required |
| 7-14 days | **HIGH** | Act within 24 hours |
| 14-30 days | **MEDIUM** | Monitor rebooking pace, act if slow after 7 days |
| > 30 days | **LOW** | No immediate action; will be caught in next daily check |

### URGENT / HIGH Response (< 14 days)

1. **Verify date availability:** Call `pricelabs_get_prices` for the cancelled dates to confirm they are now open and bookable
2. **Check current pricing:** Review the algorithm's current price for those dates
3. **Assess demand context:** Check `demand_color` -- if high demand, the dates will likely rebook without intervention
4. **Recommend action:**
   - If demand is low/moderate AND dates are < 7 days out: Recommend last-minute DSO discount (-15% to -25%)
   - If demand is high: No DSO needed -- monitor for 24-48 hours
   - If the cancelled reservation was high-value (long stay or premium rate): Flag for owner attention

### MEDIUM Response (14-30 days)

1. Note the cancellation in today's health report
2. Monitor rebooking pace for those dates over the next 7 days
3. If dates remain unbooked after 7 days AND demand is not trending upward: Recommend a moderate DSO (-10% to -15%)
4. If dates rebook naturally: No action needed

### LOW Response (> 30 days)

1. Log the cancellation for awareness
2. No immediate pricing action -- the algorithm and normal demand patterns have time to fill the dates
3. The dates will be evaluated in the next daily health check and weekly optimization cycle

### Fill Strategy Presentation

```
Cancellation Fill Strategy:
Listing: [name]
Cancelled dates: [check_in] to [check_out] ({n} nights)
Original rate: ${x}/night (${total} total)
Urgency: [URGENT/HIGH/MEDIUM/LOW]
Days until check-in: {n}
Current demand: [color/description]

Recommendation: [specific action with DSO values if applicable]
```

For URGENT cancellations, always present the fill strategy immediately after the daily health report. For HIGH, include in the health report's Warning section. For MEDIUM and LOW, include in the Info section.
