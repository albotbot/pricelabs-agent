# Phase 11: Workspace Brain - Research

**Researched:** 2026-02-27
**Domain:** OpenClaw workspace file authoring, token budgeting, AgentSkills migration
**Confidence:** HIGH

## Summary

Phase 11 is pure content authoring -- zero runtime changes, zero code, zero config edits. The deliverable is a complete workspace directory at `~/.openclaw/workspace-pricelabs/` containing 7 brain files (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOT.md, MEMORY.md) and 4 migrated skill directories under `skills/`. The single hardest constraint is the ~2,000 token bootstrap budget: the 5 files injected every turn (AGENTS.md + SOUL.md + USER.md + IDENTITY.md + TOOLS.md) must total under ~8,000 characters (at ~4 chars/token). BOOT.md and MEMORY.md are NOT counted in this budget -- BOOT.md runs only at gateway startup, and MEMORY.md is injected only in main private sessions.

The research findings confirm: (1) the token budget is tight but achievable if domain knowledge stays in skills (loaded on-demand, not injected per-turn), (2) the SKILL.md frontmatter format is minimal (just `name` + `description`), (3) `user-invocable: false` should be set on all 4 skills since they are reference material not slash commands, and (4) the persona ("Prism") must be sharply distinct from the main agent ("Albot") in both SOUL.md content and IDENTITY.md metadata.

**Primary recommendation:** Author the 5 bootstrap files to a combined ~7,000-7,500 characters (~1,750-1,875 tokens), leaving ~125-250 token headroom. Keep ALL operational protocols in skills. Bootstrap files contain only: safety rules, persona voice, user context, tool category names, and skill pointers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Agent name: Prism** -- seeing portfolio through different lenses (pricing, occupancy, comp set)
- **Emoji: diamond (Unicode)** -- placeholder until custom avatar
- **Footer tag: "Prism"** at end of summaries/reports
- **Introduction text:** "I'm Prism, your portfolio revenue analyst. I monitor pricing, occupancy, and market position for your RE portfolio."
- **Persona tone:** Sharp analyst -- facts-first, numbers-forward, NOT dramatic, no urgency theater
- **Bad-news framing:** State problem, add market context, suggest a lever
- **Jargon approach:** Uses STR terms (RevPAR, ADR, STLY, comp set) with brief context on first mention per session
- **Good-day pattern:** Brief with one insight
- **Safety rules (both critical):** (1) Never auto-change prices without explicit approval, (2) Never expose API keys or credentials
- **Bootstrap content priority:** Safety rules, persona voice cues, and tool names (categorized, no descriptions) on every turn
- **USER.md content:** SSS Team, timezone spread (ET/CT), portfolio is revenue-focused STRs, owners are Beau, Jonas, and Elle, Jey is Ops Manager
- **TOOLS.md approach:** Names only, grouped by function category -- Prism gets full schemas from MCP anyway
- **MEMORY.md seeding:** Portfolio overview + market baselines on day one; listing data pulled from PriceLabs API on first boot (not hardcoded)
- **Rolling context:** MEMORY.md captures operational observations (key metric changes, decisions made)
- **CRITICAL DESIGN PRINCIPLE:** Keep total bootstrap tokens low enough that with an average user question, all context is preserved every time and information is never lost to compaction

### Claude's Discretion
- Exact token allocation per file (within the ~2,000 total budget)
- SKILL.md YAML frontmatter field values
- BOOT.md health check procedure specifics
- How to structure the rolling context in MEMORY.md

### Deferred Ideas (OUT OF SCOPE)
- Knowledge stack integration for long-term memory (MEMORY.md to QMD/Cognee) -- future milestone
- Custom avatar/photo for Prism -- user will create separately
- Per-agent model selection (cheaper for cron, Opus for interactive) -- Phase 12 or later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | AGENTS.md with operating instructions, safety rules, and tool usage protocol (under 4,000 chars) | Token budget analysis shows 2,500-3,500 chars optimal; safety rules and skill pointers are the core content; operational protocols stay in skills |
| WORK-02 | SOUL.md with professional revenue analyst persona distinct from main agent (under 2,500 chars) | Prism persona fully defined in CONTEXT.md; tone is sharp analyst, NOT casual Albot; target 1,500-2,000 chars |
| WORK-03 | USER.md with owner profile, timezone, and STR business context (under 700 chars) | SSS Team structure defined; 4 named team members; timezone spread ET/CT; target 400-600 chars |
| WORK-04 | IDENTITY.md with unique name, emoji, and description (under 400 chars) | Name "Prism", emoji diamond, intro text locked in CONTEXT.md; target 200-350 chars |
| WORK-05 | TOOLS.md with quick reference for 28 MCP tools, rate limits, safety gate, skill pointers (under 1,500 chars) | 28 tools verified in tool-definitions.json; group by category (Read/Store/Analysis/Write/Config/Audit); names only per user decision; target 800-1,200 chars |
| WORK-06 | BOOT.md with startup health check and online notification procedure (under 500 chars) | BOOT.md runs on gateway restart only (not per-turn); keep short; API status check + online notification; target 200-400 chars |
| WORK-07 | MEMORY.md seeded with portfolio overview (5 listings, TN/NH markets) (grows with history) | Structure should accommodate API-pulled listing data; rolling context for observations; NOT injected per-turn in cron/group sessions |
| WORK-08 | All 4 existing skill files migrated to `skills/<name>/SKILL.md` with YAML frontmatter | 4 files (26,502 chars total) need directory restructure + frontmatter; `user-invocable: false` on all 4 |
| WORK-09 | Combined bootstrap overhead under ~2,000 tokens | Budget analysis below shows 7,000-7,500 chars target for 5 files; achievable with discipline |
</phase_requirements>

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| OpenClaw Workspace Files | N/A (Markdown) | Bootstrap context injected every turn | Standard workspace contract per agent-workspace.md docs |
| AgentSkills Format | N/A (YAML frontmatter + Markdown) | Skill directories with SKILL.md | Standard format per skills.md docs; `name` + `description` required |
| OpenClaw Gateway | v2026.1.6+ | Runtime that injects workspace files and loads skills | Already deployed; no changes needed for this phase |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `/context list` | Verify actual token consumption after deployment | Post-deployment validation of bootstrap budget |
| `wc -c` | Estimate character counts during authoring | Pre-deployment char budget validation |
| 4-chars-per-token rule | Approximate token estimation | During authoring when tokenizer unavailable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 4-chars/token estimate | OpenAI tiktoken tokenizer | More precise but adds tooling dependency; 4c/t is sufficient for budget planning |
| Inline skill content in AGENTS.md | SKILL.md directories (recommended) | Inlining burns ~6,600 tokens per turn for 26,502 chars of skills; skills-as-directories burn ~308 tokens (97% reduction) |

## Architecture Patterns

### Recommended Workspace Structure

```
~/.openclaw/workspace-pricelabs/
  AGENTS.md          # Operating instructions, safety, skill pointers (~3,000 chars)
  SOUL.md            # Prism persona, tone, boundaries (~1,800 chars)
  USER.md            # SSS Team profile (~500 chars)
  IDENTITY.md        # Name, emoji, intro (~300 chars)
  TOOLS.md           # 28 tool names by category (~1,100 chars)
  BOOT.md            # Startup health check (~300 chars)
  MEMORY.md          # Portfolio overview + rolling context (~1,500+ chars, grows)
  memory/            # Daily log files (auto-created by agent)
  skills/
    domain-knowledge/
      SKILL.md       # 6,124 chars -- platform knowledge, API catalog, STR terms
    monitoring-protocols/
      SKILL.md       # 5,556 chars -- daily health check protocol
    analysis-playbook/
      SKILL.md       # 5,316 chars -- weekly optimization report protocol
    optimization-playbook/
      SKILL.md       # 9,506 chars -- orphan detection, demand spike, pricing
```

### Pattern 1: Bootstrap vs Skills Separation

**What:** Bootstrap files (injected every turn) contain only identity, safety, and pointers. Domain knowledge lives in skills (loaded on-demand).

**When to use:** Always. This is the single most important architecture decision for the workspace.

**Why:** The 4 existing skill files total 26,502 characters (~6,625 tokens). Injecting them per-turn would consume 6,625 tokens before a single user message. As skills, they contribute only ~308 tokens (the XML skills list) to every-turn overhead, and the full content is loaded only when the agent needs it.

**Example (AGENTS.md referencing skills):**
```markdown
## Skills
Read the skill file when you need the protocol:
- `skills/domain-knowledge/` -- platform knowledge, API catalog, STR terms
- `skills/monitoring-protocols/` -- daily health check steps
- `skills/analysis-playbook/` -- weekly optimization report steps
- `skills/optimization-playbook/` -- orphan detection, demand spikes, pricing strategies
```

### Pattern 2: SKILL.md Frontmatter Format

**What:** Each skill directory contains a single `SKILL.md` file with YAML frontmatter.

**Verified format (from OpenClaw docs at /home/NGA/openclaw/docs/tools/skills.md):**

```markdown
---
name: domain-knowledge
description: PriceLabs platform knowledge, API endpoints, pricing concepts, and STR revenue management domain expertise.
user-invocable: false
---

[existing skill content unchanged]
```

**Required fields:** `name`, `description`
**Recommended fields for this phase:**
- `user-invocable: false` -- these are reference skills, not slash commands
- No `metadata` block needed (no binary requirements, no env gating, no install steps)

**Per-skill token cost (injected as XML list, from docs):**
```
Base overhead (when >= 1 skill): 195 characters
Per skill: 97 + len(name) + len(description) + len(location)
```

Estimated per-skill overhead for Prism's 4 skills:

| Skill | name (chars) | description (chars) | location (chars) | Total chars | ~Tokens |
|-------|--------------|---------------------|------------------|-------------|---------|
| domain-knowledge | 16 | ~80 | ~65 | ~258 | ~65 |
| monitoring-protocols | 21 | ~80 | ~70 | ~268 | ~67 |
| analysis-playbook | 18 | ~80 | ~65 | ~260 | ~65 |
| optimization-playbook | 22 | ~80 | ~70 | ~269 | ~67 |
| **Base overhead** | | | | **195** | **~49** |
| **Total skills list** | | | | **~1,250** | **~313** |

### Pattern 3: Tight Bootstrap File Authoring

**What:** Each bootstrap file has a character budget derived from the ~2,000 token total.

**Recommended allocation:**

| File | Char Budget | Token Budget | Content Focus |
|------|-------------|-------------|---------------|
| AGENTS.md | 2,500-3,500 | 625-875 | Safety rules, session protocol, skill pointers, tool usage guidelines |
| SOUL.md | 1,500-2,000 | 375-500 | Prism persona, tone rules, bad-news framing, jargon approach |
| USER.md | 400-600 | 100-150 | SSS Team, 4 names, timezone spread, portfolio context |
| IDENTITY.md | 200-350 | 50-88 | Name, emoji, intro text, footer tag |
| TOOLS.md | 800-1,200 | 200-300 | 28 tool names grouped by category, rate limit, safety gate |
| **TOTAL** | **5,400-7,650** | **1,350-1,913** | |

**Headroom analysis:** At the upper end (7,650 chars / ~1,913 tokens), plus the skills list (~313 tokens), plus HEARTBEAT.md (~25 tokens for a comment-only file), the total per-turn workspace overhead is ~2,251 tokens. This is slightly above the ~2,000 target but well within practical limits. At the lower end (5,400 chars / ~1,350 tokens), total overhead is ~1,688 tokens with comfortable headroom.

**Recommendation:** Target the middle of each range for a combined ~6,500 chars (~1,625 tokens) of bootstrap files, resulting in ~1,938 total per-turn tokens including skills list and HEARTBEAT.md.

### Pattern 4: MEMORY.md Structure for Rolling Context

**What:** MEMORY.md serves as operational working memory, seeded with portfolio overview and growing with observations.

**Recommended structure:**
```markdown
# Portfolio Overview

## Listings
| Name | ID | Market | Type | Base Price |
|------|----|--------|------|------------|
(populated from API on first boot)

## Markets
- **Pigeon Forge, TN** -- high-demand STR market, seasonal patterns
- **Lake Winnipesaukee, NH** -- seasonal lakefront market, summer peak

## Operational Log
(agent appends observations here: metric changes, decisions, anomalies)
```

**Key design points:**
- Listing data is structured (table) not prose -- compact and scannable
- Market context is brief -- agent has full market data in skills
- Operational log is append-only with date stamps
- MEMORY.md is only injected in main (private) sessions, NOT in cron or group sessions
- `memory/YYYY-MM-DD.md` daily files are NOT injected automatically -- accessed via `memory_search`/`memory_get`

### Anti-Patterns to Avoid

- **Inlining skill content in AGENTS.md:** Burns ~6,625 tokens per turn instead of ~313. The main agent's AGENTS.md grew to 17,372 chars by accumulating lesson content -- the PriceLabs agent must NOT repeat this.
- **Duplicating tool descriptions in TOOLS.md:** Prism already receives full tool schemas from MCP. TOOLS.md should have names-only grouped by category, not descriptions.
- **Writing MEMORY.md with hardcoded listing data:** The user decided listing data should be pulled from PriceLabs API on first boot. MEMORY.md structure should have placeholder rows ready for API data.
- **Adding HEARTBEAT.md content:** Cron handles all scheduled work. HEARTBEAT.md should be empty (comments only) to avoid per-turn token burn.
- **Including BOOTSTRAP.md:** The workspace is pre-seeded. Set `skipBootstrap: true` in agent config (Phase 12). No BOOTSTRAP.md file needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer script | `wc -c` with 4-chars/token rule, then validate with `/context list` after deployment | Tokenizer varies by model; rough estimate is sufficient for authoring; exact measurement comes from the runtime |
| Skill loading | Manual `read` commands in AGENTS.md | AgentSkills format with SKILL.md frontmatter | OpenClaw auto-discovers skills in `<workspace>/skills/` and injects compact XML list |
| Memory persistence | Custom file writing in AGENTS.md instructions | OpenClaw built-in memory system (`memory/YYYY-MM-DD.md` + `MEMORY.md`) | Gateway handles memory flush, search indexing, and daily file creation |
| Tool documentation | Prose descriptions of each tool | Category groupings with names only in TOOLS.md | MCP provides full schemas at runtime; TOOLS.md is a cheat sheet, not documentation |

**Key insight:** Phase 11 is pure content authoring. There is nothing to build, compile, or configure. The value is in editorial discipline -- keeping files tight, separating concerns between bootstrap and skills, and hitting the token budget.

## Common Pitfalls

### Pitfall 1: Bootstrap File Bloat

**What goes wrong:** AGENTS.md grows beyond budget as the author adds "helpful" context, examples, and edge cases.
**Why it happens:** Natural tendency to be thorough. The main agent's AGENTS.md is 17,372 chars as a cautionary tale.
**How to avoid:** Set a hard character limit per file BEFORE authoring. Use `wc -c` after every edit. If over budget, move content to a skill file.
**Warning signs:** Any single bootstrap file exceeding its char budget by more than 10%.

### Pitfall 2: Persona Bleeding from Main Agent

**What goes wrong:** SOUL.md or AGENTS.md inadvertently copies Albot's casual, humorous tone instead of Prism's sharp analyst tone.
**Why it happens:** Author is familiar with Albot's SOUL.md and uses it as a starting template.
**How to avoid:** Do NOT use Albot's SOUL.md as a template. Write Prism's SOUL.md from scratch based on the locked persona decisions in CONTEXT.md. The tone should read like a revenue analyst's communication style, not a personal assistant's.
**Warning signs:** Words like "funny", "humor", "swearing", "break the tension" appearing in Prism's files.

### Pitfall 3: Skills Not Discovered by OpenClaw

**What goes wrong:** Skill files exist but OpenClaw does not load them because the directory structure or frontmatter is wrong.
**Why it happens:** Existing skill files are flat `.md` files (e.g., `domain-knowledge.md`), not directories with `SKILL.md` inside them. Migration must create `skills/domain-knowledge/SKILL.md`, not `skills/domain-knowledge.md`.
**How to avoid:** Verify directory structure matches `skills/<name>/SKILL.md`. Verify YAML frontmatter has `name` and `description` fields. Frontmatter must use `---` delimiters on their own lines.
**Warning signs:** `openclaw skills list` (or equivalent) does not show the 4 PriceLabs skills after deployment.

### Pitfall 4: MEMORY.md Token Creep

**What goes wrong:** MEMORY.md grows unbounded as the agent appends operational observations, eventually consuming significant per-turn tokens.
**Why it happens:** MEMORY.md is injected in main sessions. If the agent appends a paragraph per day, it grows by ~2,500 chars/week (~625 tokens/week). After a month, it could be 10,000+ chars.
**How to avoid:** Include a "maintenance protocol" in AGENTS.md: periodically summarize and trim MEMORY.md. Set a soft target of ~3,000 chars. Consider archiving older entries to daily memory files.
**Warning signs:** MEMORY.md exceeding 5,000 chars. Can monitor via `/context list`.

### Pitfall 5: Missing HEARTBEAT.md File

**What goes wrong:** If HEARTBEAT.md does not exist, OpenClaw injects a "missing file" marker into the context window, which still consumes tokens AND may trigger unexpected behavior.
**Why it happens:** Author omits HEARTBEAT.md thinking it is optional since cron handles scheduling.
**How to avoid:** Create HEARTBEAT.md with only a comment line (e.g., `# Keep empty -- cron handles scheduled work`). This file must exist even if empty.
**Warning signs:** `/context list` showing a "missing HEARTBEAT.md" injection.

## Code Examples

### SKILL.md Frontmatter (4 files to create)

```markdown
---
name: domain-knowledge
description: PriceLabs platform knowledge, API endpoints, pricing concepts, and STR revenue management domain expertise.
user-invocable: false
---

[existing domain-knowledge.md content, unchanged]
```

```markdown
---
name: monitoring-protocols
description: Daily portfolio health check protocol -- step-by-step monitoring procedure for listing metrics, syncs, and alerts.
user-invocable: false
---

[existing monitoring-protocols.md content, unchanged]
```

```markdown
---
name: analysis-playbook
description: Weekly optimization report protocol -- portfolio KPIs, week-over-week deltas, STLY comparisons, underperformer detection.
user-invocable: false
---

[existing analysis-playbook.md content, unchanged]
```

```markdown
---
name: optimization-playbook
description: Pricing optimization strategies -- orphan day detection, demand spike capture, competitive pricing, and seasonal adjustments.
user-invocable: false
---

[existing optimization-playbook.md content, unchanged]
```

### IDENTITY.md Example (~300 chars target)

```markdown
# IDENTITY.md

- **Name:** Prism
- **Role:** Portfolio Revenue Analyst
- **Emoji:** ◆
- **Intro:** I'm Prism, your portfolio revenue analyst. I monitor pricing, occupancy, and market position for your RE portfolio.
- **Footer:** ◆ Prism
```

### USER.md Example (~500 chars target)

```markdown
# USER.md - SSS Team

- **Team:** SSS (Short Stay Solutions)
- **Owners:** Beau, Jonas, Elle
- **Ops Manager:** Jey
- **Timezones:** ET and CT (America/New_York, America/Chicago)
- **Portfolio:** 5 revenue-focused short-term rental properties
- **Markets:** Pigeon Forge TN, Lake Winnipesaukee NH
- **Business model:** STR revenue optimization -- pricing, occupancy, market position
- **Communication:** Direct, data-driven. Lead with numbers.
```

### TOOLS.md Example (~1,100 chars target)

```markdown
# TOOLS.md - PriceLabs MCP Tools

28 tools via pricelabs_* prefix. Full schemas provided by MCP at runtime.

## Read
pricelabs_get_listings, pricelabs_get_listing, pricelabs_get_prices,
pricelabs_get_neighborhood, pricelabs_get_reservations, pricelabs_get_overrides,
pricelabs_get_rate_plans, pricelabs_get_api_status

## Store
pricelabs_store_daily_snapshots, pricelabs_store_price_snapshots,
pricelabs_store_reservations, pricelabs_store_market_snapshot

## Retrieve
pricelabs_get_snapshots, pricelabs_get_booking_pace, pricelabs_get_portfolio_kpis,
pricelabs_detect_underperformers, pricelabs_get_change_impact

## Write (APPROVAL REQUIRED)
pricelabs_update_listings, pricelabs_set_overrides, pricelabs_delete_overrides,
pricelabs_push_prices, pricelabs_add_listing

## Audit
pricelabs_snapshot_before_write, pricelabs_record_change,
pricelabs_log_action, pricelabs_get_audit_log

## Config
pricelabs_get_user_config, pricelabs_set_user_config

## Constraints
- Rate limit: 1000 API calls/hour
- Safety gate: PRICELABS_WRITES_ENABLED must be "true" for write ops
- Always call pricelabs_snapshot_before_write before any write operation
- Read skills/ for operational protocols
```

### BOOT.md Example (~300 chars target)

```markdown
# BOOT.md - Startup

1. Call pricelabs_get_api_status -- verify API connectivity
2. If API is down, send alert to #pricelabs channel
3. Send brief "Prism online" notification
4. Read today's memory file if it exists
5. Reply with NO_REPLY
```

### AGENTS.md Structure Guidance (~3,000 chars target)

```markdown
# AGENTS.md - Prism

## Safety (NON-NEGOTIABLE)
1. NEVER change prices without explicit owner approval
2. NEVER expose API keys or credentials in any channel
3. All write operations require PRICELABS_WRITES_ENABLED=true

## Every Session
1. Read SOUL.md, USER.md
2. Read memory/YYYY-MM-DD.md (today + yesterday) if they exist
3. If main session: read MEMORY.md

## How You Work
- Fetch real data before any analysis -- never estimate or hallucinate numbers
- Store snapshots during every monitoring run (pricelabs_store_daily_snapshots)
- Format: listing name, current value, change direction, rationale
- Rate budget: 1000 API calls/hour -- use stored snapshots to avoid redundant fetches

## Skills (read on demand)
- skills/domain-knowledge/ -- platform terms, API catalog, rate limits
- skills/monitoring-protocols/ -- daily health check steps
- skills/analysis-playbook/ -- weekly optimization report steps
- skills/optimization-playbook/ -- orphan detection, demand spikes, pricing

## Reports
- Good days: brief, one notable insight, sign off
- Bad news: state problem, add market context, suggest a lever
- Always end reports with: ◆ Prism

## Approvals
- Present pricing recommendations as PENDING APPROVAL
- Include: listing, current price, recommended change, rationale, expected impact
- Wait for explicit "approve" / "yes" before executing any write operation
- After approval: call pricelabs_snapshot_before_write, execute, call pricelabs_record_change

## Memory Maintenance
- Append key observations to MEMORY.md (metric changes, decisions, anomalies)
- Keep MEMORY.md under ~3,000 chars -- summarize and archive older entries
- Daily memory files (memory/YYYY-MM-DD.md) capture session details
```

## State of the Art

| Aspect | Current State | Target State | Impact |
|--------|--------------|--------------|--------|
| Skill file format | Flat `.md` files in `pricelabs-skills/` | `skills/<name>/SKILL.md` with YAML frontmatter | Enables OpenClaw auto-discovery and per-agent scoping |
| Skill location | Main workspace (`~/.openclaw/workspace/pricelabs-skills/`) | Prism workspace (`~/.openclaw/workspace-pricelabs/skills/`) | Skills scoped to Prism only; removed from main agent |
| Agent identity | Shared with Albot (main agent) | Dedicated Prism persona (SOUL.md, IDENTITY.md) | Distinct professional persona separate from casual Albot |
| Tool reference | Embedded in domain-knowledge.md skill | Separated into TOOLS.md (names) + skills (protocols) | Every-turn overhead reduced; protocols loaded on-demand |
| Memory | None (agent has no persistent context) | MEMORY.md + memory/ daily files | Operational continuity across sessions |
| Bootstrap overhead | N/A (agent does not exist) | ~1,625-1,938 tokens per turn | Within ~2,000 token budget target |

## Open Questions

1. **Exact listing data for MEMORY.md seeding**
   - What we know: User wants 5 listings from TN/NH markets, pulled from API on first boot
   - What is unclear: Whether the MEMORY.md template should include placeholder rows or just the table headers
   - Recommendation: Include table headers with a `<!-- Populate via pricelabs_get_listings on first boot -->` comment. The first cron run or interactive session will fill in the data.

2. **HEARTBEAT.md inclusion in token budget**
   - What we know: HEARTBEAT.md is listed in the system-prompt.md docs as an injected bootstrap file
   - What is unclear: Whether a comment-only HEARTBEAT.md still contributes meaningful tokens
   - Recommendation: A single comment line (`# Keep empty -- cron handles scheduled work`) adds ~15 chars (~4 tokens). Negligible. Include it.

3. **Repo location for workspace files**
   - What we know: The project repo should contain authoritative copies of workspace files
   - What is unclear: Whether to store them under `openclaw/workspace-pricelabs/` or a new top-level path
   - Recommendation: Store under `openclaw/workspace-pricelabs/` in the project repo, mirroring the deployment path. This parallels the existing `openclaw/skills/` pattern.

4. **Whether to create BOOTSTRAP.md**
   - What we know: User decided workspace is pre-seeded (no interactive bootstrap Q&A). CONTEXT.md defers custom avatar. Research says set `skipBootstrap: true`.
   - What is unclear: Whether a minimal self-deleting BOOTSTRAP.md adds value
   - Recommendation: Skip BOOTSTRAP.md entirely. Set `skipBootstrap: true` in agent config (Phase 12). The "first boot" experience is handled by BOOT.md (API check + online notification) and the first MEMORY.md population.

## Token Budget Analysis (Detailed)

### Per-Turn Injection Breakdown

| Component | Source | Chars | Tokens (est.) | Notes |
|-----------|--------|-------|---------------|-------|
| AGENTS.md | Bootstrap injection | ~3,000 | ~750 | Safety, session protocol, skill pointers, guidelines |
| SOUL.md | Bootstrap injection | ~1,800 | ~450 | Prism persona, tone, boundaries |
| USER.md | Bootstrap injection | ~500 | ~125 | Team profile, timezone, portfolio context |
| IDENTITY.md | Bootstrap injection | ~300 | ~75 | Name, emoji, intro, footer |
| TOOLS.md | Bootstrap injection | ~1,100 | ~275 | 28 tool names by category, constraints |
| HEARTBEAT.md | Bootstrap injection | ~60 | ~15 | Comment-only (empty) |
| Skills XML list | Skills prompt | ~1,250 | ~313 | 4 skills with name + description + location |
| **TOTAL per-turn** | | **~8,010** | **~2,003** | |

### NOT Injected Per-Turn

| Component | When Loaded | Chars | Tokens (est.) |
|-----------|-------------|-------|---------------|
| MEMORY.md | Main sessions only | ~1,500+ | ~375+ |
| BOOT.md | Gateway restart only | ~300 | ~75 |
| memory/*.md | On-demand via tools | Varies | Varies |
| Skill content (4 files) | On-demand via read | 26,502 total | ~6,625 total |

### Budget Assessment

The target of ~2,000 tokens for bootstrap files (AGENTS.md + SOUL.md + USER.md + IDENTITY.md + TOOLS.md) maps to ~8,000 characters at 4 chars/token. The recommended allocation totals ~6,700 characters (~1,675 tokens) for just the 5 bootstrap files, plus ~1,250 characters (~313 tokens) for the skills XML list, plus ~60 characters (~15 tokens) for HEARTBEAT.md. Grand total: ~8,010 characters / ~2,003 tokens.

**Verdict:** The budget is achievable with minimal headroom. If the actual tokenizer produces more tokens per character than the 4:1 estimate (possible with markdown formatting, headers, bullets), the files may need trimming. The safest approach is to aim for the lower end of each file's range and validate with `/context list` after deployment.

**Trim priorities (if over budget):**
1. TOOLS.md -- remove constraint notes (save ~200 chars)
2. AGENTS.md -- compress session protocol to fewer lines (save ~300 chars)
3. SOUL.md -- tighten prose (save ~200 chars)

## Sources

### Primary (HIGH confidence)

- `/home/NGA/openclaw/docs/concepts/agent-workspace.md` -- workspace file map, bootstrap injection, `bootstrapMaxChars` limits
- `/home/NGA/openclaw/docs/concepts/system-prompt.md` -- system prompt assembly, which files are injected per turn, sub-agent filtering
- `/home/NGA/openclaw/docs/tools/skills.md` -- SKILL.md format, YAML frontmatter fields, per-skill token cost formula, precedence rules
- `/home/NGA/.openclaw/workspace/` -- live main agent workspace (observed patterns: AGENTS.md 17,372 chars, SOUL.md 2,244 chars, USER.md 664 chars, IDENTITY.md 495 chars, TOOLS.md 1,985 chars)
- `/mnt/c/Projects/pricelabs-agent/openclaw/skills/` -- existing 4 skill files (26,502 chars total: domain-knowledge 6,124, monitoring-protocols 5,556, analysis-playbook 5,316, optimization-playbook 9,506)
- `/mnt/c/Projects/pricelabs-agent/openclaw/extensions/pricelabs/tool-definitions.json` -- complete 28-tool inventory with names verified

### Secondary (HIGH confidence)

- `/mnt/c/Projects/pricelabs-agent/.planning/research/FEATURES.md` -- workspace file sizing targets, observed char counts from 3 live agents
- `/mnt/c/Projects/pricelabs-agent/.planning/research/ARCHITECTURE.md` -- target workspace directory structure, skill migration plan
- `/mnt/c/Projects/pricelabs-agent/.planning/research/STACK.md` -- SKILL.md migration format, workspace directory layout
- `/mnt/c/Projects/pricelabs-agent/.planning/phases/11-workspace-brain/11-CONTEXT.md` -- locked user decisions for persona, content, and priorities
- `/mnt/c/Projects/pricelabs-agent/.planning/REQUIREMENTS.md` -- WORK-01 through WORK-09 requirements with char budgets

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- workspace file format and skill format verified against official OpenClaw docs on disk
- Architecture: HIGH -- token budget formula verified from skills.md docs; bootstrap injection behavior verified from system-prompt.md docs; live workspace patterns observed
- Pitfalls: HIGH -- file bloat and skill discovery issues are verified patterns from the main agent's 17,372-char AGENTS.md and the documented AgentSkills directory format

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- OpenClaw workspace contract is mature)
