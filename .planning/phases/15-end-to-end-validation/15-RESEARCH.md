# Phase 15: End-to-End Validation - Research

**Researched:** 2026-02-28
**Domain:** Multi-agent system acceptance testing -- routing matrix, cron delivery verification, main agent regression, workspace separation confirmation
**Confidence:** HIGH

## Summary

Phase 15 is the acceptance testing phase for the v1.2 milestone. No new functionality is built -- the entire phase is verification that Phases 11-14 produced a correctly functioning multi-agent system. The testing matrix covers four domains: (1) routing correctness across all 4 channel/agent paths (Telegram Prism, Telegram AlBot, Slack Prism, Slack AlBot), (2) cron delivery to dedicated channels only, (3) main agent regression (existing AlBot functionality unaffected), and (4) workspace separation (Prism has independent workspace, agents do not share sessions/memory/sandbox).

Phase 13 already performed a partial routing matrix verification (Plan 13-02 human-verified all 4 paths), and Phase 14 verified cron delivery to #pricelabs Slack. Phase 15 elevates this to a comprehensive final pass that also tests cross-talk in both directions (asking AlBot domain-specific questions, asking Prism generic questions) and confirms main agent cron jobs are still registered. The user explicitly decided NOT to remove PriceLabs skills from AlBot's workspace -- E2E-04 is reinterpreted as "verify separation without removal."

All verification in this phase uses OpenClaw CLI commands and live message testing. There are no code changes, no config changes, and no file modifications. The output is a verification report documenting pass/fail status for each requirement.

**Primary recommendation:** Execute a structured test protocol using OpenClaw CLI commands (`openclaw agents list`, `openclaw cron list`, `openclaw sandbox explain`, `openclaw channels status --probe`) for automated checks, plus live message testing on all 4 channel/agent paths for behavioral verification. Use human checkpoints for subjective persona and data quality validation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full routing matrix: test every channel/agent combo (Telegram Prism, Telegram AlBot, Slack Prism, Slack AlBot)
- Each path tested with both domain-specific questions ("show my listings") and generic questions ("hello")
- Pass criteria: correct persona AND real data -- proves both routing and tool access work
- Cross-talk tested in both directions:
  - Ask AlBot "show my listings" -> verify he does NOT use PriceLabs tools
  - Ask Prism a generic question -> verify natural redirect to portfolio topics
- Cron delivery re-verified: manually trigger daily health cron to confirm it still delivers to #pricelabs after all changes
- AlBot cron jobs: check registration only (`openclaw cron list`) -- do NOT trigger them manually (avoids noise in his channels)
- Skills, memory, and advanced features: NOT explicitly tested (too broad, not impacted by v1.2 changes)
- **Do NOT remove PriceLabs skills from AlBot's workspace** -- user decision to leave them in place
- E2E-04 requirement adjusted: verify separation without removal, not "skills removed"
- Verification instead of cleanup:
  - Confirm Prism's workspace has all needed files and skills independently (not sharing AlBot's)
  - Confirm agents don't share sessions, memory, or sandbox (complete isolation)
  - Check workspace paths, agent dirs, session keys, and sandbox scopes are separate

### Claude's Discretion
- Exact test message wording for each routing path
- Order of test execution (routing first vs cron first vs regression first)
- How to verify session/state isolation (CLI commands vs config inspection)
- Whether to restart gateway before final validation (fresh state)

### Deferred Ideas (OUT OF SCOPE)
- AlBot PriceLabs skill removal -- user chose to keep them. Can revisit in a future cleanup phase if they cause confusion.
- AlBot advanced feature regression -- skills, memory, workshop features not tested. Out of scope for v1.2 validation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Full routing test matrix passes -- each channel/bot tested with domain-specific and generic questions, no cross-talk | 4 channel/agent paths identified from Phase 13. Each path needs 2 tests (domain-specific + generic). Cross-talk tests in both directions. Total: 8 message tests + 2 cross-talk tests = 10 test cases. CLI commands for routing verification: `openclaw agents list --bindings` shows 2 bindings (Telegram accountId + Slack peer). |
| E2E-02 | Cron deliveries arrive in correct dedicated channels, not main agent channels | Phase 14 verified Slack delivery via manual trigger. Re-verification: trigger daily-health-slack again, confirm arrives in C0AH8TSNNKH (#pricelabs). Check Telegram delivery via `openclaw cron runs --id <jobId>` for `delivered: true`. Verify NO cron output appears in AlBot's Slack channels or Telegram bot. |
| E2E-03 | Main agent functionality unaffected -- existing cron jobs, channels, and skills work normally | AlBot regression: verify via `openclaw cron list` that AlBot's cron jobs exist. Verify AlBot responds on Telegram (@NGA_AlBot) and Slack (existing channels). No manual trigger of AlBot's crons (user decision). Basic conversation check only. |
| E2E-04 | Verify separation without removal -- Prism has independent workspace and skills, agents don't share sessions/memory/sandbox | Workspace paths verified via `openclaw agents list` (workspace field). Session isolation via `openclaw sessions list --agent pricelabs` vs `openclaw sessions list --agent main`. Sandbox isolation via `openclaw sandbox explain --agent pricelabs` vs `openclaw sandbox explain --agent main`. Agent dirs are separate: `~/.openclaw/agents/pricelabs/` vs `~/.openclaw/agents/main/`. Skills independent: Prism's workspace has its own `skills/` directory. |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| OpenClaw CLI | v2026.2.25+ | Agent listing, cron listing, sandbox inspection, channel status | Native gateway CLI with definitive system state queries. Every verification has a corresponding CLI command. |
| OpenClaw `agent` command | v2026.2.25+ | Send test messages to specific agents via CLI | `openclaw agent --agent <id> --message "<text>"` bypasses channel routing for direct agent testing. |
| OpenClaw `channels status` | v2026.2.25+ | Verify Telegram/Slack connectivity with `--probe` flag | Confirms both Telegram bots and Slack socket are connected before message testing. |
| OpenClaw `cron` CLI | v2026.2.25+ | List, run, and inspect cron job status | `openclaw cron list` shows all jobs with agentId. `openclaw cron run` triggers manual test. `openclaw cron runs` shows execution history. |
| Live messaging (Telegram/Slack) | N/A | Send test messages to bots/channels and observe responses | The authoritative test: real user messages through real channels to real agents. CLI-only testing is necessary but not sufficient. |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `openclaw agents list --bindings` | Verify routing rules for pricelabs agent | Before message testing to confirm bindings are correct |
| `openclaw sandbox explain --agent <id>` | Compare sandbox scopes between agents | For E2E-04 workspace separation verification |
| `openclaw sessions list --agent <id>` | Verify session isolation between agents | For E2E-04 session separation verification |
| `sudo systemctl restart openclaw-gateway.service` | Optional: fresh gateway state before validation | Claude's discretion -- may help ensure clean test environment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual message testing | Automated test scripts | Manual testing is appropriate for 10 test cases in an acceptance phase. Automation adds script maintenance overhead for a one-time validation. |
| CLI `openclaw agent --message` | Direct Telegram/Slack messages | CLI bypasses channel routing; real messages test the full pipeline. Both are needed: CLI for agent-level tests, real messages for routing tests. |
| Full gateway restart before testing | Test without restart | Restart ensures clean state but adds 30-60 seconds. Recommended unless recent changes make it unnecessary. |

**Installation:**
No new packages. This phase uses only existing OpenClaw CLI commands and live messaging.

## Architecture Patterns

### Recommended Test Structure

```
Phase 15 Test Matrix
├── Pre-flight checks (CLI-only)
│   ├── openclaw agents list --bindings
│   ├── openclaw channels status --probe
│   ├── openclaw cron list
│   └── openclaw sandbox explain (both agents)
├── E2E-01: Routing matrix (10 live message tests)
│   ├── Prism Telegram: domain question ("show my listings")
│   ├── Prism Telegram: generic question ("hello")
│   ├── AlBot Telegram: domain question ("show my listings") → cross-talk check
│   ├── AlBot Telegram: generic question ("hello")
│   ├── Prism Slack (#pricelabs): domain question
│   ├── Prism Slack (#pricelabs): generic question
│   ├── AlBot Slack (existing channel): domain question → cross-talk check
│   ├── AlBot Slack (existing channel): generic question
│   ├── Cross-talk A: AlBot does NOT invoke PriceLabs tools
│   └── Cross-talk B: Prism steers generic back to portfolio
├── E2E-02: Cron delivery verification
│   ├── Trigger daily-health-slack manually
│   ├── Verify arrives in #pricelabs (C0AH8TSNNKH)
│   ├── Verify does NOT appear in AlBot channels
│   └── Check Telegram cron run history for delivered: true
├── E2E-03: Main agent regression
│   ├── AlBot cron jobs registered (list check only)
│   ├── AlBot responds on Telegram
│   ├── AlBot responds on Slack
│   └── Basic conversation quality (not degraded)
└── E2E-04: Workspace separation
    ├── Workspace paths are different
    ├── Agent dirs are different
    ├── Session stores are separate
    ├── Sandbox scopes are separate
    └── Prism workspace has independent skills/
```

### Pattern 1: Pre-Flight CLI Verification

**What:** Run a battery of CLI commands to verify system state before any message testing.
**When to use:** First step of every validation run.
**Why:** CLI checks are deterministic and fast. They catch configuration problems (missing bindings, disconnected channels, unregistered cron jobs) before investing time in message tests.

**Example:**
```bash
# Verify agents and bindings
openclaw agents list --bindings
# Expected: pricelabs agent with 2 bindings (Telegram accountId + Slack peer)

# Verify channel connectivity
openclaw channels status --probe
# Expected: Telegram (2 accounts connected), Slack (connected, 3 channels)

# Verify cron jobs
openclaw cron list
# Expected: 4 pricelabs jobs + AlBot's existing jobs

# Verify sandbox isolation
openclaw sandbox explain --agent pricelabs
# Expected: pricelabs_* allowed, exec denied
openclaw sandbox explain --agent main
# Expected: main agent tools (no pricelabs_* restriction)
```

### Pattern 2: Live Message Testing Protocol

**What:** Send real messages through real channels and verify agent responses.
**When to use:** After pre-flight checks pass.
**Why:** CLI commands verify configuration; live messages verify behavior. A correctly configured system could still produce wrong responses if workspace files, skills, or tool access have issues.

**Test message recommendations (Claude's discretion):**

| Path | Domain Question | Generic Question | Expected Behavior |
|------|----------------|------------------|-------------------|
| Telegram -> Prism (@Prism_Price_Bot) | "Can you show me how my listings are performing?" | "Hello, who are you?" | Domain: Returns real listing data (5 properties, TN/NH/NY markets). Generic: Prism persona intro, diamond signature, steers toward portfolio. |
| Telegram -> AlBot (@NGA_AlBot) | "Show me my PriceLabs listings" | "Hey, what's up?" | Domain: AlBot should NOT call pricelabs_* tools (cross-talk check). Generic: Normal AlBot casual personality. |
| Slack -> Prism (#pricelabs) | "What's my portfolio health looking like?" | "Hi there" | Domain: Returns health summary with real data. Generic: Prism acknowledges, pivots to portfolio context. |
| Slack -> AlBot (existing channel) | "Check my PriceLabs data" | "Hello" | Domain: AlBot may have pricelabs tools but should not be a PriceLabs specialist. Generic: Normal AlBot response. |

**Key verification criteria:**
- **Persona check:** Prism responses use professional analyst tone, diamond signature. AlBot responses use his casual personality.
- **Data check:** Prism domain responses include real listing names (Smoky Creek Hideaway, The Rustic Rooster, Meeker Hollow, Hillside Haven, Happy Hollow) with actual pricing/occupancy data.
- **Cross-talk check:** AlBot receiving "show my listings" should NOT produce a Prism-style portfolio analysis. He may acknowledge PriceLabs exists but should not act as a PriceLabs specialist.
- **Redirect check:** Prism receiving "hello" should respond briefly and naturally redirect toward portfolio/pricing topics.

### Pattern 3: Cron Re-Verification

**What:** Manually trigger one cron job and verify delivery to the correct channel.
**When to use:** After routing matrix tests pass.
**Why:** Cron delivery was verified in Phase 14, but Phase 15 re-verifies after the full system is in its final state. This catches any regression from config drift.

**Example:**
```bash
# Trigger daily health to Slack
openclaw cron run 21a80cc6-d1bd-44fb-ac95-77ec4592289f

# Wait for completion (~30-60 seconds)
sleep 60

# Verify delivery
openclaw cron runs --id 21a80cc6-d1bd-44fb-ac95-77ec4592289f --limit 1
# Expected: status: ok, delivered: true

# Check Telegram cron history (no manual trigger needed)
openclaw cron runs --id 3f14edc8-9ebb-4942-b3eb-68f9d8f0803b --limit 5
# Look for scheduled runs with delivered: true
```

### Pattern 4: Workspace Separation Verification

**What:** Verify that Prism and AlBot have completely independent workspaces, agent directories, sessions, and sandboxes.
**When to use:** As part of E2E-04 verification.
**Why:** User decided not to remove PriceLabs skills from AlBot's workspace. Separation is verified by confirming independence, not by removal.

**Verification checklist:**

| Aspect | Check Method | Expected Result |
|--------|-------------|-----------------|
| Workspace path | `openclaw agents list` | pricelabs: `~/.openclaw/workspace-pricelabs`, main: `~/.openclaw/workspace` |
| Agent directory | File system check | `~/.openclaw/agents/pricelabs/agent/` exists separately from `~/.openclaw/agents/main/agent/` |
| Auth profiles | File system check | Both dirs have independent `auth-profiles.json` |
| Session store | `openclaw sessions list --agent pricelabs` vs `--agent main` | Different session lists, no shared session keys |
| Sandbox scope | `openclaw sandbox explain --agent pricelabs` vs `--agent main` | pricelabs: pricelabs_* allowed, exec denied. main: different tool set. |
| Skills independence | File system check | `~/.openclaw/workspace-pricelabs/skills/` has all 4 skill dirs independently |
| No shared memory | File system check | `~/.openclaw/workspace-pricelabs/MEMORY.md` and `~/.openclaw/workspace/MEMORY.md` are separate files |

### Anti-Patterns to Avoid

- **Testing only via CLI, skipping live messages:** CLI verifies configuration, not behavior. Live message testing is essential for confirming persona, tool usage, and cross-talk absence.
- **Triggering AlBot's cron jobs manually:** User explicitly decided against this. Check registration only via `openclaw cron list`.
- **Testing advanced AlBot features (skills, memory, workshop):** Out of scope per user decision. Basic conversation and cron registration check is sufficient for regression.
- **Removing PriceLabs skills from AlBot's workspace:** User decided to keep them. Do not clean up `~/.openclaw/workspace/pricelabs-skills/`.
- **Assuming Phase 13/14 verification is sufficient:** Phase 15 is a comprehensive final pass. Even though individual components were tested, the combined system may have interactions not caught in isolation.
- **Skipping cross-talk tests:** The most important validation is that agents stay in their lanes. Testing only happy paths misses the core risk of multi-agent routing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System state verification | Manual JSON inspection of openclaw.json | `openclaw agents list --bindings`, `openclaw channels status --probe`, `openclaw cron list` | CLI commands provide parsed, validated output. Manual JSON inspection is error-prone for large configs. |
| Routing correctness | Custom test scripts that send messages via API | Live messaging through real Telegram/Slack + human observation | Real messages test the full pipeline including channel auth, binding resolution, agent session creation, and delivery. |
| Cross-talk detection | Automated response parsing | Human judgment on response content | Cross-talk is nuanced: AlBot might mention PriceLabs without being a specialist. Human judgment is needed to assess whether the response indicates routing failure vs. general knowledge. |
| Workspace comparison | Manual file listing | `openclaw agents list` for paths + targeted `ls` commands | CLI gives authoritative agent configuration. File system checks confirm physical isolation. |

**Key insight:** Phase 15 is a human-in-the-loop acceptance test. The verification is semi-automated (CLI checks + message sending) but judgment calls on persona quality, cross-talk severity, and data correctness require human assessment.

## Common Pitfalls

### Pitfall 1: False Pass on Cross-Talk (AlBot Answering PriceLabs Questions)

**What goes wrong:** AlBot receives "show my listings" and produces a helpful response that looks like a PriceLabs specialist response, causing a false failure. Or AlBot gives a vague response and the tester incorrectly marks it as a pass.

**Why it happens:** AlBot still has PriceLabs skills in his workspace (`~/.openclaw/workspace/pricelabs-skills/`). He also has global access to `pricelabs_*` tools via the shared plugin. He CAN answer PriceLabs questions -- the question is whether he DOES so in a way that indicates routing failure.

**How to avoid:** Cross-talk is NOT "AlBot cannot answer PriceLabs questions." Cross-talk IS "messages intended for Prism are being answered by AlBot (wrong agent receives message)." The test verifies that messages sent to @Prism_Price_Bot are answered by Prism (not AlBot), and messages sent to @NGA_AlBot are answered by AlBot (not Prism). If AlBot independently uses PriceLabs tools from his own workspace, that is NOT cross-talk -- it is expected behavior since the user chose to keep skills in his workspace.

**Warning signs:** Test results are ambiguous because the tester confuses "AlBot can answer PriceLabs questions" with "routing is broken."

**Correct test criteria:**
- Routing correctness: check the PERSONA of the response, not the CONTENT. Is the response from Prism (professional analyst, diamond signature) or AlBot (casual personality)? That determines routing.
- Cross-talk: send message via @Prism_Price_Bot, verify Prism persona responds. Send via @NGA_AlBot, verify AlBot persona responds. Each bot routes to the correct agent regardless of question topic.

### Pitfall 2: Telegram Rate Limiting During Rapid Testing

**What goes wrong:** Sending many test messages in quick succession across both Telegram bots triggers Telegram API rate limits. Messages are delayed or dropped, making test results unreliable.

**Why it happens:** Both Telegram bots share the same user's rate limit bucket. Phase 13 experienced this during rapid gateway restarts.

**How to avoid:** Space test messages 10-15 seconds apart. Test Telegram paths first (rate-limited), then Slack paths (no rate limit concern). If responses are delayed, wait 30-60 seconds before concluding the test failed.

**Warning signs:** Bot shows "typing" indicator but no response for 30+ seconds. Response arrives much later than expected.

### Pitfall 3: Stale Session State Interfering with Tests

**What goes wrong:** Previous test sessions from Phases 12-14 have lingering context that affects new test responses. Prism "remembers" previous conversations and responds differently than a fresh session would.

**Why it happens:** OpenClaw sessions persist by default. When the same user sends a message to the same bot, the existing session is resumed, not a new one created.

**How to avoid:** Consider restarting the gateway before Phase 15 testing (Claude's discretion). This clears active session state. Alternatively, use `openclaw sessions list --agent pricelabs` to check active sessions and `openclaw sessions clear --agent pricelabs` if cleanup is needed. For cron tests, `sessionTarget: "isolated"` already guarantees fresh sessions.

**Warning signs:** Prism's response references previous conversations or context that was not provided in the current test message.

### Pitfall 4: Cron Delivery Verification Gap (Telegram Jobs Never Manually Triggered)

**What goes wrong:** Phase 14 only manually triggered Slack cron jobs. The Telegram cron jobs (daily-health-telegram, weekly-optimization-telegram) have never been manually triggered. Their delivery status is based on scheduled run history, which may not exist yet if the first scheduled run hasn't fired.

**Why it happens:** Phase 14 decided Slack-only manual trigger was sufficient since Telegram uses the same agent/prompt pipeline. But for Phase 15 comprehensive validation, the Telegram delivery path should be at least indirectly verified.

**How to avoid:** Check `openclaw cron runs` for Telegram jobs to see if any scheduled runs have fired and delivered. If no runs exist yet (too early for scheduled firing), note this as a known gap and recommend monitoring the first scheduled delivery. Alternatively, manually trigger one Telegram cron job as part of E2E-02.

**Warning signs:** `openclaw cron runs --id <telegram-job-id> --limit 5` returns zero results. This means the job has never fired and delivery is unverified.

### Pitfall 5: Main Agent Regression Scope Creep

**What goes wrong:** Tester gets pulled into extensive AlBot regression testing beyond what Phase 15 requires, spending time on skills, memory, advanced features that are explicitly out of scope.

**Why it happens:** Natural tendency to be thorough. AlBot has many features. Once testing starts, it is tempting to verify everything.

**How to avoid:** Stick to the CONTEXT.md-defined scope: (1) AlBot responds on Telegram, (2) AlBot responds on Slack, (3) AlBot cron jobs registered (`openclaw cron list`), (4) basic conversation works. No skill testing, no memory testing, no advanced features.

**Warning signs:** Test plan includes AlBot skill invocations, memory writes, or workshop features.

## Code Examples

### Complete Pre-Flight Check Script

```bash
# Source: Synthesized from OpenClaw CLI patterns used in Phases 12-14

echo "=== Pre-Flight Checks ==="

echo "--- 1. Agent List + Bindings ---"
openclaw agents list --bindings
# Expected: pricelabs agent with 2 bindings, main/default agent

echo "--- 2. Channel Status ---"
openclaw channels status --probe
# Expected: Telegram (2 accounts: default + pricelabs), Slack (connected)

echo "--- 3. Cron Job List ---"
openclaw cron list
# Expected: 4 pricelabs jobs + any AlBot jobs

echo "--- 4. Pricelabs Sandbox ---"
openclaw sandbox explain --agent pricelabs
# Expected: pricelabs_* in allow, exec in deny

echo "--- 5. Main Agent Sandbox ---"
openclaw sandbox explain --agent main
# Expected: Different tool set than pricelabs
```

### Routing Matrix Test Cases

```bash
# Source: Phase 15 CONTEXT.md decisions + Phase 13 verification patterns

# --- Prism Telegram ---
# Send via @Prism_Price_Bot DM:
# Test 1: "Can you show me how my listings are performing?"
# Expected: Prism persona, real data (5 listings, TN/NH/NY), diamond signature
# Test 2: "Hello, who are you?"
# Expected: Prism intro, professional tone, steers to portfolio topics

# --- AlBot Telegram ---
# Send via @NGA_AlBot DM:
# Test 3: "Show me my PriceLabs listings"
# Expected: AlBot persona (casual tone), may or may not use PriceLabs tools,
#           but does NOT respond as Prism. This verifies routing, not tool access.
# Test 4: "Hey, what's up?"
# Expected: Normal AlBot casual greeting

# --- Prism Slack ---
# Post in #pricelabs channel:
# Test 5: "What's my portfolio health looking like?"
# Expected: Prism persona, portfolio health summary with real data
# Test 6: "Hi there"
# Expected: Prism brief greeting, redirect to portfolio topics

# --- AlBot Slack ---
# Post in existing AlBot channel (e.g., general or existing Slack channel):
# Test 7: "Check my PriceLabs data"
# Expected: AlBot persona, not Prism. Cross-talk verification.
# Test 8: "Hello"
# Expected: Normal AlBot response
```

### Cron Re-Verification Commands

```bash
# Source: Phase 14 verification patterns

# Trigger daily health to Slack (same job ID from Phase 14)
openclaw cron run 21a80cc6-d1bd-44fb-ac95-77ec4592289f

# Wait for completion
sleep 90

# Check run status
openclaw cron runs --id 21a80cc6-d1bd-44fb-ac95-77ec4592289f --limit 1
# Expected: status: ok, delivered: true

# Check Telegram cron history (may or may not have runs yet)
openclaw cron runs --id 3f14edc8-9ebb-4942-b3eb-68f9d8f0803b --limit 5

# Verify AlBot's cron jobs still registered (DO NOT trigger)
openclaw cron list | grep -v pricelabs
# Expected: AlBot's cron jobs appear in the list
```

### Workspace Separation Verification Commands

```bash
# Source: Phase 12 architecture, CONTEXT.md E2E-04 decisions

# 1. Verify separate workspace paths
openclaw agents list
# Expected:
#   main (default): workspace = ~/.openclaw/workspace
#   pricelabs:       workspace = ~/.openclaw/workspace-pricelabs

# 2. Verify separate agent directories
ls -la ~/.openclaw/agents/main/agent/
ls -la ~/.openclaw/agents/pricelabs/agent/
# Expected: Both exist independently with auth-profiles.json

# 3. Verify Prism workspace has independent skills
ls ~/.openclaw/workspace-pricelabs/skills/
# Expected: domain-knowledge/ monitoring-protocols/ analysis-playbook/ optimization-playbook/

# 4. Verify separate session stores
openclaw sessions list --agent pricelabs
openclaw sessions list --agent main
# Expected: Different session lists, no shared keys

# 5. Verify separate sandbox scopes
openclaw sandbox explain --agent pricelabs
openclaw sandbox explain --agent main
# Expected: Different tool allow/deny lists
```

## State of the Art

| Previous Verification | Phase 15 Verification | Why Needed Again |
|-----------------------|----------------------|------------------|
| Phase 13 Plan 02: 4-path routing verified | Full routing matrix with cross-talk tests | Phase 13 was "does it work?"; Phase 15 is "does it work correctly under adversarial conditions (wrong-domain questions)?" |
| Phase 14 Plan 02: Slack cron delivery verified | Re-trigger cron + check Telegram history | Config may have drifted. Phase 15 is the final acceptance gate. |
| Phase 12 Plan 02: Prism persona + data verified | Part of routing matrix tests | Verifies persona is stable after all channel/cron changes in Phases 13-14 |
| No prior: AlBot regression | New in Phase 15 | Phases 12-14 focused on Prism. AlBot was tested only as "still works?" in Phase 13. Phase 15 formally verifies regression. |
| No prior: Workspace separation | New in Phase 15 | CONTEXT.md defines E2E-04 as separation verification. Must check workspace paths, agent dirs, sessions, sandbox. |

## Known System State (From Phases 11-14)

This section consolidates the exact values and IDs discovered during previous phases. The planner MUST use these values, not placeholders.

### Agent IDs
- Prism agent: `pricelabs`
- Main agent: `main` (default: true)

### Channel IDs
- #pricelabs Slack: `C0AH8TSNNKH`
- Existing AlBot Slack channels: `C0AF9MXD0ER`, `C0AG7FJNKNC`

### Telegram Accounts
- AlBot: `default` (bot: @NGA_AlBot)
- Prism: `pricelabs` (bot: @Prism_Price_Bot)
- User Telegram ID / Prism chat ID: `8283515561`

### Cron Job IDs
- daily-health-slack: `21a80cc6-d1bd-44fb-ac95-77ec4592289f`
- daily-health-telegram: `3f14edc8-9ebb-4942-b3eb-68f9d8f0803b`
- weekly-optimization-slack: `06ac95eb-f9cb-4298-b58f-a0c09f3edb74`
- weekly-optimization-telegram: `a483d6ba-202a-4837-a290-a275d380ef1f`

### Workspace Paths
- Prism workspace (repo): `openclaw/workspace-pricelabs/`
- Prism workspace (deployed): `~/.openclaw/workspace-pricelabs/`
- AlBot workspace (deployed): `~/.openclaw/workspace/`
- PriceLabs skills in AlBot workspace: `~/.openclaw/workspace/pricelabs-skills/` (kept per user decision)

### Listing Data (Expected in Prism Responses)
- 5 listings across 3 markets:
  - TN market: Smoky Creek Hideaway, The Rustic Rooster, Hillside Haven (Sevierville/Kodak TN)
  - NH market: Happy Hollow (Gilmanton NH)
  - NY market: Meeker Hollow (Roxbury NY)

## Open Questions

1. **Whether Telegram cron jobs have any delivery history**
   - What we know: Phase 14 only manually triggered Slack jobs. Telegram jobs were registered but never manually triggered. Their next scheduled run depends on timing.
   - What's unclear: Whether any scheduled runs have fired between Phase 14 completion (2026-02-28 17:45 UTC) and Phase 15 execution.
   - Recommendation: Check `openclaw cron runs --id 3f14edc8-9ebb-4942-b3eb-68f9d8f0803b --limit 5` at the start of Phase 15. If runs exist with `delivered: true`, Telegram delivery is verified. If no runs, consider manually triggering one Telegram cron job, or note as a known gap that will be verified on the first scheduled run.

2. **Whether gateway restart is needed before testing**
   - What we know: Claude's discretion per CONTEXT.md. Gateway has been running since Phase 14 with no changes.
   - What's unclear: Whether stale session state from Phases 12-14 will interfere with clean test results.
   - Recommendation: Restart the gateway before Phase 15 testing for a clean state. This adds 30-60 seconds but eliminates session contamination risk.

3. **How AlBot responds to "show my listings" (cross-talk test ambiguity)**
   - What we know: AlBot has PriceLabs skills in his workspace and global access to pricelabs_* tools. He CAN answer PriceLabs questions.
   - What's unclear: Whether AlBot will proactively use PriceLabs tools when asked about listings. His AGENTS.md may or may not instruct him to use them. This makes the cross-talk test result ambiguous.
   - Recommendation: The cross-talk test verifies ROUTING, not TOOL ACCESS. The correct check is: "Is this response from Prism or AlBot?" Check persona indicators (diamond signature = Prism, casual tone = AlBot). If AlBot independently uses PriceLabs tools with his own personality, that is NOT cross-talk.

## Sources

### Primary (HIGH confidence)
- **Phase 12 Research + Summaries** (`12-RESEARCH.md`, `12-01-SUMMARY.md`, `12-02-SUMMARY.md`) -- Agent registration, sandbox config, CLI verification commands. Verified against live system.
- **Phase 13 Research + Summaries** (`13-RESEARCH.md`, `13-01-SUMMARY.md`, `13-02-SUMMARY.md`) -- Channel routing, Telegram multi-account, Slack peer binding, full routing matrix verification. All 6 CHAN requirements satisfied.
- **Phase 14 Research + Summaries** (`14-RESEARCH.md`, `14-01-SUMMARY.md`, `14-02-SUMMARY.md`) -- Cron job registration, manual trigger verification, job IDs, delivery confirmation. All 5 CRON requirements satisfied.
- **Phase 11 Verification** (`11-VERIFICATION.md`) -- Workspace brain files verified: all 9 WORK requirements satisfied, 12 artifacts confirmed.
- **ARCHITECTURE.md** (`.planning/research/ARCHITECTURE.md`) -- System diagram, target state architecture, workspace separation model, agent directory structure.
- **15-CONTEXT.md** (`15-CONTEXT.md`) -- User decisions for this phase, locked test approach, cross-talk verification method, E2E-04 reinterpretation.

### Secondary (MEDIUM confidence)
- **STACK.md** (`.planning/research/STACK.md`) -- CLI command reference, cron configuration patterns, channel binding syntax.
- **PITFALLS.md** (`.planning/research/PITFALLS.md`) -- Known pitfalls from v1.1 that may resurface during validation (sandbox tool allow, agentDir typo, auth profiles).

### Tertiary (LOW confidence)
- **AlBot cross-talk test behavior:** Cannot predict exactly how AlBot will respond to PriceLabs-domain questions. His behavior depends on his workspace configuration and AGENTS.md instructions, which are outside the scope of this project's research. The cross-talk test criteria must focus on persona identification, not content.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All CLI commands verified in prior phases. Same tools used for verification.
- Architecture: HIGH -- Test structure directly mirrors the system architecture documented in Phases 11-14.
- Pitfalls: HIGH -- Pitfalls sourced from actual Phase 13/14 execution experience and user CONTEXT.md decisions.

**Research date:** 2026-02-28
**Valid until:** 2026-03-15 (short validity -- this is a one-time acceptance test phase, findings are immediately actionable)
