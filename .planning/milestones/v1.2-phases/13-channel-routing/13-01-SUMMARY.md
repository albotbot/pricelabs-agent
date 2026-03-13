---
phase: 13-channel-routing
plan: 01
subsystem: infra
tags: [telegram, multi-account, openclaw, bindings, channel-routing]

# Dependency graph
requires:
  - phase: 12-agent-registration
    provides: "pricelabs agent registered in openclaw.json with id, workspace, sandbox, and tools"
provides:
  - "Telegram multi-account config with accounts.default (AlBot) and accounts.pricelabs (Prism)"
  - "bindings[] array in openclaw.json with Telegram accountId routing"
  - "@Prism_Price_Bot connected and routing to pricelabs agent"
affects: [13-02-PLAN, 14-permanent-cron-jobs, 15-end-to-end-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [telegram-multi-account, accountId-binding-routing, two-phase-migration]

key-files:
  created: []
  modified:
    - "~/.openclaw/openclaw.json"

key-decisions:
  - "Two-phase migration: restructure existing bot to multi-account first, verify, then add Prism bot"
  - "dmPolicy set explicitly per-account (not relying on top-level inheritance) for safety"
  - "Kept per-channel-peer dmScope unchanged -- binding already isolates agents"

patterns-established:
  - "Telegram multi-account: base settings at channels.telegram level, per-bot config in accounts.<name>"
  - "Bindings array: top-level bindings[] with agentId + match.channel + match.accountId for Telegram routing"
  - "Migration pattern: backup -> restructure -> restart -> verify -> add new -> restart -> verify"

requirements-completed: [CHAN-01, CHAN-02, CHAN-03]

# Metrics
duration: 57min
completed: 2026-02-28
---

# Phase 13 Plan 01: Telegram Multi-Account Migration Summary

**Telegram migrated from flat single-bot config to multi-account format with two bots: AlBot (default) and Prism (@Prism_Price_Bot) with accountId-based routing binding**

## Performance

- **Duration:** ~57 min (includes 2x 30-second rate limit cooldowns and human verification)
- **Started:** 2026-02-28T03:36:29Z
- **Completed:** 2026-02-28T04:33:59Z
- **Tasks:** 3
- **Files modified:** 1 (live system config)

## Accomplishments
- Migrated Telegram from flat `botToken` format to multi-account `accounts` structure without any AlBot disruption
- Connected @Prism_Price_Bot as second Telegram account with `dmPolicy: "pairing"`
- Added `bindings[]` top-level array to openclaw.json with Telegram accountId routing
- Human-verified both bots route to correct agents (Prism persona on @Prism_Price_Bot, AlBot on @NGA_AlBot)

## Task Commits

Live system configuration changes (no repo files modified):

1. **Task 1: Migrate Telegram to multi-account format (Phase A)** - (live system)
   - Backed up openclaw.json
   - Restructured `channels.telegram` from flat to multi-account with `accounts.default`
   - Restarted gateway, verified AlBot still connected and working

2. **Task 2: Add Prism bot and Telegram binding (Phase B)** - (live system)
   - Backed up migrated config
   - Added `accounts.pricelabs` with Prism bot token
   - Added `bindings[]` array with Telegram accountId binding
   - Restarted gateway, verified both bots connected

3. **Task 3: Verify Telegram routing** - (checkpoint: human-verify)
   - User verified @Prism_Price_Bot responds with Prism persona
   - User verified @NGA_AlBot continues responding as AlBot
   - Pairing approval completed for new bot (`openclaw pairing approve telegram FVBMN6HB`)

**Plan metadata:** (commit below with SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified
- `~/.openclaw/openclaw.json` - Telegram multi-account config + bindings array
- `~/.openclaw/openclaw.json.bak` - Backup of config (updated at each step)

## Decisions Made
- **Two-phase migration approach:** Restructured existing AlBot to multi-account format first (Phase A), verified it still worked, THEN added Prism bot (Phase B). This isolated the breaking config change from new functionality.
- **Explicit per-account dmPolicy:** Set `dmPolicy: "pairing"` inside each account object rather than relying on top-level inheritance, per OpenClaw docs recommendation for access control settings.
- **Kept existing dmScope:** Retained `per-channel-peer` dmScope instead of switching to `per-account-channel-peer`. The binding already routes messages to different agents, so session isolation is handled at the agent level.

## Deviations from Plan

None -- plan executed exactly as written. The two-phase migration pattern worked cleanly.

## Issues Encountered

- **Telegram pairing approval required:** After connecting @Prism_Price_Bot, the user needed to run `openclaw pairing approve telegram FVBMN6HB` to pair their Telegram ID with the new bot. This is expected behavior with `dmPolicy: "pairing"` -- new bot accounts require explicit pairing approval even for users already paired with other bots. Not a deviation; standard first-use flow.

## User Setup Required

None -- no external service configuration required. Bot was pre-created via BotFather (user decision from CONTEXT.md).

## Next Phase Readiness
- Telegram routing complete: both bots connected and verified
- `bindings[]` array now exists in openclaw.json -- Plan 13-02 will add Slack peer binding to it
- Ready for Plan 13-02: Add #pricelabs Slack channel with peer-channel binding

## Self-Check: PASSED

- FOUND: 13-01-SUMMARY.md exists
- FOUND: multi-account Telegram config with accounts.default + accounts.pricelabs
- FOUND: top-level botToken/dmPolicy removed from channels.telegram
- FOUND: bindings[] array with 1 entry (agentId: pricelabs, match: telegram/pricelabs)

---
*Phase: 13-channel-routing*
*Completed: 2026-02-28*
