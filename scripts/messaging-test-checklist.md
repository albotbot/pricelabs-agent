# Messaging Integration Test Checklist

Date: ___
Tester: ___
OpenClaw Version: ___
Agent Model: anthropic/claude-opus-4-6

## Prerequisites

- [ ] OpenClaw is running with PriceLabs agent configured
- [ ] PRICELABS_API_KEY is set (real key for live data)
- [ ] PRICELABS_WRITES_ENABLED=false (safety check)
- [ ] Slack bot is online in workspace
- [ ] Telegram bot is responding to /start

## Environment Variables Confirmed

- [ ] SLACK_APP_TOKEN set
- [ ] SLACK_BOT_TOKEN set
- [ ] TELEGRAM_BOT_TOKEN set
- [ ] SLACK_HEALTH_CHANNEL set
- [ ] TELEGRAM_HEALTH_CHAT_ID set

---

## Section A: Slack Question-Answer Tests (MSG-02)

| # | Test | Message to Send | Expected Behavior | Pass/Fail | Notes |
|---|------|-----------------|-------------------|-----------|-------|
| A1 | Portfolio overview | "How is my portfolio doing?" | Agent calls pricelabs_get_listings + pricelabs_get_snapshots, responds with listing count, occupancy rates, revenue figures. Response contains real numbers, not placeholders. | | |
| A2 | Specific listing data | "What are my prices for [listing name] next week?" | Agent calls pricelabs_get_prices for the specific listing, responds with actual nightly prices for the next 7 days. Response includes dollar amounts and dates. | | |
| A3 | Recommendations | "Any recommendations?" | Agent calls pricelabs_detect_underperformers or pricelabs_get_portfolio_kpis, responds with actionable insights. Response references specific listings by name. | | |

**Section A Notes:**
- Replace `[listing name]` in A2 with an actual listing name from your portfolio
- Allow up to 30 seconds for agent response (MCP tool calls take time)
- Verify responses contain real data (actual dollar amounts, percentages, listing names) not template placeholders

---

## Section B: Telegram Question-Answer Tests (MSG-05)

| # | Test | Message to Send | Expected Behavior | Pass/Fail | Notes |
|---|------|-----------------|-------------------|-----------|-------|
| B1 | Portfolio overview | "How is my portfolio doing?" | Agent calls pricelabs_get_listings + pricelabs_get_snapshots, responds with listing count, occupancy rates, revenue figures. Response contains real numbers, not placeholders. | | |
| B2 | Specific listing data | "What are my prices for [listing name] next week?" | Agent calls pricelabs_get_prices for the specific listing, responds with actual nightly prices for the next 7 days. Response includes dollar amounts and dates. | | |
| B3 | Recommendations | "Any recommendations?" | Agent calls pricelabs_detect_underperformers or pricelabs_get_portfolio_kpis, responds with actionable insights. Response references specific listings by name. | | |

**Section B Notes:**
- Use the same listing name as Section A test A2 for consistency
- Telegram responses may have slightly different formatting than Slack but data should match
- Allow up to 30 seconds for agent response

---

## Section C: Approval Flow Test (MSG-03)

| # | Test | Steps | Expected Behavior | Pass/Fail | Notes |
|---|------|-------|-------------------|-----------|-------|
| C1 | Slack approval dry-run | 1. Ask agent "Any recommendations?" in Slack 2. When agent presents a recommendation, reply "approve" in thread | Agent acknowledges the approval intent but confirms writes are disabled (PRICELABS_WRITES_ENABLED=false). Does NOT execute any pricing change. Response mentions safety/writes-disabled. | | |
| C2 | Slack rejection dry-run | Reply "reject" to a recommendation thread in Slack | Agent acknowledges rejection, no action taken. | | |

**Section C Notes:**
- C1 depends on the agent first presenting a recommendation (may reuse A3 thread)
- Verify the agent explicitly mentions that writes are disabled or that PRICELABS_WRITES_ENABLED is false
- The agent must NOT attempt any pricing change -- this is a safety-critical test

---

## Section D: Cross-Channel Consistency

| # | Test | Steps | Expected Behavior | Pass/Fail | Notes |
|---|------|-------|-------------------|-----------|-------|
| D1 | Same question both channels | Ask "How is my portfolio doing?" in both Slack and Telegram (can reuse A1 and B1 results) | Both responses contain similar data (same listing count, similar metrics). Format may differ slightly but data should be consistent. | | |

**Section D Notes:**
- Compare the responses from A1 and B1 side-by-side
- Listing count should be identical; occupancy and revenue figures should be very close (same data source)
- Minor formatting differences between Slack and Telegram are acceptable

---

## Section E: Health Summary Delivery (MSG-01, MSG-04)

| # | Test | Steps | Expected Behavior | Pass/Fail | Notes |
|---|------|-------|-------------------|-----------|-------|
| E1 | Slack health summary received | Trigger daily health check cron manually (or wait for 8am CT scheduled run) and observe Slack channel | A formatted health summary arrives in the configured Slack channel. Summary contains: portfolio listing count, sync status, occupancy rate, revenue figure, and severity-tiered alerts (Critical/Warnings/Opportunities). | | |
| E2 | Telegram health summary received | Trigger daily health check cron manually (or wait for 8am CT scheduled run, noting 30s stagger) and observe Telegram chat | A formatted health summary arrives in the configured Telegram chat. Summary contains the same data points as E1: listing count, sync status, occupancy, revenue, severity tiers. | | |

**Section E Notes:**
- Cron schedule: 8am CT (America/Chicago) daily, Telegram fires 30 seconds after Slack
- If testing outside cron schedule, trigger manually via OpenClaw cron API or restart with immediate trigger
- Health summary should contain structured sections: portfolio stats, sync status, occupancy, revenue, and severity-tiered alerts
- Both channels should receive summaries with the same data points

---

## Results Summary

Total tests: 11
Passed: ___/11
Failed: ___/11

## Requirements Coverage

- MSG-01 (Slack Health Summary): Test E1 -- PASS/FAIL
- MSG-02 (Slack Q&A): Tests A1, A2, A3 -- PASS/FAIL
- MSG-03 (Slack Approval): Tests C1, C2 -- PASS/FAIL
- MSG-04 (Telegram Health Summary): Test E2 -- PASS/FAIL
- MSG-05 (Telegram Q&A): Tests B1, B2, B3 -- PASS/FAIL

## Bugs Found (SAFE-03)

(List any bugs discovered during testing, with fix commit hashes)
- None / [description + commit]

---
*Checklist created: 2026-02-26*
*Phase: 10-messaging-integration, Plan: 02*
