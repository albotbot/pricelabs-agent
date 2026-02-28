# Phase 14: Permanent Cron Jobs - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Register 4 permanent cron jobs that deliver daily health summaries and weekly optimization reports to Prism's dedicated Telegram and Slack channels. All jobs target the pricelabs agent (not main), use the correct `--agent pricelabs` flag, and persist across gateway restarts.

</domain>

<decisions>
## Implementation Decisions

### Report Content

#### Daily Health Summary
- Focus: Occupancy + pricing snapshot — quick dashboard feel
- Red flags at the top: flag urgent issues first (0% occupancy next week, anomalous prices)
- Then one-line per listing with current occupancy, base price, and next-30-day gaps
- NOT booking pace, NOT market position (those are deeper analysis topics)

#### Weekly Optimization Report
- Focus: Pricing recommendations — listings that need attention
- Rank by urgency: lead with the listing that needs the most attention, explain why
- Per-listing breakdown: 1-2 paragraphs per listing with specific pricing suggestions and reasoning
- NOT full portfolio performance trends (keep it actionable, not retrospective)

### Delivery Schedule
- Daily health summary: **7:00 AM CST, every day** (including weekends — STR bookings are 7/7)
- Weekly optimization report: **Monday 8:00 AM CST** (start the week with a plan)
- Timezone: CST (Central Standard Time)

### Report Format & Length

#### Daily Health Summary
- **Short**: 5-10 lines — scannable morning dashboard
- **Format**: Table (listing | occ | price | flag)
- Red flags section above the table if any exist

#### Weekly Optimization Report
- **Medium**: Per-listing written analysis (1-2 paragraphs each for listings needing attention)
- **Format**: Prose — reads like a consultant's recommendation
- Only covers listings that need changes (not all 5 if some are fine)

#### Common
- Prism signs off with ◆ Prism signature on all reports (consistent branding)
- Reports use Prism's persona (sharp analyst, contextual framing, jargon with light context)

### Claude's Discretion
- Exact cron schedule syntax (crontab format for 7 AM CST / 8 AM Monday CST)
- Prompt wording for each cron job (what instruction to give Prism to produce the right report)
- How to handle API failures during cron execution (retry, skip, or error message to channel)
- Whether to use `--to` flag for Telegram delivery or binding-based routing

</decisions>

<specifics>
## Specific Ideas

- Daily report should feel like checking a dashboard — glance and go, not a document to read
- Weekly report should feel like getting a recommendation from a revenue manager — "here's what I'd change and why"
- Both should reference real listing names and real numbers, not generic advice

</specifics>

<deferred>
## Deferred Ideas

- Performance trends / STLY comparisons — could be a separate weekly "performance review" in future
- Booking pace alerts — more aligned with monitoring skill, not scheduled cron
- Monthly portfolio summary — v2.0 scope (AUTO-03)

</deferred>

---

*Phase: 14-permanent-cron-jobs*
*Context gathered: 2026-02-28*
