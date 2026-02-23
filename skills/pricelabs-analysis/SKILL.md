---
name: pricelabs-analysis
description: >
  Analysis protocols for weekly optimization reports, underperformance
  detection with actionable recommendations, competitive market positioning,
  and demand calendar rendering.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

This skill provides analytical protocols for generating weekly optimization reports, detecting underperformance with specific recommended actions, analyzing competitive market positioning, and rendering demand calendars. Use these protocols in combination with pricelabs-monitoring and pricelabs-domain skills. All data access goes through MCP tools.

---

## 1. Weekly Optimization Report Protocol

When triggered for a weekly optimization report (by cron or user request), execute these steps in order:

1. **Compute portfolio KPIs with WoW comparison.** Call `pricelabs_get_portfolio_kpis` with `compare_to: "previous_week"` to get week-over-week data for all listings. This returns per-listing occupancy, revenue, base price, health scores, and the previous week's values for comparison.

2. **Compute STLY comparison.** Call `pricelabs_get_portfolio_kpis` with `compare_to: "stly"` to get year-over-year data for all listings. This uses the `revenue_vs_stly_pct` field from listing snapshots (PriceLabs provides this natively).

3. **Detect underperformers.** Call `pricelabs_detect_underperformers` with default thresholds to flag listings needing attention. This returns listings that exceed any of the underperformance thresholds defined in Section 2.

4. **Compose recommended actions.** For each underperformer returned, compose a specific recommended action using the Underperformance Action Decision Tree (Section 2). Every recommendation MUST include the specific metric, the specific action, and the specific numbers involved.

5. **Format the report.** Use the Weekly Report Template (Section 5) to assemble the final report. Lead with portfolio-level summary, follow with underperformance alerts with recommended actions, then competitive positioning, then weekly trends.

6. **Log the report.** Call `pricelabs_log_action` with `action_type='report'` and a description summarizing the report contents (listing count, alert count, key findings).

### Handling Missing Data

- **If WoW comparison returns null for prev_ fields:** State in the report: "WoW comparison: not yet available (need 7+ days of daily snapshots. Collection began [earliest snapshot date].)." Do not omit the section -- make the limitation visible so the user knows when to expect it.

- **If STLY comparison returns null:** Use the `revenue_vs_stly_pct` field from listing_snapshots (PriceLabs API provides this natively). Only note unavailability if that field is also null: "STLY comparison: not yet available. PriceLabs requires historical data from the same period last year."

- **If no underperformers detected:** State "All listings performing within healthy thresholds" and skip the underperformance section entirely. Include a note: "No listings exceeded the occupancy gap (>20%), revenue decline (>25% vs STLY), or health score (<50) thresholds."

- **If RevPAR data is incomplete:** Use the approximation formula: RevPAR = ADR * Occupancy Rate / 100. Note in the report that this is approximate. When full reservation data is available, compute exact RevPAR (Total Revenue / Total Available Nights).

---

## 2. Underperformance Detection and Action Recommendations

### Threshold Definitions

| Signal | Threshold | Severity | Default |
|--------|-----------|----------|---------|
| Occupancy gap vs market | > 20% below market | Warning | `occ_gap_threshold: 20` |
| Revenue vs STLY | > 25% below STLY | Warning | `revenue_stly_threshold: -25` |
| Health score decline | health_7_day AND health_30_day both < 50 | Warning | Fixed |
| Base price drift | > 15% from recommended_base_price | Info | Fixed |
| Price position: below 25th with high occ | Below p25, occupancy > market average | Info | Fixed |
| Price position: above 90th with low occ | Above p90, occupancy < market - 10% | Warning | Fixed |

### Underperformance Action Decision Tree

This decision tree maps each underperformance signal to a specific recommended action. Every recommendation MUST include the specific metric that triggered it, the specific action recommended, and the specific numbers involved.

```
IF underperformance_type = 'occupancy_gap' OR 'occupancy_and_revenue':
  IF base_price > p75_price:
    ACTION: "Lower base price from $[current] to $[p50_price] (market median).
             This will shift your price from the 75th+ percentile to the 50th,
             which typically improves occupancy within 1-2 weeks.
             Current occupancy: [X]% vs market [Y]% (gap: [Z]%)."

  ELIF base_price > p50_price:
    ACTION: "Expand last-minute discount window. Consider extending your
             discount curve from [current days] to [current + 7] days.
             Your base price ($[current]) is near market median ($[p50_price]),
             so the issue is likely last-minute availability, not base pricing.
             Current occupancy gap: [X]% below market."

  ELSE:
    ACTION: "Pricing is competitive (at or below median $[p50_price]).
             Review listing quality factors: photos, description, reviews,
             amenities. Compare to top-performing comps in your neighborhood.
             Current base: $[current], market p50: $[p50_price], your
             occupancy: [X]% vs market [Y]%."

IF underperformance_type = 'revenue_drop':
  IF occupancy is comparable to STLY (within 5%):
    ACTION: "ADR has dropped -- review base price. Current: $[base_price],
             Recommended: $[recommended_base_price]. Consider increasing base
             by $[diff] to restore ADR closer to STLY levels.
             Occupancy is holding steady at [X]% (STLY: [Y]%), confirming
             this is a rate issue, not a demand issue."

  ELIF occupancy significantly lower than STLY (more than 5% gap):
    ACTION: "Occupancy-driven revenue drop. Current occupancy: [X]%
             vs STLY [Y]% (gap: [Z]%). This is a demand issue.
             See occupancy gap recommendations above for pricing actions.
             Revenue impact: $[current_rev] vs STLY $[stly_rev] ([diff]%)."

  ELSE:
    ACTION: "Check for cancelled reservations impacting revenue.
             Review pricelabs_get_audit_log for recent cancellation alerts.
             Current revenue: $[current_rev] vs STLY $[stly_rev] ([diff]%).
             If cancellations are the cause, the revenue gap should narrow
             as replacement bookings come in."

IF underperformance_type = 'health_decline':
  ACTION: "Comprehensive listing audit recommended. Health scores are
           below 50 across both 7-day ([health_7d]) and 30-day ([health_30d])
           windows. Check: photos freshness, description accuracy, amenity
           list completeness, review responses, competitive pricing position.
           Market median: $[p50_price], your base: $[base_price],
           recommended: $[recommended_base_price]."

IF base_price_drift > 15%:
  ACTION: "Base price misalignment detected. Current base: $[base_price],
           recommended: $[recommended_base_price] (drift: [diff]%).
           Review whether your base price still reflects market conditions.
           Market p50: $[p50_price], your position: [percentile]."

IF price_position = 'below_25th' AND occupancy > market_average:
  ACTION: "You may be leaving revenue on the table. Your base price
           ($[base_price]) is below the 25th percentile ($[p25_price])
           while your occupancy ([X]%) exceeds market average ([Y]%).
           Consider raising base price to $[p50_price] (market median)
           to capture more revenue per booking."

IF price_position = 'above_90th' AND occupancy < market_average - 10%:
  ACTION: "Premium pricing may be limiting bookings. Your base price
           ($[base_price]) is above the 90th percentile ($[p90_price])
           while occupancy ([X]%) is [Z]% below market average ([Y]%).
           Consider moving toward the 75th percentile ($[p75_price])
           to improve occupancy without abandoning premium positioning."
```

### CRITICAL RULE: Specific Actions with Specific Numbers

Every recommendation MUST include:

1. **The specific metric that triggered the alert** -- e.g., "occupancy 25% below market" or "revenue 32% below STLY"
2. **The specific action recommended** -- e.g., "lower base price from $185 to $165" or "expand last-minute discount from 7 to 14 days"
3. **The specific numbers involved** -- dollar amounts, percentages, percentile positions, occupancy rates

Words like "consider", "may want to", or "look into" are NOT acceptable without specific numbers attached. Every vague suggestion must be grounded with data:

- BAD: "Consider lowering your price"
- GOOD: "Lower base price from $185 to $165 (market median). Current occupancy gap: 28% below market."
- BAD: "Look into your listing quality"
- GOOD: "Pricing is competitive at $145 (below market median $160). Review listing quality: health scores at 42/38 (7d/30d) suggest non-pricing issues."

---

## 3. Competitive Position Analysis Protocol

When a user asks "how is my pricing compared to the market?" or when competitive context is needed for the weekly report, follow these steps:

1. **Check market data freshness.** Query `pricelabs_get_portfolio_kpis` to get the latest snapshot data which includes market positioning context. Check if the market snapshot date is within the last 48 hours.

2. **If market data is stale (> 48 hours old):** For each listing, call `pricelabs_get_neighborhood` to fetch fresh neighborhood data, then call `pricelabs_store_market_snapshot` to persist the refreshed market data. This prevents the analysis from using outdated competitive context.

3. **Present per-listing positioning.** For each listing, format the competitive position as:
   ```
   [Listing Name] is priced at $[base_price] -- positioned at [price_position]
   percentile. Market: p25=$[p25], p50=$[p50], p75=$[p75], p90=$[p90].
   [N] comparable listings used.
   ```

4. **Flag actionable positioning signals:**

   - **Below 25th percentile with high occupancy:** "You may be leaving revenue on the table. High occupancy ([X]%) at a low price point ($[base_price], below p25 of $[p25]) suggests room to increase base price toward the median ($[p50])."

   - **Above 90th percentile with low occupancy:** "Premium pricing may be limiting bookings. Your base ($[base_price]) exceeds the 90th percentile ($[p90]). Consider moving toward the 75th percentile ($[p75]) to improve occupancy. Current occupancy: [X]% vs market [Y]%."

   - **Within 25th-75th percentile with healthy metrics:** "Pricing is well-positioned within the market range. Base: $[base_price], market median: $[p50]. Occupancy: [X]% vs market [Y]%."

5. **Portfolio-level competitive summary.** After per-listing details, provide a summary:
   ```
   Portfolio Competitive Summary:
   [N] listings below 25th percentile (potential underpriced)
   [N] listings in 25th-75th range (well-positioned)
   [N] listings above 75th percentile (premium/aggressive)
   ```

---

## 4. Demand Calendar Rendering Protocol

When a user asks for a demand calendar or when demand context is needed:

1. **Determine date range.** If the user specified a range, use it. Otherwise, default to the next 14 days. Offer: "Showing next 14 days. Want to see a longer range?"

2. **Fetch price data.** Call `pricelabs_get_prices` for the listing with the determined date range. This returns per-date pricing with demand level indicators.

3. **Extract per-date fields.** For each date in the response, extract: date, price, demand_level (from computed fields), booking_status.

4. **Map demand levels.** Use the demand_color values from computed-fields.ts to assign demand level descriptors:
   - Red (#FF0000) = **HIGH** -- Strong demand, algorithm pushes prices up significantly
   - Orange = **HIGH** -- Above average demand, moderate upward pressure
   - Yellow = **MED** -- Average demand, prices near base
   - Green = **LOW** -- Below average demand, downward pressure
   - Blue = **LOW** -- Low demand, maximum discounts applied

5. **Render in text format.** Use this exact format:
   ```
   Demand Calendar -- [Listing Name] (next [N] days)
   ---
   [Date] [Day]  $[Price]  [DEMAND]  [status]
   [Date] [Day]  $[Price]  [DEMAND]  [status]
   ...
   ---
   Legend: [HIGH] = Strong demand | [MED] = Moderate | [LOW] = Weak demand
   ```

   Example:
   ```
   Demand Calendar -- Mountain View Cabin (next 14 days)
   ---
   Feb 23 Sun  $185  [LOW]     available
   Feb 24 Mon  $165  [LOW]     available
   Feb 25 Tue  $172  [LOW]     available
   Feb 26 Wed  $178  [MED]     available
   Feb 27 Thu  $195  [MED]     available
   Feb 28 Fri  $245  [HIGH]    booked
   Mar 01 Sat  $268  [HIGH]    booked
   Mar 02 Sun  $198  [MED]     available
   Mar 03 Mon  $175  [LOW]     available
   Mar 04 Tue  $170  [LOW]     available
   Mar 05 Wed  $178  [MED]     available
   Mar 06 Thu  $192  [MED]     available
   Mar 07 Fri  $238  [HIGH]    booked
   Mar 08 Sat  $255  [HIGH]    available
   ---
   Legend: [HIGH] = Strong demand | [MED] = Moderate | [LOW] = Weak demand
   ```

6. **Handle long ranges (> 30 days).** If the user requests more than 30 days, summarize instead of enumerating every date:
   ```
   Demand Summary -- [Listing Name] (next [N] days)
   [X] high-demand dates | [Y] medium-demand dates | [Z] low-demand dates

   Top high-demand dates:
   [Date] [Day]  $[Price]  [HIGH]  [status]
   [Date] [Day]  $[Price]  [HIGH]  [status]
   ... (list top 5-7 high-demand dates)

   Average price: $[avg] | Range: $[min] - $[max]
   ```

7. **Include booking status context.** If most high-demand dates are already booked, note: "Most high-demand dates are already booked ([X] of [Y]). Remaining availability is primarily in low/medium demand periods."

---

## 5. Report Templates

### Weekly Optimization Report Template

```
Weekly Optimization Report -- Week of [DATE]
=============================================

PORTFOLIO SUMMARY:
Listings: [N] | Avg Occupancy: [X]% (WoW: [+/-Y]%) | Avg Revenue 7d: $[Z] (WoW: [+/-W]%)
STLY Comparison: Revenue [+/-X]% | Occupancy [+/-Y]%

UNDERPERFORMANCE ALERTS:
[For each flagged listing:]
[!] [Listing Name] -- [underperformance_type]
  Signal: [specific metric and value that triggered the flag]
  Recommended Action: [specific action from decision tree with dollar amounts]
  Market Context: Priced at $[base] (market p50: $[p50], position: [percentile])

COMPETITIVE POSITIONING:
[For each listing, one line:]
[Name]: $[base] ([position] percentile) | Market p50: $[p50] | Occ: [X]% vs Market [Y]%

WEEKLY TRENDS:
[For each listing with WoW data:]
[Name]: Occ [X]% -> [Y]% ([+/-Z]%) | Rev $[A] -> $[B] ([+/-C]%)

---
Report generated [timestamp]. Data from [snapshot_date] snapshots.
```

**Template formatting rules:**
- Use `[!]` prefix for warning-severity alerts, `[i]` for info-severity signals.
- Keep each underperformance alert to 3-4 lines: signal, action, context.
- Round percentages to one decimal place. Round dollar amounts to whole numbers.
- If WoW or STLY data is unavailable, replace with "N/A (collecting data since [date])".
- If no underperformance alerts, state "All listings performing within healthy thresholds" and omit the section.

### Underperformance Alert Template

For immediate alerts outside the weekly report (e.g., triggered by ad-hoc analysis):

```
Underperformance Alert -- [Listing Name]
Signal: [metric] is [value] ([threshold] threshold exceeded)
Severity: [Warning | Info]
Recommended Action: [specific action with numbers from decision tree]
Market Context: Priced at $[base] ([position] percentile). Market p50: $[p50].
                Occupancy: [X]% vs market [Y]%.
```

---

## 6. Coordination with Monitoring Skill

### Responsibility Delineation

**Monitoring skill owns:**
- Daily health checks (data collection, snapshot persistence, basic alerting)
- Real-time stale sync alerts (detection + urgency context)
- Booking pace alerts at 30d+ cutoffs (detection + basic comparison)
- Cancellation alerts (detection from reservation store)
- Interactive queries about current portfolio state

**Analysis skill owns:**
- Weekly optimization reports (deep analysis with WoW/STLY comparisons)
- Underperformance detection with specific recommended actions and dollar amounts
- Competitive position analysis (market percentile positioning)
- Demand calendar rendering
- Actionable recommendations backed by specific numbers

### Alert Deduplication Rule

Before sending any underperformance alert, call `pricelabs_get_audit_log` filtered to `action_type='alert'` for that listing. If an alert for the same underperformance signal was sent within the last 24 hours, do NOT send a duplicate. This extends the existing 24-hour cooldown pattern from the monitoring skill.

Specifically:
- Query: `pricelabs_get_audit_log` with `listing_id=[id]`, `action_type='alert'`, `since=24h ago`
- If a matching alert exists (same underperformance_type for the same listing): skip the alert
- If no matching alert or the previous alert is resolved: send the new alert and log it

### Cross-Reference Rule

If a listing appears in both daily health check alerts this week AND the weekly optimization report, the weekly report should note: "This listing was flagged [N] times in daily health checks this week for [signal]. The recurring pattern suggests [interpretation]."

To implement this cross-reference:
1. Call `pricelabs_get_audit_log` filtered to `action_type='alert'` for the past 7 days
2. Count alerts per listing per signal type
3. Include the count and pattern interpretation in the weekly report's underperformance section for that listing

### Weekly Report Builds on Daily Data

The weekly report uses snapshots already stored by the daily health check cron job. It does NOT re-fetch from the PriceLabs API unless:
- Market data is stale (> 48 hours old) -- in which case, call `pricelabs_get_neighborhood` to refresh
- No snapshot exists for the expected date -- in which case, note the gap in the report

This prevents redundant API calls and rate limit consumption. The daily health check (8am CT) stores fresh snapshots; the weekly report (10am Monday CT) reads those snapshots 2 hours later.
