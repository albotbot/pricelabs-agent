---
name: pricelabs-optimization
description: >
  Pricing optimization protocols: orphan day detection, demand spike
  detection, base price calibration, approval workflow, write operation
  safety, recommendation prioritization, and rollback procedures.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

This skill provides pricing optimization protocols for detecting opportunities, formulating recommendations, and safely executing approved changes. Use these protocols in combination with pricelabs-domain, pricelabs-monitoring, and pricelabs-analysis skills. All data access goes through MCP tools. CRITICAL: No pricing change may be executed without explicit user approval.

---

## 1. Orphan Day Detection Protocol (OPT-05)

Orphan days are short gaps of 1-3 available nights between bookings that are unlikely to book at current pricing or min-stay settings. Filling these gaps is the single highest-ROI optimization (approximately 7% revenue increase in controlled tests).

**When to run:** During weekly optimization scans, or when the user asks about gaps or orphan days.

**Steps:**

1. **Fetch pricing data.** For each listing, call `pricelabs_get_prices` for the next 30 days. This returns per-date pricing with `booking_status`, `unbookable`, and `min_stay` fields.

2. **Map booking status.** For each date, classify as:
   - **booked** -- `booking_status = "booked"`
   - **available** -- `booking_status` is not "booked" and `unbookable = "0"`
   - **blocked** -- `unbookable = "1"` (owner block, maintenance, personal use)

3. **CRITICAL: Exclude owner blocks from gap analysis.** Check the `unbookable` field for every date. If `unbookable = "1"`, that date is an owner block -- exclude it from gap analysis entirely. Do NOT recommend filling dates that are owner-blocked. This is a hard rule to prevent impossible recommendations.

4. **Identify orphan gaps.** Scan for consecutive available dates surrounded by booked or blocked dates:
   - **1-night gap:** Highest priority. A single available night between bookings is the most likely to go unbooked. These represent certain revenue loss if not filled.
   - **2-night gap:** High priority. Short stay that may need a min-stay reduction to become bookable.
   - **3-night gap:** Moderate priority. May book naturally without intervention. Monitor first, recommend only if still open within 14 days of check-in.

5. **Diagnose the cause.** For each orphan gap found:
   - Check current `min_stay` for those dates. If `min_stay` exceeds the gap length, that is the cause -- the gap cannot be booked because the minimum stay requirement is too high.
   - Check if the gap is within 14 days (high urgency) or 14-30 days (moderate urgency).

6. **Formulate recommendations.** For each orphan gap:
   - **1-night gaps caused by min_stay:** Recommend reducing `min_stay` to 1 via a DSO override. This is the primary fix -- the gap cannot book at all until min_stay is reduced.
   - **1-night gaps with min_stay already at 1:** Recommend a percentage DSO of -20% (orphan discount) to increase booking likelihood.
   - **2-night gaps:** Recommend a percentage DSO of -15% to -20%. If min_stay exceeds 2, also recommend reducing min_stay to 2.
   - **3-night gaps within 14 days:** Recommend a percentage DSO of -15%. If min_stay exceeds 3, also recommend reducing min_stay to 3.
   - **3-night gaps 14-30 days out:** Note for monitoring. Only recommend action if still unfilled at the next scan.

7. **Calculate fill price.** For each recommendation, calculate the recommended fill price: current algorithm price * 0.80 (20% orphan discount). Present this as the expected nightly rate after the DSO.

8. **Never recommend changes for booked dates.** Before including any date in a recommendation, verify `booking_status != "booked"`. Booked dates cannot have their prices effectively changed.

9. **Present all orphan gaps grouped by listing.** For each recommendation include:
   - Listing name and dates affected
   - Current price and proposed price (or current min_stay and proposed min_stay)
   - Why this is an orphan (what bookings surround it -- e.g., "1 available night between a checkout on March 14 and a check-in on March 16")
   - Expected revenue impact: "Filling a 1-night gap at $X earns $X vs $0 if it stays empty"

---

## 2. Demand Spike Detection Protocol (OPT-06)

Demand spikes indicate dates where market demand is significantly above average. These represent revenue upside -- pricing into confirmed demand with targeted DSOs can capture additional revenue without risking occupancy.

**When to run:** During weekly optimization scans, or when the user asks about upcoming events or demand.

**Steps:**

1. **Fetch pricing data.** For each listing, call `pricelabs_get_prices` for the next 90 days. This returns per-date pricing with `demand_color` and the algorithm's computed price.

2. **Identify demand spikes.** Map `demand_color` values to demand levels:
   - `#FF0000` or similar red shades = **HIGH** demand -- strong market signal, algorithm pushes prices up significantly
   - `#FFA500` or orange shades = **MEDIUM-HIGH** demand -- above average, moderate upward pressure
   - Yellow, green, blue = normal or low demand -- skip these dates

3. **Group into event clusters.** Group consecutive high-demand dates (HIGH or MEDIUM-HIGH) into event clusters. A cluster is a sequence of 1 or more consecutive high-demand dates with no more than 1 normal-demand date gap between them. Name the cluster by its date range (e.g., "March 14-17 demand spike").

4. **Check existing DSOs.** For each demand spike cluster, call `pricelabs_get_overrides` to check if DSOs already exist for those dates.

5. **Evaluate algorithm pricing.** CRITICAL: Before recommending a DSO, check whether the algorithm has already elevated pricing significantly above base for these dates. Compare the current algorithm price to the listing's base price:
   - If the algorithm price is already 20%+ above base price, the algorithm is likely already handling this event. Note this and skip the recommendation UNLESS there is specific reason to believe the algorithm is under-pricing (e.g., a known major event not reflected in historical data).
   - If the algorithm price is within 20% of base price despite HIGH demand color, the algorithm may not have enough data yet. This is where a manual DSO adds value.

6. **Formulate recommendations.** If no DSOs exist and the algorithm has not significantly elevated pricing:
   - **HIGH demand (red), multi-day event:** Recommend a percentage DSO of +25% to +30%.
   - **HIGH demand (red), single day:** Recommend a percentage DSO of +20% to +25%.
   - **MEDIUM-HIGH demand (orange):** Recommend a percentage DSO of +15% to +20%.
   - Always use percentage DSOs (not fixed-price) for demand spikes. Percentage DSOs work WITH the algorithm rather than overriding it entirely.

7. **Cross-reference with market data.** Call `pricelabs_get_neighborhood` for market validation. If neighborhood occupancy for the period is also elevated, this confirms the demand signal and strengthens the recommendation. If neighborhood data shows normal occupancy despite high demand_color, note the discrepancy.

8. **Never recommend DSOs for already-booked dates.** Filter out any dates where `booking_status = "booked"` before formulating the recommendation.

9. **Present each recommendation with:**
   - Listing name and dates affected
   - Demand level (HIGH / MEDIUM-HIGH) and source (`demand_color` values)
   - Current algorithm price vs proposed DSO-adjusted price
   - Whether existing DSOs are already in place (and what they are)
   - Market context from neighborhood data (occupancy, rate trends)
   - Rationale: "High demand detected for March 14-17. No existing DSOs. Algorithm price is near base. A +25% DSO would capture event demand."

---

## 3. Monthly Base Price Calibration Protocol (OPT-07)

Base price is the anchor for all PriceLabs pricing calculations. Calibrating it against market data ensures the algorithm works from the right starting point. This is a monthly check -- not weekly, not daily.

**When to run:** Once per month per listing, triggered during the weekly optimization scan. The skill enforces a 30-day minimum interval between base price changes.

**Steps:**

1. **Enforce the 30-day interval.** Before recommending any base price change, check the audit log: call `pricelabs_get_audit_log` with the `listing_id` and `action_type='execution'`. Scan results for base price changes (look for `change_type: 'update_listing'` with base price modifications in `details_json`). If the last base price change was less than 30 days ago, skip this listing entirely. The 30-day minimum interval between base price changes is a hard rule to prevent panic pricing.

2. **Fetch market data.** Call `pricelabs_get_neighborhood` for the listing to get market percentile data: p25, p50, p75, p90 prices, and market occupancy rate.

3. **Fetch listing data.** Call `pricelabs_get_listing` for the current base price, min price, max price, and the PriceLabs `recommended_base_price`.

4. **Compare base price to market percentiles:**
   - **Below p25 with occupancy above market average:** Listing is under-priced and in high demand. Occupancy is strong despite low pricing, meaning the listing is leaving revenue on the table. Recommend increasing base price toward p50 (market median).
   - **Above p75 with occupancy below market average:** Listing is over-priced and struggling to attract bookings. Recommend decreasing base price toward p50 to improve occupancy.
   - **Between p25 and p75 with normal occupancy metrics:** No change needed. The listing is well-positioned within the market range.

5. **Cross-reference with PriceLabs recommended_base_price.** If the `recommended_base_price` differs from the current base by more than 10%, factor this into the recommendation. PriceLabs' recommendation incorporates review count, rating, and market positioning data the agent does not have direct access to.

6. **CRITICAL: Show the full cascading impact.** PriceLabs min and max prices can be configured as percentages of base price. When presenting a base price change recommendation, calculate and show:
   - Current base, min, max prices
   - Whether min and max are fixed values or percentages of base
   - Proposed new base price
   - Resulting new min and max prices (if they are percentage-based)
   - Example: "Current base: $185, min: $111 (60%), max: $555 (300%). Proposed base: $210. New min: $126, new max: $630."

7. **Prevent panic pricing.** Only recommend one direction of change at a time. Never recommend two consecutive base price decreases for the same listing without an intervening review period. If the audit log shows the last change was a decrease, do not recommend another decrease -- recommend monitoring for 30 more days first.

8. **Present the recommendation with:**
   - Current base price vs proposed base price
   - Market percentile positioning: where the listing sits now and where it would sit after the change
   - Listing occupancy vs market occupancy (the demand signal)
   - PriceLabs `recommended_base_price` for reference
   - Full min/max price impact (current and projected)
   - Rationale: which signals triggered the recommendation and what the expected outcome is

---

## 4. Write Operation Safety Protocol

These rules apply to ALL write operations (`pricelabs_set_overrides`, `pricelabs_update_listings`, `pricelabs_delete_overrides`). No exceptions.

### Rule 1: Pre-write snapshot is MANDATORY

Before EVERY write operation, you MUST call `pricelabs_snapshot_before_write` with the `listing_id`, `pms`, `operation_type`, and date range (if applicable). This captures the current state for rollback capability.

**NEVER call `pricelabs_set_overrides`, `pricelabs_update_listings`, or `pricelabs_delete_overrides` without first calling `pricelabs_snapshot_before_write`.** No exceptions. No shortcuts. If you are about to execute a write and realize you have not taken a snapshot, stop and take the snapshot first.

### Rule 2: Never write without approval

Do NOT execute any write operation without explicit user approval. The following are NOT approval:
- "Sounds good"
- "Sure"
- "Ok"
- "Makes sense"
- "Yeah"
- Silence or no response

The user MUST say "approve", "yes, proceed", "go ahead and make the change", or an unambiguous equivalent that explicitly authorizes execution. If uncertain whether the user's response constitutes approval, ask again: "Just to confirm -- shall I proceed with this change? Reply 'approve' to execute."

### Rule 3: Post-write verification

The `pricelabs_set_overrides` tool already performs post-write verification and reports any silently dropped dates. After receiving the write response, check the `verification` field:
- `"verified"` -- All dates confirmed written successfully. Report success to the user.
- `"partial"` -- Some dates were dropped. Report which dates were dropped and likely why (usually past dates or dates outside the PriceLabs sync window). The user should be aware of partial writes.
- `"unverified"` -- Verification fetch failed (network error or rate limit). Note this to the user and suggest checking PriceLabs dashboard manually to confirm.

### Rule 4: Sync timing caveat

After every successful write, inform the user about sync timing: "Changes saved to PriceLabs. They will sync to [PMS name] during the next nightly sync cycle (6pm-6am CT). For immediate sync, I can trigger a manual push with `push_prices`."

Only offer `push_prices` if the user indicates urgency. Do not auto-push. Manual pushes consume rate limit budget and are not needed for most changes that are days in the future.

### Rule 5: One write at a time

Execute write operations sequentially, not in parallel. Wait for one write to complete and verify before starting the next. This prevents cascading failures if a write is rejected by PriceLabs. If writing DSOs for multiple listings, complete the full cycle (snapshot, write, verify) for one listing before moving to the next.

---

## 5. Approval Flow Protocol (OPT-01, OPT-02)

This protocol governs the full lifecycle of a pricing recommendation from detection through execution. Every step includes audit logging to maintain a complete trail.

### Step 1: Pre-write snapshot

Call `pricelabs_snapshot_before_write` to capture current state. This snapshot was likely captured during the detection protocol, but if more than 30 minutes have passed since the recommendation was generated, re-capture a fresh snapshot immediately before presenting the recommendation. Stale snapshots risk rolling back to incorrect values.

### Step 2: Present the recommendation

Format EVERY recommendation with ALL of these fields:

- **What will change:** Specific field being modified (base price / DSO percentage / DSO fixed price / min-stay override)
- **Current value:** From the snapshot (exact numbers, not approximations)
- **Proposed new value:** The recommendation (exact numbers)
- **Rationale:** Which detection protocol triggered this (orphan day / demand spike / base price calibration) and the specific metrics that support the recommendation
- **Impact:** For base price changes: show the full min/max cascade. For DSOs: show which dates are affected and the resulting per-night prices. For min-stay changes: show which dates and the new minimum.
- **Listing name and ID** for clarity

Example:
```
Recommendation: Orphan Day Fill -- Mountain View Cabin

What will change: DSO percentage override for March 15
Current value: No override (algorithm price: $195)
Proposed: -20% DSO (resulting price: approximately $156)
Rationale: 1-night gap detected between checkout March 14 and check-in March 16.
           Gap has been open for 7 days with no bookings. At $195, the single
           night is unlikely to book at this lead time.
Impact: March 15 price drops from $195 to approximately $156. Revenue of $156
        vs $0 if the night stays empty.
Listing: Mountain View Cabin (ID: 12345)
```

### Step 3: Log the recommendation

Call `pricelabs_log_action` with:
- `action_type: 'recommendation'`
- `listing_id` and `pms`
- `description`: One-line summary (e.g., "Recommend 20% orphan discount for Mountain View Cabin, March 15")
- `details_json`: JSON with:
  ```json
  {
    "change_type": "set_overrides",
    "listing_id": "12345",
    "pms": "bookingsync",
    "current_values": { "price": 195, "override": null },
    "proposed_values": { "percentage": -20, "resulting_price": 156 },
    "rationale": "1-night orphan gap between bookings, 7 days to check-in",
    "detection_protocol": "orphan_day_detection"
  }
  ```

### Step 4: Wait for approval

Present: "Reply **approve** to proceed or **reject** to skip this change."

Do NOT proceed without explicit approval. Do NOT interpret ambiguous responses as approval. If the user asks questions about the recommendation, answer them and re-present the approval prompt.

### Step 5: On approval

1. **Log approval.** Call `pricelabs_log_action` with `action_type: 'approval'`, details including `approved_by: 'user'` and `approved_at` timestamp (current UTC time).

2. **Re-snapshot if stale.** If more than 30 minutes have passed since the last snapshot for this listing, call `pricelabs_snapshot_before_write` again to capture the CURRENT state. This prevents executing against stale data if the user took time to decide, or if external changes occurred.

3. **Execute the write.** Call the appropriate write tool:
   - `pricelabs_set_overrides` for DSO changes (percentage, fixed price, min-stay overrides)
   - `pricelabs_update_listings` for base price, min price, or max price changes
   - `pricelabs_delete_overrides` for removing existing DSOs

4. **Log execution.** Call `pricelabs_log_action` with `action_type: 'execution'`, including the full before/after values from the snapshot and write response, verification status, and any dropped dates. Use this structure for `details_json`:
   ```json
   {
     "change_type": "set_overrides",
     "listing_id": "12345",
     "pms": "bookingsync",
     "approved_by": "user",
     "approved_at": "2026-03-10T14:30:00Z",
     "before": { "base_price": 195, "overrides": [] },
     "after": { "overrides": [{ "date": "2026-03-15", "percentage": -20 }] },
     "rationale": "Orphan day fill: 1-night gap between bookings",
     "verification": "verified",
     "dropped_dates": []
   }
   ```

5. **Confirm to the user.** Report the completed change with before/after values. Include the sync timing caveat: "Changes saved to PriceLabs. They will sync to [PMS name] during the next nightly sync cycle (6pm-6am CT). For immediate sync, I can trigger a manual push with push_prices."

### Step 6: On rejection

1. **Log rejection.** Call `pricelabs_log_action` with `action_type: 'approval'`, details noting the rejection and the user's reason if provided:
   ```json
   {
     "action": "rejected",
     "listing_id": "12345",
     "pms": "bookingsync",
     "reason": "User: 'That date is for a friend staying, skip it.'"
   }
   ```

2. **Acknowledge.** "Got it, skipping this change."

3. **Move on.** Continue to the next recommendation if any remain in the current batch.

---

## 6. Recommendation Prioritization

When running an optimization scan (triggered by cron or user request), prioritize recommendations to prevent approval fatigue. Too many recommendations overwhelm the user and lead to disengagement.

### Priority levels

- **HIGH (present immediately):** Orphan days within the next 14 days. These represent imminent, certain revenue loss. The gap will remain empty if not filled before check-in approaches.

- **MEDIUM (present after high-priority):** Demand spikes with no DSOs in the next 30 days. These represent revenue upside from pricing into confirmed demand, but are less urgent because the dates are further out.

- **LOW (present only if asked or during monthly review):** Base price calibration recommendations. Monthly check, not time-sensitive. Only recommend if 30+ days have passed since the last base price adjustment.

### Presentation rules

1. **Maximum 5 recommendations per scan.** If more than 5 opportunities are detected, present the top 5 by priority (HIGH first, then MEDIUM) and say: "I found [N] more opportunities at medium or low priority. Want to see the rest?"

2. **Group by listing.** Present all recommendations for one listing together rather than jumping between listings. This helps the user maintain context. Example: "For Mountain View Cabin, I have 2 recommendations: an orphan day fill for March 15 and a demand spike DSO for March 21-23."

3. **Number clearly.** When presenting multiple recommendations, number them: "Recommendation 1 of 3:", "Recommendation 2 of 3:", etc. This makes individual approval possible.

4. **Support batch approval.** After presenting, the user can:
   - Approve individually: "approve 1" or "approve recommendation 2"
   - Approve all: "approve all"
   - Reject all: "reject all" or "skip"
   - Cherry-pick: "approve 1 and 3, reject 2"

5. **48-hour expiry.** Recommendations older than 48 hours should be recalculated rather than executed. Prices, availability, and demand signals change. If a user returns to approve a recommendation after 48 hours, re-run the detection protocol to confirm the opportunity still exists and the numbers are still accurate.

---

## 7. Rollback Protocol

When the user requests a rollback of a previous change (e.g., "undo that last price change" or "roll back the DSOs I approved yesterday"):

### Step 1: Find the snapshot

Call `pricelabs_get_audit_log` with `listing_id` and `action_type='snapshot'` to find the pre-write snapshot for the change to be rolled back. The snapshot's `details_json` contains the `listing_state` (base/min/max prices) and `existing_overrides` (DSOs that were in place before the change).

If no snapshot is found, inform the user: "I could not find a pre-write snapshot for this change in the audit log. Without a snapshot, I cannot determine the exact values to restore. Would you like me to check the current values and help you set them manually?"

### Step 2: Show what will be restored

Present the before values from the snapshot alongside the current values (post-change). Make the rollback impact clear:
```
Rollback: Mountain View Cabin -- March 15 DSO

Current state (after change): -20% DSO on March 15 (price: $156)
Restore to (before change): No DSO on March 15 (price: $195)

This will remove the orphan day discount and restore the algorithm's original pricing.
```

### Step 3: Re-fetch current state

CRITICAL: Before executing the rollback, call `pricelabs_snapshot_before_write` again to capture the CURRENT state. This prevents overwriting any manual changes the user or another manager may have made between the original write and the rollback request. The rollback itself is a write operation and follows all safety protocols.

### Step 4: Get approval

Rollback is still a write operation. Present: "I will restore the following values: [before values from snapshot]. Reply 'approve' to proceed."

Do NOT auto-execute rollbacks. The user must explicitly approve, just like any other write.

### Step 5: Execute rollback

Use the appropriate write tool to restore the before values:
- **For DSO rollback (removing a DSO):** Call `pricelabs_delete_overrides` for the affected dates if the original state had no overrides. If the original state had different overrides, call `pricelabs_set_overrides` with the original override values.
- **For DSO rollback (restoring original DSOs):** Call `pricelabs_set_overrides` with the override values from the snapshot's `existing_overrides`.
- **For base price rollback:** Call `pricelabs_update_listings` with the original base, min, and max values from the snapshot's `listing_state`.

### Step 6: Log the rollback

Call `pricelabs_log_action` with `action_type: 'rollback'`, including:
- The snapshot reference (timestamp of the original snapshot)
- Before values (what was in place after the change that is being rolled back)
- After values (what was restored -- the original pre-change values)
- Reason for rollback (user's stated reason if provided)
- Verification status

```json
{
  "action_type": "rollback",
  "listing_id": "12345",
  "pms": "bookingsync",
  "original_snapshot_at": "2026-03-10T14:00:00Z",
  "rolled_back_from": { "overrides": [{ "date": "2026-03-15", "percentage": -20 }] },
  "rolled_back_to": { "overrides": [] },
  "reason": "User requested undo of orphan day discount",
  "verification": "verified"
}
```

### Step 7: Verify

Post-write verification applies to rollbacks too. Check the `verification` field in the write response to confirm the values were restored correctly. Report the outcome to the user with the sync timing caveat.

---

## 8. Batch Approval Protocol (SCALE-01)

When presenting multiple recommendations from an optimization scan (weekly cron or user-requested), this protocol governs how the agent handles batch approval, tracks execution state, handles partial failures, and produces a completion report.

### Batch state tracking

When presenting multiple recommendations, number them clearly per Section 6 rule 3. After the user responds with an approval, the agent MUST echo back exactly which recommendations it will execute before proceeding. Example:

```
I will execute recommendations 1, 3, and 5. Recommendations 2 and 4 will be skipped. Confirm?
```

Wait for the user to confirm before beginning execution. This confirmation step prevents misinterpretation of ambiguous batch commands (e.g., "approve the first three" could mean items 1-3 or the first three listings).

### Batch approval syntax

Recognize these approval patterns from the user:

- **"approve all"** -- Execute all presented recommendations sequentially.
- **"approve 1, 3, 5"** or **"approve 1 and 3"** -- Cherry-pick specific recommendation numbers.
- **"reject all"** or **"skip all"** -- Reject all recommendations. Log each rejection.
- **"approve 1-3, reject 4-5"** -- Mixed approval with ranges. Execute 1, 2, 3; skip 4, 5.
- **Any ambiguous response** -- Echo back the agent's interpretation and ask for confirmation. Example: "I interpreted that as approving recommendations 1 and 2 and rejecting 3-5. Is that correct?"

### Sequential execution with error handling

For each approved recommendation, execute the standard approval flow from Section 5:

1. **Pre-write snapshot.** Call `pricelabs_snapshot_before_write` (or re-snapshot if the existing snapshot is older than 30 minutes).
2. **Execute the write.** Call the appropriate write tool (`pricelabs_set_overrides`, `pricelabs_update_listings`, or `pricelabs_delete_overrides`).
3. **Verify.** Check the `verification` field in the write response.
4. **Log execution.** Call `pricelabs_log_action` with `action_type='execution'` and full before/after details.

**If a write fails:** Log the failure with `pricelabs_log_action` using `action_type='execution'` with the error details in `details_json`. Report the error to the user. Then **continue with the remaining approved recommendations.** Do NOT abort the entire batch on a single failure. Track the failure in the running tally.

Keep a running tally of results as execution proceeds: successes, failures, and skips (user-rejected).

### Post-execution change tracking

After each successful execution within the batch, call `pricelabs_record_change` with:
- `audit_log_id` -- The ID from the execution log entry
- `listing_id` and `pms` -- The listing that was changed
- `change_type` -- `set_overrides`, `update_listing`, or `delete_overrides`
- `affected_dates_start` and `affected_dates_end` -- For DSO changes, the date range affected
- `before_json` -- The snapshot values before the change
- `after_json` -- The values after the change (from the write response)

This registers the change for 7/14/30 day revenue impact follow-up tracking. Do NOT create change tracking entries for failed writes or rejected recommendations.

### Batch completion report

After all approved recommendations have been processed (or attempted), present a batch summary report:

```
Batch complete: Executed 3 of 5 recommendations.
- Rec 1 (Mountain View Cabin orphan fill Mar 15): SUCCESS -- DSO -20% applied
- Rec 2 (Beach House demand spike Mar 21-23): REJECTED by user
- Rec 3 (Mountain View Cabin demand spike Apr 5-7): SUCCESS -- DSO +25% applied
- Rec 4 (Beach House base price adjustment): REJECTED by user
- Rec 5 (Lake House orphan fill Mar 18): FAILED -- rate limit exceeded, retry later

Changes tracked for 7/14/30 day revenue impact follow-up.
All changes sync to BookingSync during the next nightly cycle (6pm-6am CT).
```

Include the sync timing caveat from Section 4 Rule 4 once at the end of the batch report rather than after each individual execution.

To review impact results for any batch at a later date, call `pricelabs_get_change_impact` with the relevant listing ID to see 7/14/30 day follow-up assessments.

### Batch audit logging

After the batch is complete, log a single batch summary entry with `pricelabs_log_action`:
- `action_type: 'report'`
- `description`: "Batch execution complete: X of Y recommendations executed"
- `details_json`:
  ```json
  {
    "batch_context": {
      "total_recommendations": 5,
      "approved": 3,
      "rejected": 2,
      "succeeded": 2,
      "failed": 1
    },
    "results": [
      { "rec": 1, "listing_id": "12345", "action": "orphan_fill", "status": "success" },
      { "rec": 2, "listing_id": "67890", "action": "demand_spike", "status": "rejected" },
      { "rec": 3, "listing_id": "12345", "action": "demand_spike", "status": "success" },
      { "rec": 4, "listing_id": "67890", "action": "base_price", "status": "rejected" },
      { "rec": 5, "listing_id": "11111", "action": "orphan_fill", "status": "failed", "error": "rate limit exceeded" }
    ]
  }
  ```

This provides a single audit trail entry for the entire batch operation, supplementing the individual per-recommendation execution logs.

---

## 9. Cancellation Fill Strategy Protocol (SCALE-03)

When new cancellations are detected, this protocol teaches the agent how to assess urgency, check date availability, formulate fill strategies, and track results for follow-up.

### Trigger

This protocol activates when:
- The `pricelabs_store_reservations` tool returns a `new_cancellations` array during daily health checks (Step 7 of the monitoring skill's Daily Health Check Protocol).
- The user asks about recent cancellations or requests a cancellation review.

### Step 1: Assess urgency

For each newly cancelled reservation, calculate the number of days from today until the freed check-in date. Classify urgency:

- **URGENT (< 7 days):** Very short booking window remaining. Any revenue is better than $0 at this lead time. Immediate action required.
- **HIGH (7-14 days):** Still bookable but time-sensitive. Moderate discounting appropriate. Act within this session.
- **MODERATE (14-30 days):** Normal fill window. Mild discounting or no action if demand is healthy for those dates. Monitor and reassess at next scan.
- **LOW (> 30 days):** Algorithm and organic demand will likely handle it. Note the cancellation for monitoring only. No DSO recommended.

Also assess:
- **Lost revenue:** The `rental_revenue` from the cancelled reservation indicates how much revenue was lost.
- **Orphan gap creation:** Check if the freed dates create a 1-3 night gap between adjacent bookings. If so, the orphan day protocol from Section 1 also applies.

### Step 2: Check date availability

CRITICAL: Before recommending a fill strategy, verify the freed dates are actually bookable.

1. Call `pricelabs_get_prices` for the freed date range (check-in to check-out of the cancelled reservation).
2. For each date, verify `unbookable != "1"`. If dates are now owner-blocked (host blocked them after cancellation for personal use), skip those dates entirely. Do not recommend fill pricing for owner-blocked dates.
3. Check for existing DSOs on the freed dates. If DSOs already exist, note them in the recommendation. Do not layer fill discounts on top of existing DSOs without explicitly noting the interaction and the resulting combined effect.

### Step 3: Formulate fill strategy by urgency

Based on the urgency assessment and date availability:

- **URGENT (< 7 days):** Recommend aggressive DSO of -25% to -30%. Present the expected nightly price after the discount. At this lead time, a deeply discounted booking recovers revenue that would otherwise be $0.
- **HIGH (7-14 days):** Recommend moderate DSO of -15% to -20%. Present the expected nightly price after the discount.
- **MODERATE (14-30 days):** Recommend mild DSO of -10% to -15%. OR recommend no action if `demand_color` for those dates shows healthy demand (red or orange). If demand is healthy, the dates may re-book at full price without intervention.
- **LOW (> 30 days):** No DSO recommended. Note the cancellation for the next weekly optimization report. The algorithm will adjust pricing based on organic demand signals.

### Step 4: Present recommendation

Format each cancellation fill recommendation as follows:

```
Cancellation detected: [listing name]
[guest info if available] cancelled [check-in] to [check-out] ($[revenue] lost).
Urgency: [URGENT/HIGH/MODERATE/LOW] -- [X] days until check-in.
Recommendation: [specific DSO with dates and percentage]
Expected price: $[price] per night (down from $[current])
```

For MODERATE and LOW urgency, the recommendation may be "Monitor -- no action needed" with an explanation of why (healthy demand, long lead time).

Follow the standard approval flow from Section 5 for any recommended changes. The user must explicitly approve fill strategy DSOs just like any other write operation.

### Step 5: Track for follow-up

If a fill strategy is approved and executed:

1. Call `pricelabs_record_change` to create a change tracking entry with the fill DSO details. This registers the change for 7/14/30 day revenue impact follow-up.
2. The 7-day follow-up is particularly important for cancellation fills: it reveals whether the freed dates re-booked after the discount was applied.
3. Include the cancellation context in the `before_json` (original reservation revenue, cancellation date) so the impact assessment can measure recovery rate.

### Integration with orphan day protocol

If the freed dates from a cancellation create an orphan gap (1-3 night gap between remaining bookings on either side), apply BOTH:
- The cancellation fill urgency assessment from this protocol (Step 3)
- The orphan day fill strategy from Section 1

Use the **more aggressive discount** of the two. For example, if the orphan day protocol recommends -20% but the cancellation urgency (URGENT, < 7 days) recommends -25% to -30%, use the cancellation urgency discount of -25% to -30%.

Present both rationales to the user: "This cancellation created a 1-night orphan gap. The orphan discount would be -20%, but the urgency (3 days until check-in) warrants a more aggressive -28% to maximize fill probability."
