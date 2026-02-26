# Monitoring Protocols

## Daily Health Check Protocol

Follow these steps every morning to assess portfolio health. This protocol is triggered by the daily cron job and should be executed in order.

### Step 1: Fetch All Listings

Call `pricelabs_get_listings` with `only_syncing_listings=true` to get all active listings.

Record the total count. This is your portfolio baseline for today.

### Step 2: Store Daily Snapshots

Call `pricelabs_store_daily_snapshots` to persist today's metrics into the local database. This enables week-over-week and historical comparisons.

The snapshot captures: occupancy windows (7/30/60/90 day), market occupancy, health scores, revenue, STLY revenue, base/min/max prices, and sync timestamps.

### Step 3: Compute Booking Pace

For each listing, compare forward occupancy against market:
- `occupancy_next_30` vs `market_occupancy_next_30`
- Flag if listing occupancy < 80% of market occupancy (e.g., listing at 45% when market is 68%)

Call `pricelabs_get_booking_pace` to compute pace relative to historical trends. A declining pace relative to STLY indicates potential pricing or market issues.

### Step 4: Detect Stale Syncs

Check `last_date_pushed` for each listing. Calculate days since last sync:
- **> 48 hours (2 days):** Flag as CRITICAL -- prices may not be pushing to PMS
- **> 24 hours:** Flag as WARNING -- monitor closely

Stale syncs mean the PMS is showing outdated prices. This is the highest-priority issue to surface.

### Step 5: Revenue Comparison (STLY)

For each listing, compare `revenue_past_7` against `stly_revenue_past_7`:
- Calculate ratio: `revenue_past_7 / stly_revenue_past_7`
- Flag if ratio < 0.70 (revenue is down more than 30% vs same time last year)

A significant revenue decline may indicate pricing issues, market shifts, or listing problems.

### Step 6: Generate Health Summary

Categorize all findings into three tiers:

**CRITICAL (immediate attention required):**
- Stale syncs (> 48 hours since last push)
- API connectivity issues

**WARNING (action recommended):**
- Low occupancy (< 80% of market) for next 30 days
- Revenue drop > 30% vs STLY for past 7 days
- Health score issues (health_7_day or health_30_day flagged by PriceLabs)
- Base price drift > 15% from recommended_base_price

**INFO (opportunities to review):**
- Orphan gaps detected in next 30 days
- Listings hitting max price on multiple dates (may be capping revenue)
- Listings pricing below 25th percentile with high booking pace (may be underpriced)

Present the summary in this format:
```
Portfolio: {n} listings active
Sync Status: {n} current / {n} stale
Avg Occupancy (30d): {x}% (market: {y}%)
Revenue (past 7d): ${x} (STLY: ${y})

Critical Alerts:
- [listing name] sync hasn't pushed in {hours} hours

Warnings:
- [listing name] occupancy 30d at {x}% vs market {y}%
- [listing name] revenue -{x}% vs STLY

Opportunities:
- [listing name] has {n} orphan gaps in next 14 days
- [listing name] hitting max price on {n} dates
```

### Step 7: Store Reservations

Call `pricelabs_store_reservations` to sync reservation data. This tool automatically detects cancellations by comparing current reservation status against previously stored records. Any new cancellations are returned in the response for follow-up.

## Alert Threshold Table

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Stale sync | days_since_sync > 2 (48 hours) | Critical | Report immediately, suggest triggering manual sync |
| Low occupancy | occupancy_next_30 < market_occupancy_next_30 * 0.8 | Warning | Compare to STLY, check if base price too high |
| Revenue drop | revenue_past_7 < stly_revenue_past_7 * 0.7 | Warning | Analyze cause: occupancy vs ADR decline |
| Health score issue | health_7_day or health_30_day flagged | Warning | Fetch listing details, check recent changes |
| Base price drift | abs(base - recommended_base) / recommended_base > 0.15 | Warning | Schedule base price calibration review |
| Overpriced | price > p90 AND booking_pace declining | Warning | Consider base price reduction |
| Underpriced | price < p25 AND booking_pace high | Info | Consider base price increase |
| Orphan gap | 1-3 night unbookable gap in next 30 days | Info | Recommend DSO discount or min-stay adjustment |

## Stale Sync Handling

When a stale sync is detected:
1. Report the listing name, last sync timestamp, and hours since sync
2. Check if `push_enabled` is true -- if false, the listing is not set up for automatic sync
3. If writes are enabled, offer to trigger a manual sync via `pricelabs_push_prices`
4. If writes are not enabled, recommend the owner check the PMS connection manually
5. Monitor on next daily check -- if still stale after 2 consecutive days, escalate to CRITICAL

## Revenue Impact Assessment Protocol

After the daily health check, check for pending impact assessments:

1. Call `pricelabs_get_change_impact` with `pending_only=true`
2. For each due assessment:
   - **DSO changes:** Compare current pricing data to the baseline stored in `before_json`. Check if affected dates have been booked since the change.
   - **Base price changes:** Compare current occupancy and revenue trends to the baseline captured before the change.
3. Record assessment results using `pricelabs_record_change`
4. If impact is significant (occupancy changed > 5 percentage points, or DSO dates booked/did not book contrary to expectations), include a brief note in today's health report
5. All assessment results feed into future recommendation prioritization
