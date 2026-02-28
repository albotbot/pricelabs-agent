# Phase 14: Permanent Cron Jobs - Research

**Researched:** 2026-02-28
**Domain:** OpenClaw cron job registration, agent targeting, channel delivery, prompt engineering for scheduled reports
**Confidence:** HIGH

## Summary

Phase 14 registers 4 permanent cron jobs that deliver daily health summaries and weekly optimization reports through the PriceLabs agent (Prism) to dedicated Slack and Telegram channels. This is a configuration-only phase with zero code changes -- all work happens in `openclaw/cron/jobs.json` (repo) and the live `~/.openclaw/cron/jobs.json` (deployed via CLI).

The existing `openclaw/cron/jobs.json` already contains 4 cron jobs from v1.1, but they have critical problems for the v1.2 target: (1) they lack an `agentId` field so they default to the main agent, (2) they deliver to the old generic channels (`${SLACK_HEALTH_CHANNEL}`, `${TELEGRAM_HEALTH_CHAT_ID}`) instead of the dedicated Phase 13 channels, (3) their prompts are bloated with multi-step protocols instead of the concise, scannable format the user specified in CONTEXT.md, and (4) they use the old schedule of 8 AM / 10 AM instead of the user-specified 7 AM / 8 AM. Phase 14 replaces these 4 jobs with 4 new jobs that target the pricelabs agent, deliver to the correct channels, and use refined prompts aligned with the user's vision.

**Primary recommendation:** Replace all 4 existing cron jobs in the repo `jobs.json` with new definitions that include `agentId: "pricelabs"`, updated delivery targets pointing to dedicated channels, simplified prompts, and corrected schedules (7 AM daily, 8 AM Monday). Then register them on the live system via `openclaw cron add` CLI with the `--agent pricelabs` flag.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Daily Health Summary
- Focus: Occupancy + pricing snapshot -- quick dashboard feel
- Red flags at the top: flag urgent issues first (0% occupancy next week, anomalous prices)
- Then one-line per listing with current occupancy, base price, and next-30-day gaps
- NOT booking pace, NOT market position (those are deeper analysis topics)

#### Weekly Optimization Report
- Focus: Pricing recommendations -- listings that need attention
- Rank by urgency: lead with the listing that needs the most attention, explain why
- Per-listing breakdown: 1-2 paragraphs per listing with specific pricing suggestions and reasoning
- NOT full portfolio performance trends (keep it actionable, not retrospective)

#### Delivery Schedule
- Daily health summary: **7:00 AM CST, every day** (including weekends -- STR bookings are 7/7)
- Weekly optimization report: **Monday 8:00 AM CST** (start the week with a plan)
- Timezone: CST (Central Standard Time)

#### Report Format & Length

**Daily Health Summary:**
- Short: 5-10 lines -- scannable morning dashboard
- Format: Table (listing | occ | price | flag)
- Red flags section above the table if any exist

**Weekly Optimization Report:**
- Medium: Per-listing written analysis (1-2 paragraphs each for listings needing attention)
- Format: Prose -- reads like a consultant's recommendation
- Only covers listings that need changes (not all 5 if some are fine)

**Common:**
- Prism signs off with diamond Prism signature on all reports (consistent branding)
- Reports use Prism's persona (sharp analyst, contextual framing, jargon with light context)

### Claude's Discretion
- Exact cron schedule syntax (crontab format for 7 AM CST / 8 AM Monday CST)
- Prompt wording for each cron job (what instruction to give Prism to produce the right report)
- How to handle API failures during cron execution (retry, skip, or error message to channel)
- Whether to use `--to` flag for Telegram delivery or binding-based routing

### Deferred Ideas (OUT OF SCOPE)
- Performance trends / STLY comparisons -- could be a separate weekly "performance review" in future
- Booking pace alerts -- more aligned with monitoring skill, not scheduled cron
- Monthly portfolio summary -- v2.0 scope (AUTO-03)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRON-01 | Daily health summary cron job registered targeting pricelabs agent via `--agent pricelabs` flag, delivering to dedicated Slack channel | Existing job pattern in `jobs.json` shows the exact JSON structure. Agent targeting uses `agentId` field or `--agent` CLI flag. Slack delivery uses `delivery.channel: "slack"` with `delivery.to` pointing to `#pricelabs` channel ID (C0AH8TSNNKH from Phase 13). |
| CRON-02 | Daily health summary cron job registered targeting pricelabs agent, delivering to dedicated Telegram bot | Same pattern as CRON-01 but with `delivery.channel: "telegram"`. Telegram requires explicit `delivery.to` with the chat ID for the Prism bot DM. Use `staggerMs: 30000` to avoid concurrent execution with the Slack version. |
| CRON-03 | Weekly optimization report cron job registered targeting pricelabs agent, delivering to dedicated Slack channel | Same delivery pattern as CRON-01, but schedule is `0 8 * * 1` (Monday 8 AM CST). Prompt must instruct Prism to produce per-listing prose analysis, not the full protocol-heavy format. |
| CRON-04 | Weekly optimization report cron job registered targeting pricelabs agent, delivering to dedicated Telegram bot | Same as CRON-03 but with Telegram delivery + 30s stagger. |
| CRON-05 | All 4 cron jobs persist across gateway restarts (permanent, not `--delete-after-run`) | The existing `jobs.json` entries have no `deleteAfterRun` field, meaning they persist by default. The CLI `openclaw cron add` creates permanent jobs unless `--delete-after-run` is explicitly passed. Persistence is the default behavior -- just avoid the flag. |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| OpenClaw `cron` CLI | v2026.1.6+ | Register, list, run, and manage cron jobs | Native OpenClaw cron management. `openclaw cron add --agent pricelabs` is the documented pattern for multi-agent cron targeting. |
| `openclaw/cron/jobs.json` | N/A (config) | Declarative cron job definitions tracked in repo | Existing pattern from v1.1. The repo file is the source of truth; live system `~/.openclaw/cron/jobs.json` is the deployed version. |
| `America/Chicago` timezone | IANA | CST/CDT timezone for schedule expressions | IANA timezone identifier used by OpenClaw's `schedule.tz` field. Handles DST transitions automatically (CST = UTC-6, CDT = UTC-5). |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `openclaw cron list` | Verify registered jobs show correct `agentId` | After each job registration, and as part of verification |
| `openclaw cron run <jobId>` | Manual trigger for testing delivery | During plan execution to verify each job delivers to correct channel |
| `openclaw cron runs --id <jobId>` | Check execution history and status | After manual runs and during first-week monitoring |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate Slack + Telegram jobs (4 total) | Single job with multi-channel delivery | OpenClaw cron `delivery` only supports one channel per job. Two jobs per report type is the only option. The `staggerMs` field offsets Telegram by 30s to avoid concurrent execution. |
| CLI-based registration (`openclaw cron add`) | Direct `jobs.json` file editing on live system | CLI validates schema and handles ID generation. Direct file editing risks malformed JSON. CLI is recommended by docs. |
| `bestEffort: true` delivery | `bestEffort: false` (strict) | With `bestEffort: true`, the cron job completes even if delivery fails (e.g., Telegram rate limit). With `false`, a delivery failure causes the job to error. Since reports are informational (not transactional), `bestEffort: true` is more resilient. |

## Architecture Patterns

### Recommended Job Structure

Each cron job follows this JSON schema (verified from existing `jobs.json`):

```json
{
  "name": "descriptive-job-name",
  "agentId": "pricelabs",
  "schedule": {
    "kind": "cron",
    "expr": "0 7 * * *",
    "tz": "America/Chicago",
    "staggerMs": 0
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "The prompt instructing Prism what to produce",
    "model": "opus",
    "thinking": "high"
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "C0AH8TSNNKH",
    "bestEffort": true
  }
}
```

### Pattern 1: Agent Targeting via `agentId` Field

**What:** Every cron job MUST include `"agentId": "pricelabs"` at the top level of the job definition.

**When to use:** Always, for every PriceLabs cron job.

**Why critical:** Without `agentId`, the gateway falls back to the default agent ("main"/Albot). The job runs under the wrong workspace (no Prism persona, no PriceLabs skills), producing generic output. This failure is **silent** -- the job runs, just incorrectly.

**Example:**
```json
{
  "name": "daily-health-slack",
  "agentId": "pricelabs",
  ...
}
```

### Pattern 2: Staggered Dual-Channel Delivery

**What:** Each report type (daily health, weekly optimization) requires two jobs -- one for Slack, one for Telegram. The Telegram job uses `staggerMs: 30000` to offset execution by 30 seconds.

**When to use:** Always, for every report that delivers to both channels.

**Why:** OpenClaw cron `delivery` supports only one channel per job. The stagger prevents the same agent from running two concurrent sessions that both call PriceLabs API, which could cause rate limit issues or MCP server contention (single stdio pipe).

**Example:**
```json
// Slack job
{ "schedule": { "staggerMs": 0 }, "delivery": { "channel": "slack", "to": "C0AH8TSNNKH" } }

// Telegram job (same schedule, 30s later)
{ "schedule": { "staggerMs": 30000 }, "delivery": { "channel": "telegram", "to": "${TELEGRAM_PRISM_CHAT_ID}" } }
```

### Pattern 3: Isolated Sessions for Cron

**What:** All cron jobs use `"sessionTarget": "isolated"` for clean, independent sessions.

**When to use:** Always for scheduled reports.

**Why:** Isolated sessions give each run a fresh context window. No carry-over from previous runs, no pollution of interactive sessions. Each health check or optimization report starts clean with workspace brain files and skills loaded.

### Pattern 4: Simplified, Outcome-Focused Prompts

**What:** Cron job prompts should describe the desired OUTPUT format, not enumerate every protocol step. The agent has skills that contain the step-by-step protocols.

**When to use:** For all v1.2 cron prompts (replacing the verbose v1.1 prompts).

**Why:** The existing v1.1 prompts are 800+ characters of step-by-step instructions embedded in the cron job message. This wastes tokens on instructions the agent already has in its skills. The v1.2 approach: tell Prism WHAT to produce (format, length, focus), not HOW to produce it (the skills handle that).

**Example (daily health):**
```
Produce the daily health summary. Follow the monitoring-protocols skill.

Format the output as a scannable morning dashboard (5-10 lines):
1. Red flags first (if any): 0% occupancy next week, anomalous prices, stale syncs
2. Then a table: listing | occupancy (30d) | base price | flags
3. Sign off with the Prism signature

Keep it short and glanceable. This is a dashboard, not a document.
```

### Anti-Patterns to Avoid

- **Embedding full protocols in cron prompts:** The v1.1 prompts contain 800+ chars of step-by-step instructions. Prism has skills for this. Tell Prism the output format; let the skills guide the execution.
- **Omitting `agentId`:** Silent failure -- job runs under wrong agent. Always include `"agentId": "pricelabs"`.
- **Using `--delete-after-run`:** Creates one-shot jobs that disappear after first execution. Phase 14 requires permanent jobs. Never use this flag.
- **Same `staggerMs` for paired jobs:** Both Slack and Telegram jobs firing simultaneously causes MCP server contention. Always stagger Telegram by 30s.
- **Using `delivery.to` with environment variable for Slack:** The Slack channel ID (C0AH8TSNNKH) is a fixed value discovered in Phase 13. Hardcode it in the repo `jobs.json`, not as an env variable that could be misconfigured.
- **Forgetting `bestEffort: true`:** Without it, a transient Telegram API error causes the entire cron job to fail. Reports are informational -- delivery failures should not block execution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom `setInterval` or OS crontab | OpenClaw `cron` system | OpenClaw cron handles timezone conversion, stagger, agent targeting, delivery, and persistence. OS crontab cannot target OpenClaw agents. |
| Dual-channel delivery | Custom script that posts to both Slack and Telegram | Two separate cron jobs (one per channel) | OpenClaw delivery supports one channel per job. Two jobs with stagger is the documented pattern. |
| Report formatting | Hardcoded report templates in the prompt | Prism's persona (SOUL.md) + skills | The persona and skills already define how Prism formats reports. The cron prompt just needs to specify the desired output shape. |
| Timezone handling | Manual UTC offset calculation | `schedule.tz: "America/Chicago"` | IANA timezone handles DST automatically. Manual UTC offsets break twice per year. |

**Key insight:** Phase 14 is deceptively simple -- it's 4 JSON objects and 4 CLI commands. The complexity is in getting the details right: `agentId`, delivery targets, prompt wording, and schedule syntax. Every field matters; there are no optional fields in this context.

## Common Pitfalls

### Pitfall 1: Missing `agentId` Field (CRITICAL)

**What goes wrong:** Cron jobs run under the default agent (Albot) instead of Prism. Reports are generic, use the wrong persona, and have no PriceLabs domain knowledge.

**Why it happens:** `agentId` is optional in the OpenClaw cron schema. If omitted, the gateway silently falls back to the default agent. The job appears to run successfully -- no error, no warning. Only the output reveals the problem.

**How to avoid:** Always include `"agentId": "pricelabs"` in every job definition. After registration, run `openclaw cron list` and verify each job shows `agentId: "pricelabs"`.

**Warning signs:** Reports arrive in the right channel but use Albot's personality, don't reference PriceLabs data, or contain generic advice instead of specific listing analysis.

### Pitfall 2: Wrong Delivery Target (Delivers to Main Agent Channels)

**What goes wrong:** Reports arrive in the main agent's Slack channels or Telegram bot instead of the dedicated `#pricelabs` channel and Prism Telegram bot.

**Why it happens:** The v1.1 jobs deliver to `${SLACK_HEALTH_CHANNEL}` and `${TELEGRAM_HEALTH_CHAT_ID}`, which point to the main agent's channels. The v1.2 jobs must use the Phase 13 channel IDs: Slack `C0AH8TSNNKH` (#pricelabs) and the Prism bot's Telegram chat ID.

**How to avoid:** Use the exact channel IDs from Phase 13 in `delivery.to`. For Slack, use the hardcoded channel ID `C0AH8TSNNKH`. For Telegram, use the Prism bot's DM chat ID (needs to be discovered from the live system -- this is the chat ID between the user and @Prism_Price_Bot).

**Warning signs:** Reports appear in the wrong Slack channel or wrong Telegram bot conversation.

### Pitfall 3: Cron Schedule Timezone Confusion

**What goes wrong:** Reports arrive at the wrong time because the schedule uses UTC instead of CST, or because DST transition shifts the delivery time.

**Why it happens:** Cron expressions without `tz` field default to the gateway's local timezone (which may or may not be CST). During DST transitions (March/November), CST (UTC-6) shifts to CDT (UTC-5), changing the effective UTC time.

**How to avoid:** Always set `"tz": "America/Chicago"` in the schedule. This IANA timezone identifier automatically handles CST/CDT transitions. Never use a raw UTC offset.

**Warning signs:** Reports arrive one hour early or late after DST transition.

### Pitfall 4: Existing v1.1 Jobs Not Cleaned Up

**What goes wrong:** After creating the 4 new v1.2 jobs, the 4 old v1.1 jobs remain registered. The system runs 8 cron jobs -- 4 old (targeting main agent, wrong channels) and 4 new (targeting pricelabs agent, correct channels). Users receive duplicate or conflicting reports.

**Why it happens:** `openclaw cron add` does not replace existing jobs with the same name. It creates new entries. The old jobs must be explicitly removed.

**How to avoid:** Before adding new jobs, list existing jobs with `openclaw cron list`, identify old v1.1 PriceLabs jobs, and remove them with `openclaw cron remove <jobId>`. Then add the new v1.2 jobs.

**Warning signs:** `openclaw cron list` shows more than 4 PriceLabs-related jobs. Duplicate reports arrive on different channels.

### Pitfall 5: Telegram Delivery Requires Explicit Chat ID

**What goes wrong:** The Telegram cron job fails with "cron delivery target is missing" because no `delivery.to` was specified, or the chat ID is wrong.

**Why it happens:** Unlike Slack (which can auto-resolve channel names), Telegram requires an explicit numeric chat ID in `delivery.to`. This chat ID is the conversation between the user and @Prism_Price_Bot. It must be discovered from the live system (e.g., from gateway logs after the user sends `/start` to the bot).

**How to avoid:** Before registering Telegram cron jobs, verify the Prism bot's DM chat ID from the live system. The chat ID for a private DM is typically the user's Telegram numeric ID. Check gateway logs or use `openclaw channels resolve` to find it.

**Warning signs:** Telegram cron job status shows "error" with "delivery target is missing" message.

### Pitfall 6: OpenClaw Cron Skip Bug #17852

**What goes wrong:** Scheduled cron jobs silently skip execution. The job is registered and enabled, but some runs do not fire.

**Why it happens:** Known OpenClaw bug #17852 (tracked in STATE.md accumulated TODOs). The root cause is not publicly documented, but it manifests as occasional skipped runs.

**How to avoid:** Monitor cron runs for the first week after registration using `openclaw cron runs --id <jobId> --limit 10`. If skips are detected, the current workaround is to restart the gateway. This is a known issue, not a configuration error.

**Warning signs:** Expected daily report does not arrive. `openclaw cron runs` shows gaps in execution history.

## Code Examples

### Complete Daily Health Summary Job (Slack)

```json
{
  "name": "daily-health-slack",
  "agentId": "pricelabs",
  "schedule": {
    "kind": "cron",
    "expr": "0 7 * * *",
    "tz": "America/Chicago",
    "staggerMs": 0
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "<DAILY_HEALTH_PROMPT>",
    "model": "opus",
    "thinking": "high"
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "C0AH8TSNNKH",
    "bestEffort": true
  }
}
```

### Complete Daily Health Summary Job (Telegram)

```json
{
  "name": "daily-health-telegram",
  "agentId": "pricelabs",
  "schedule": {
    "kind": "cron",
    "expr": "0 7 * * *",
    "tz": "America/Chicago",
    "staggerMs": 30000
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "<DAILY_HEALTH_PROMPT>",
    "model": "opus",
    "thinking": "high"
  },
  "delivery": {
    "mode": "announce",
    "channel": "telegram",
    "to": "${TELEGRAM_PRISM_CHAT_ID}",
    "bestEffort": true
  }
}
```

### Complete Weekly Optimization Job (Slack)

```json
{
  "name": "weekly-optimization-slack",
  "agentId": "pricelabs",
  "schedule": {
    "kind": "cron",
    "expr": "0 8 * * 1",
    "tz": "America/Chicago",
    "staggerMs": 0
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "<WEEKLY_OPTIMIZATION_PROMPT>",
    "model": "opus",
    "thinking": "high"
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "C0AH8TSNNKH",
    "bestEffort": true
  }
}
```

### Recommended Prompt: Daily Health Summary

The prompt should be outcome-focused, not process-focused. Prism already has the monitoring-protocols skill with the step-by-step procedure.

```
Produce the daily portfolio health summary. Follow your monitoring-protocols skill for data gathering.

Output format -- scannable morning dashboard (5-10 lines total):

1. RED FLAGS (if any): Lead with urgent issues -- 0% occupancy in the next 7 days, anomalous prices (>20% deviation from recommended base), stale syncs (>48h since last push). If no red flags, skip this section entirely.

2. PORTFOLIO TABLE:
Listing | Occ (30d) | Base Price | Flag
Each listing gets one row. Flag column: blank if healthy, short note if attention needed (e.g., "low occ", "stale sync", "price drift").

3. Sign off with your signature.

This is a dashboard glance, not a document. Keep it tight.
```

### Recommended Prompt: Weekly Optimization Report

```
Produce the weekly pricing optimization report. Follow your analysis-playbook and optimization-playbook skills for data gathering and analysis.

Output format -- consultant's recommendation memo:

1. ONE-LINE SUMMARY: How the portfolio looks this week in one sentence.

2. LISTINGS NEEDING ATTENTION (ranked by urgency):
For each listing that needs a pricing change, write 1-2 paragraphs covering:
- What is happening (the metric that triggered attention)
- Why it matters (revenue impact, market context)
- What you recommend (specific pricing action with numbers)
- Skip listings that are performing well -- only cover those needing changes.

3. If no listings need attention, say so briefly and highlight the strongest performer.

4. Sign off with your signature.

Focus on actionable recommendations, not retrospective trends. This should read like a revenue manager's Monday briefing.
```

### CLI Registration Commands

```bash
# Step 1: Remove old v1.1 jobs (list first, then remove by ID)
openclaw cron list
openclaw cron remove <old-daily-health-slack-id>
openclaw cron remove <old-daily-health-telegram-id>
openclaw cron remove <old-weekly-optimization-slack-id>
openclaw cron remove <old-weekly-optimization-telegram-id>

# Step 2: Register new v1.2 jobs
# Daily health -- Slack
openclaw cron add \
  --name "daily-health-slack" \
  --cron "0 7 * * *" \
  --tz "America/Chicago" \
  --session isolated \
  --message "<prompt text>" \
  --model opus \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "C0AH8TSNNKH"

# Daily health -- Telegram (30s stagger)
openclaw cron add \
  --name "daily-health-telegram" \
  --cron "0 7 * * *" \
  --tz "America/Chicago" \
  --stagger 30s \
  --session isolated \
  --message "<prompt text>" \
  --model opus \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel telegram \
  --to "${TELEGRAM_PRISM_CHAT_ID}"

# Weekly optimization -- Slack
openclaw cron add \
  --name "weekly-optimization-slack" \
  --cron "0 8 * * 1" \
  --tz "America/Chicago" \
  --session isolated \
  --message "<prompt text>" \
  --model opus \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "C0AH8TSNNKH"

# Weekly optimization -- Telegram (30s stagger)
openclaw cron add \
  --name "weekly-optimization-telegram" \
  --cron "0 8 * * 1" \
  --tz "America/Chicago" \
  --stagger 30s \
  --session isolated \
  --message "<prompt text>" \
  --model opus \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel telegram \
  --to "${TELEGRAM_PRISM_CHAT_ID}"

# Step 3: Verify
openclaw cron list  # All 4 jobs show agentId: "pricelabs"

# Step 4: Manual test run
openclaw cron run <daily-health-slack-id>
# Verify output arrives in #pricelabs Slack channel with Prism persona
```

## Cron Schedule Details

| Report | Schedule (cron expr) | Timezone | Effective UTC (CST) | Effective UTC (CDT) |
|--------|---------------------|----------|---------------------|---------------------|
| Daily Health | `0 7 * * *` | America/Chicago | 13:00 UTC (Nov-Mar) | 12:00 UTC (Mar-Nov) |
| Weekly Optimization | `0 8 * * 1` | America/Chicago | 14:00 UTC Mon (Nov-Mar) | 13:00 UTC Mon (Mar-Nov) |

The `tz: "America/Chicago"` field handles DST transitions automatically. The report always arrives at 7 AM or 8 AM local time regardless of the time of year.

## Existing Job Analysis (What Changes)

### Current v1.1 Jobs (`openclaw/cron/jobs.json`)

| # | Name | Schedule | agentId | Delivery Slack | Delivery Telegram |
|---|------|----------|---------|----------------|-------------------|
| 1 | daily-portfolio-health-slack | `0 8 * * *` | (none -- defaults to main) | `${SLACK_HEALTH_CHANNEL}` | -- |
| 2 | daily-portfolio-health-telegram | `0 8 * * *` +30s | (none -- defaults to main) | -- | `${TELEGRAM_HEALTH_CHAT_ID}` |
| 3 | weekly-optimization-report-slack | `0 10 * * 1` | (none -- defaults to main) | `${SLACK_HEALTH_CHANNEL}` | -- |
| 4 | weekly-optimization-report-telegram | `0 10 * * 1` +30s | (none -- defaults to main) | -- | `${TELEGRAM_HEALTH_CHAT_ID}` |

### New v1.2 Jobs (Phase 14 Target)

| # | Name | Schedule | agentId | Delivery Slack | Delivery Telegram |
|---|------|----------|---------|----------------|-------------------|
| 1 | daily-health-slack | `0 7 * * *` | `pricelabs` | `C0AH8TSNNKH` | -- |
| 2 | daily-health-telegram | `0 7 * * *` +30s | `pricelabs` | -- | Prism bot chat ID |
| 3 | weekly-optimization-slack | `0 8 * * 1` | `pricelabs` | `C0AH8TSNNKH` | -- |
| 4 | weekly-optimization-telegram | `0 8 * * 1` +30s | `pricelabs` | -- | Prism bot chat ID |

### Changes Summary

| Field | v1.1 Value | v1.2 Value | Why Changed |
|-------|-----------|-----------|-------------|
| `agentId` | (absent) | `"pricelabs"` | Target Prism agent, not main/Albot |
| `name` | Verbose (`daily-portfolio-health-slack`) | Shorter (`daily-health-slack`) | Cleaner naming |
| `schedule.expr` (daily) | `0 8 * * *` | `0 7 * * *` | User requested 7 AM CST |
| `schedule.expr` (weekly) | `0 10 * * 1` | `0 8 * * 1` | User requested Monday 8 AM CST |
| `delivery.to` (Slack) | `${SLACK_HEALTH_CHANNEL}` | `C0AH8TSNNKH` | Dedicated #pricelabs channel from Phase 13 |
| `delivery.to` (Telegram) | `${TELEGRAM_HEALTH_CHAT_ID}` | Prism bot chat ID | Dedicated Prism bot from Phase 13 |
| `payload.message` | 800+ char step-by-step protocol | ~400 char outcome-focused prompt | Agent has skills; prompt specifies output format |

## Telegram Chat ID Discovery

The Prism Telegram bot's DM chat ID is needed for `delivery.to` in the Telegram cron jobs. This must be discovered from the live system because it depends on the user-bot DM conversation that was established in Phase 13.

**Discovery methods (in order of preference):**
1. Check gateway logs after Phase 13 Telegram verification -- the chat ID appears in routing logs when the user messaged @Prism_Price_Bot
2. Use `openclaw channels resolve --channel telegram --kind dm` if available
3. For private DMs, the chat ID is typically equal to the user's Telegram numeric ID (the same ID used in Phase 13 pairing)
4. Send a test message to @Prism_Price_Bot and check `openclaw sessions list --agent pricelabs` for the Telegram session key, which contains the chat ID

**Recommendation:** Use the user's Telegram numeric ID as the `delivery.to` value. This was used during Phase 13 pairing (`openclaw pairing approve telegram FVBMN6HB`). If this does not work for cron delivery, escalate to manual discovery via gateway logs.

## API Failure Handling (Claude's Discretion)

**Recommendation: bestEffort with implicit retry.**

- Set `"bestEffort": true` on all jobs. This means the cron job completes its agent turn even if delivery to the channel fails.
- The agent's skills already handle API failures gracefully -- if `pricelabs_get_listings` returns an error, the monitoring-protocols skill instructs Prism to report the API issue as a CRITICAL alert rather than silently failing.
- If the PriceLabs API is down, Prism will produce a health report that says "API connectivity issue -- unable to fetch fresh data. Using last stored snapshot from [date]."
- No explicit retry mechanism is needed at the cron level. The next day's run will naturally retry. For critical outages, the user can manually trigger `openclaw cron run <jobId>`.

## Telegram Delivery Method (Claude's Discretion)

**Recommendation: Use explicit `--to` flag (not binding-based routing).**

Cron delivery to Telegram requires explicit targeting because:
1. Binding-based routing only works for inbound messages (user -> agent). Cron delivery is outbound (agent -> user).
2. The `delivery.to` field with the Telegram chat ID is the documented pattern for cron Telegram delivery.
3. The existing v1.1 jobs already use `delivery.to` for Telegram.
4. Using `--to` with the Prism bot's chat ID ensures delivery goes through the correct bot account, maintaining identity separation.

## State of the Art

| Old Approach (v1.1) | Current Approach (v1.2) | When Changed | Impact |
|---------------------|------------------------|--------------|--------|
| No `agentId` on cron jobs (default to main) | Explicit `agentId: "pricelabs"` | v1.2 Phase 14 | Jobs run under correct agent with correct persona and tools |
| Verbose prompts with full protocol in message | Outcome-focused prompts referencing skills | v1.2 Phase 14 | Shorter prompts, less token waste, more consistent output format |
| Generic channel targets via env vars | Hardcoded dedicated channel IDs from Phase 13 | v1.2 Phase 14 | Reports arrive in dedicated channels, not shared main agent channels |
| 8 AM / 10 AM schedule | 7 AM / 8 AM Monday schedule | v1.2 Phase 14 | User-specified delivery times |

## Open Questions

1. **Telegram Prism Bot Chat ID**
   - What we know: The user paired with @Prism_Price_Bot in Phase 13 (pairing code FVBMN6HB). The chat exists.
   - What's unclear: The exact numeric chat ID for the `delivery.to` field. It is likely the user's Telegram ID (same as pairing), but this must be confirmed on the live system.
   - Recommendation: Discover during plan execution by checking `openclaw sessions list --agent pricelabs` or gateway logs. Mark the Telegram cron job registration as a checkpoint requiring this discovery.

2. **Existing Live Cron Jobs**
   - What we know: The repo `openclaw/cron/jobs.json` has 4 v1.1 jobs. The live system at `~/.openclaw/cron/jobs.json` may have additional or different jobs from manual testing.
   - What's unclear: Whether the live system has the same 4 jobs or different/additional ones.
   - Recommendation: First step in execution should be `openclaw cron list` to audit the live state. Remove all PriceLabs-related jobs before adding new ones.

3. **Cron Skip Bug #17852 Impact**
   - What we know: Known OpenClaw bug that causes occasional skipped cron runs. Tracked in STATE.md.
   - What's unclear: Whether this bug has been fixed in the current gateway version, and whether it affects newly created jobs differently than existing ones.
   - Recommendation: Monitor cron runs for the first week after Phase 14 deployment. Not a Phase 14 blocker -- the bug is pre-existing and affects all cron jobs equally.

## Sources

### Primary (HIGH confidence)
- Existing `openclaw/cron/jobs.json` -- verified JSON schema and field structure for all 4 existing jobs
- Phase 13 summaries (`13-01-SUMMARY.md`, `13-02-SUMMARY.md`) -- confirmed Slack channel ID C0AH8TSNNKH and Telegram binding configuration
- Workspace brain files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`) -- confirmed Prism persona and signature format
- Workspace skills (`monitoring-protocols/SKILL.md`, `analysis-playbook/SKILL.md`) -- confirmed protocol content that cron prompts can reference
- Architecture research (`ARCHITECTURE.md`) -- section 6 "Cron Jobs: Agent Binding" with verified patterns
- Stack research (`STACK.md`) -- section "Cron Job Configuration" with CLI flag reference
- Pitfalls research (`PITFALLS.md`) -- Pitfall 5 "Cron Jobs Target Wrong Agent" with detailed prevention strategy

### Secondary (MEDIUM confidence)
- OpenClaw cron docs reference at `/home/NGA/openclaw/docs/automation/cron-jobs.md` -- cited in architecture/stack/pitfalls research. Not re-read directly this session but findings are consistent with verified behavior in `jobs.json`.
- OpenClaw CLI docs at `/home/NGA/openclaw/docs/cli/cron.md` -- CLI flags (`--agent`, `--announce`, `--stagger`, `--session`) cited in stack research.

### Tertiary (LOW confidence)
- Telegram chat ID discovery -- the exact method and value need to be confirmed on the live system during execution. The recommendation to use the user's Telegram numeric ID is based on standard Telegram API behavior, not verified against OpenClaw-specific cron delivery.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- OpenClaw cron system is well-documented and verified against existing jobs.json
- Architecture: HIGH -- Existing v1.1 jobs provide exact JSON schema patterns; v1.2 changes are incremental
- Pitfalls: HIGH -- All pitfalls sourced from actual v1.1 experience and documented in project PITFALLS.md
- Prompt design: MEDIUM -- Prompts are Claude's discretion per CONTEXT.md; recommendations based on persona analysis and user-specified output format

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable -- OpenClaw cron API unlikely to change)
