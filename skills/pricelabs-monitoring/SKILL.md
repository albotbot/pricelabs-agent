---
name: pricelabs-monitoring
description: >
  Portfolio monitoring and reporting protocols. Teaches the agent how to
  perform daily health checks, generate formatted reports, track booking
  pace, detect stale syncs, and answer interactive portfolio queries.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

This skill provides the operational protocols for monitoring portfolio health and answering user questions. Use these protocols in combination with pricelabs-domain skill's analytical framework. All data access goes through MCP tools -- never rely on conversation context for current data.

---

## 1. Daily Health Check Protocol

When triggered for a daily health check (by cron or user request), execute these steps in order:

1. **Check rate limit budget.** Call `pricelabs_get_api_status` to verify sufficient API capacity before starting batch operations. If rate limits are critically low, defer non-essential calls and note the constraint in the report.

2. **Fetch all active listings.** Call `pricelabs_get_listings` to retrieve every listing with health scores and computed fields.

3. **Analyze each listing.** For every listing returned, note:
   - Health trend (from computed `health_trend` field -- improving, declining, or stable)
   - Occupancy gap vs market (from computed `occupancy_gap_pct`)
   - Revenue vs STLY (from computed `revenue_vs_stly_pct`)
   - Sync freshness (from computed `is_stale_sync` and `days_since_sync`)

4. **Persist daily snapshots.** Call `pricelabs_store_daily_snapshots` with all listing data to persist today's snapshot for historical tracking.

5. **Persist price snapshots.** For each listing, call `pricelabs_get_prices` to fetch the next 90 days of prices, then call `pricelabs_store_price_snapshots` to persist the price data.

6. **Persist market data.** For each listing, call `pricelabs_get_neighborhood` to fetch market context, then call `pricelabs_store_market_snapshot` to persist the market snapshot.

7. **Persist reservations and detect cancellations.** Call `pricelabs_get_reservations` for each listing, then call `pricelabs_store_reservations` to persist reservation data. The store tool automatically detects new cancellations by comparing against previous state.

8. **Compute booking pace.** Call `pricelabs_get_booking_pace` for each listing to retrieve pace data at 7/30/60/90 day cutoffs vs STLY.

9. **Identify alerts.** Scan for actionable conditions:
   - **Stale syncs:** Any listing where `is_stale_sync = true` (sync older than 48 hours). Before alerting, call `pricelabs_get_audit_log` filtered to `action_type='alert'` for that listing to check if an unresolved stale sync alert was already sent in the last 24 hours. Only alert again after the 24-hour cooldown expires, or if the sync recovered and then went stale again.
   - **Pace behind STLY:** Any listing where `is_behind_stly = true` (more than 20% behind) at any cutoff window of 30 days or longer. Do NOT alert on 7-day pace alone -- it is too volatile.
   - **New cancellations:** Reported by `pricelabs_store_reservations` in its response when previously-active reservations transition to cancelled.

10. **Log the health check.** Call `pricelabs_log_action` with `action_type='report'` to record that the daily health check was executed, including summary stats (listing count, alert count, snapshot count).

11. **Format and deliver the report.** Compose the portfolio health summary using the format in Section 2 below.

---

## 2. Report Formatting

Format the daily portfolio health summary in this structure. Use plain text with clear structure -- OpenClaw converts to channel-native formats (Slack blocks, Telegram markdown) automatically.

```
Portfolio Health Summary -- [DATE]

ALERTS (if any):
[alert emoji] [listing name]: [alert description with specific numbers]

PORTFOLIO OVERVIEW:
Listings: [total] | Synced: [synced/total] | Stale: [stale count]
Avg Occupancy: [X]% (Market: [Y]%) | Gap: [Z]%
Revenue vs STLY: [+/-X]%

PER-LISTING DETAIL:
[For each listing, one compact block:]
[listing name]
Health: [7d/30d/60d] [trend arrow] | Occ: [X]% (Mkt: [Y]%, Gap: [Z]%)
Revenue 7d: $[X] vs STLY $[Y] ([+/-Z]%)
Pace 30d: [X] bookings / $[Y] vs STLY [A] bookings / $[B] ([+/-C]%)
Base: $[X] (Rec: $[Y]) | Last Sync: [relative time]
```

**Formatting rules:**
- Use up/down arrows for trends: up arrow for improving, down arrow for declining, horizontal arrow for stable.
- Keep each listing to 4-5 lines maximum.
- For alerts, lead with the most urgent: stale syncs first, then pace alerts, then cancellations.
- Include specific numbers in every alert -- never say "low" or "behind" without the actual values.
- Round percentages to one decimal place. Round dollar amounts to whole numbers.

---

## 3. Booking Pace Tracking

Booking pace measures forward bookings compared to Same Time Last Year (STLY) at the same point in time. This is the primary leading indicator for revenue performance.

**Cutoff windows and their meaning:**
- **7-day:** Immediate booking momentum. Highly volatile -- use only for trend detection, never for standalone alerts.
- **30-day:** Short-term pace. This is the primary alert trigger. A sustained gap here indicates a real pricing issue.
- **60-day:** Medium-term pace. Confirms whether 30-day gaps are sustained trends or temporary blips.
- **90-day:** Seasonal pace. Strategic indicator for seasonal planning and base price reviews.

**Alert threshold:** 20% behind STLY at 30-day or longer cutoffs. Do NOT alert on 7-day alone -- it is too volatile for actionable alerts.

**When alerting on pace:**
- State which cutoff window triggered the alert (e.g., "30-day pace is 28% behind STLY")
- Include specific numbers: current bookings/revenue vs STLY bookings/revenue
- Include the percentage gap
- Suggest reviewing the listing's pricing strategy using the pricelabs-domain skill's optimization playbook (particularly base price calibration and min/max guardrails)
- If pace is behind at 60-day or 90-day, escalate the severity -- this indicates a structural issue, not a temporary blip

---

## 4. Stale Sync Detection

A stale sync means `last_date_pushed` is more than 48 hours old. This indicates PriceLabs prices are not reaching the PMS or channel manager -- the listing is showing incorrect (outdated) prices to guests.

**Severity: HIGH.** Stale syncs are the most urgent alert because they mean the listing is actively mispriced.

**When a stale sync is detected:**

1. **Check for alert deduplication.** Call `pricelabs_get_audit_log` filtered to `action_type='alert'` for the specific listing. If an unresolved stale sync alert was sent within the last 24 hours, do NOT send another alert. Only re-alert after the 24-hour cooldown expires, or if the sync had recovered (came back online) and then went stale again.

2. **If a new alert is needed:** Describe the issue clearly -- which listing, how long the sync has been stale (in hours or days), and the potential impact (incorrect prices showing to guests).

3. **Suggest action:** Recommend checking the PMS connection status, verifying API credentials, and trying a manual "Sync Now" if the PMS dashboard shows the connection is healthy.

4. **Log the alert.** Call `pricelabs_log_action` with `action_type='alert'` and include the listing identifier, staleness duration, and description in the details. This creates the audit trail for future deduplication checks.

---

## 5. Interactive Query Protocol

When a user asks about portfolio performance, follow these rules to ensure accurate, fresh responses.

**Rule 1: Always fetch live data first.** Call `pricelabs_get_listings` before answering any question about current state. NEVER rely on conversation history or prior context for current data -- it may be stale.

**Rule 2: State data freshness in every response.** Include the data source and age from `meta.cache_age_seconds` and `meta.data_source` in the tool response. Examples:
- "Based on live data fetched just now (cache age: 0s)..."
- "Based on cached data from 15 minutes ago (cache age: 900s, source: cache)..."

**Query types and handling:**

**Listing-by-name queries (e.g., "How is Mountain View doing?"):**
Match the user's input against listing `name`, `city_name`, `state`, and `tags`. If multiple listings match or the match is ambiguous, list the top matches and ask for clarification before providing details.

**Comparative queries (e.g., "Which listing has the best occupancy?"):**
Call `pricelabs_get_listings` to fetch all listings, rank by the requested metric, and present the top N with specific numbers. Always include the metric value, not just the ranking.

**Trend questions (e.g., "How has occupancy changed this month?"):**
Call `pricelabs_get_snapshots` to retrieve historical snapshot data. Compare current values to past snapshots. Present the trend with specific numbers and date ranges.

**Pace questions (e.g., "Is the cabin pacing ahead of last year?"):**
Call `pricelabs_get_booking_pace` for the relevant listing. Present all four cutoff windows (7/30/60/90 day) with current vs STLY comparison.

**"What changed?" questions (e.g., "What happened since yesterday?"):**
Call `pricelabs_get_audit_log` to retrieve recent actions, alerts, and reports. Summarize the key events with timestamps.

**General portfolio questions (e.g., "Give me an overview"):**
Follow the full Daily Health Check Protocol (Section 1) but present results conversationally rather than in the formal report format.

---

## 6. Approval Flow

When presenting a recommendation that requires approval (pricing changes, DSO modifications, base price adjustments):

1. **State the recommendation clearly** with specific numbers. Example: "I recommend increasing the base price for Mountain View Cabin from $185 to $210."

2. **Explain the rationale.** What data supports this change? Reference specific metrics: "The listing's 30-day ADR is $225, the recommended base price is $215, and occupancy is 92% vs 85% market average."

3. **Show before and after values.** Make the impact concrete: "Current base: $185. Proposed base: $210. Expected effect: min price moves from $111 to $126, max price moves from $555 to $630."

4. **Ask for approval.** Use this exact prompt: "Reply 'approve' to proceed or 'reject' to skip."

5. **Wait for the user's response.** Do NOT proceed without explicit approval.

6. **On approval:** Execute the action, then call `pricelabs_log_action` with `action_type='approval'` including the approved change details, rationale, and before/after values.

7. **On rejection:** Acknowledge the rejection, then call `pricelabs_log_action` with `action_type='approval'` including the rejection and the user's reasoning if provided.

**Critical safety rule:** Do NOT make any pricing changes without explicit user approval. This is the most important safety guardrail in the entire system. The agent analyzes, recommends, and explains -- but the human decides.
