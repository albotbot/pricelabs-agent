# Domain Pitfalls

**Domain:** AI Agent for STR Revenue Management (PriceLabs + OpenClaw)
**Researched:** 2026-02-22

This document catalogs pitfalls across three risk domains: (1) PriceLabs API integration, (2) OpenClaw platform security, and (3) STR revenue management logic. Pitfalls are ordered by severity within each tier. Each includes detection signals and which development phase should address it.

---

## Critical Pitfalls

Mistakes that cause financial loss, security breaches, or require architectural rewrites.

---

### Pitfall 1: DSO Overwrites All Safety Rails Including Min Price

**What goes wrong:** Date-Specific Overrides (DSOs) have the highest priority among ALL PriceLabs settings. When the agent writes a DSO with `price_type: "fixed"`, that price becomes the actual nightly rate regardless of the listing's minimum price floor. A DSO of $50 on a listing with a $150 minimum price will push $50 to Airbnb/Vrbo. The agent could inadvertently set prices far below profitability.

**Why it happens:** The API treats DSOs as explicit operator intent. There is no server-side guard that rejects a DSO price below the listing's configured minimum. The `price_type: "percent"` range of -75 to 500 means an agent could apply a -75% adjustment to a $200 base, yielding a $50 nightly rate.

**Consequences:** Live listing prices on Airbnb/Vrbo change immediately on next sync. Guests book at the erroneous rate. The host is contractually bound to honor the booking. Revenue loss is instantaneous and irreversible once a guest confirms.

**Prevention:**
1. Build a pre-write validation layer in the MCP server that fetches the listing's current `min` price before every DSO write.
2. Reject any DSO where the effective price (calculated from base and percentage, or the fixed value) falls below the listing's minimum price.
3. For percentage DSOs, compute the effective price: `base_price * (1 + percent/100)` and validate against min price.
4. Require human approval for ALL DSO writes -- never auto-execute.
5. Display the computed effective nightly rate in the approval prompt, not just the percentage.

**Detection:** Compare every proposed DSO price against `min` from GET /v1/listings/{id}. Alert if effective price < min price. Log all DSO writes with before/after snapshots.

**Phase:** Must be addressed in Phase 1 (MCP server foundation). The validation layer is a prerequisite for any write operation.

**Confidence:** HIGH -- sourced from PriceLabs API docs and project research (`research/02-api-reference.md` lines 206-209).

---

### Pitfall 2: Erroneous DSO Dates Silently Omitted

**What goes wrong:** When posting DSOs, dates that PriceLabs considers invalid (past dates, dates outside the sync window, malformed formats) are silently dropped from the response. The API returns 200 OK with only the valid dates, giving no error or warning about omitted dates. The agent believes all overrides were applied when some were not.

**Why it happens:** The PriceLabs API design favors partial success over strict validation. This is likely to support bulk operations where some dates might already be booked.

**Consequences:** The agent reports success to the user ("I've set overrides for March 15-22"), but only 5 of 8 dates were actually written. The user assumes their pricing strategy is in place for all dates. Revenue is unprotected on the silently dropped dates, and the pricing gap is invisible.

**Prevention:**
1. After every DSO POST, immediately GET the overrides for the same listing and date range.
2. Perform a reconciliation: compare requested dates against confirmed dates.
3. Report any discrepancies to the user explicitly: "7 of 8 dates confirmed. March 18 was not applied -- it may already be booked or outside the sync window."
4. Never report DSO writes as successful without post-write verification.

**Detection:** Implement a `verify_overrides()` function in the MCP server that runs after every DSO write. Count requested vs confirmed dates. Flag mismatches.

**Phase:** Must be addressed in Phase 1 (MCP server foundation). This is a fundamental API behavior that affects all override operations.

**Confidence:** HIGH -- documented in PriceLabs API reference: "Erroneous dates are silently omitted from response" (`research/02-api-reference.md` line 208).

---

### Pitfall 3: Currency Mismatch in Fixed DSOs Silently Fails

**What goes wrong:** When creating a DSO with `price_type: "fixed"`, the `currency` field must exactly match the PMS listing's currency. If a listing is priced in EUR and the agent sends a DSO with currency "USD" (or omits it), the override silently fails or applies the numeric value in the wrong currency context. There is no error returned.

**Why it happens:** PriceLabs imports currency from the connected PMS/Airbnb listing and does not allow currency changes. The API does not validate currency mismatches with an explicit error.

**Consequences:** A $200 override on a EUR listing could either fail silently (no price change) or apply 200 as EUR when USD was intended. Both outcomes are wrong and invisible to the agent.

**Prevention:**
1. Always fetch the listing's currency from GET /v1/listings/{id} before writing fixed-price DSOs.
2. Store listing currencies in a local cache (refreshed daily) to avoid redundant API calls.
3. The MCP server must enforce currency matching as a hard validation rule before any fixed-price DSO write.
4. When the user requests a price in one currency and the listing is in another, convert and show the user the effective rate in their listing's currency before seeking approval.

**Detection:** Include currency field in all DSO write logs. Cross-reference against listing currency on every write. Alert on mismatch before the API call is made.

**Phase:** Phase 1 (MCP server foundation). Currency validation is part of the same pre-write validation layer as Pitfall 1.

**Confidence:** HIGH -- referenced in PriceLabs API docs: "When price_type is fixed, currency must match PMS currency exactly" (`research/02-api-reference.md` line 207). Currency import issues confirmed via MotoPress forum and PriceLabs help docs.

---

### Pitfall 4: API Rate Limit Exhaustion With Multi-Listing Portfolios

**What goes wrong:** PriceLabs allows 1000 requests/hour. A portfolio health check for 50 listings requires at minimum: 50 (listing details) + 50 (listing prices) + 50 (neighborhood data) + 50 (overrides) = 200 requests. Add reservation data and you are at 250+. Two users running the agent simultaneously, or a daily workflow plus an ad-hoc query, can exhaust the limit. At 429 status, ALL operations fail including time-sensitive price updates.

**Why it happens:** AI agents make API calls far faster than human users clicking through a dashboard. A single natural language question like "How is my portfolio doing?" can trigger 100+ API calls within seconds. Traditional rate limiting assumes human-paced interaction.

**Consequences:** 429 errors block all API access for the remainder of the hour. Scheduled price syncs fail. Time-sensitive DSO writes for events are delayed. The user perceives the agent as broken.

**Prevention:**
1. Implement a request budget system in the MCP server: allocate requests per workflow type (e.g., portfolio scan: max 300/run, ad-hoc query: max 50/query, DSO write: reserved 100/hour).
2. Use a token bucket algorithm with 1000 tokens/hour, refilling at ~16.67 tokens/minute.
3. Batch operations: fetch all listings in one call (1 request) instead of per-listing calls.
4. Cache aggressively: listing metadata changes infrequently (cache 1 hour), neighborhood data changes daily (cache 6 hours), prices change on sync (cache until next sync cycle).
5. Implement exponential backoff on 429 responses: wait 60s, 120s, 240s.
6. Track remaining budget and warn the user: "Budget: 340/1000 requests remaining this hour. Full portfolio scan requires ~250 requests. Proceed?"

**Detection:** Log every API call with timestamp. Dashboard showing requests/hour with 80% threshold alert. Expose remaining budget to the agent's decision-making context.

**Phase:** Phase 1 (MCP server foundation). Rate limiting must be baked into the request layer from day one, not bolted on later.

**Confidence:** HIGH -- rate limit of 1000/hour confirmed in PriceLabs API docs. AI agent rate limit exhaustion patterns documented extensively in industry (Medium, Fast.io, OpenAI docs).

---

### Pitfall 5: OpenClaw API Key Exposure via Skills and Logs

**What goes wrong:** When the PriceLabs API key is passed to an OpenClaw skill, it enters the LLM's context window and can be logged in chat histories, exposed in skill outputs, or leaked through malicious skills. Snyk research found 283 skills (7.1% of ClawHub's registry) contained credential leaks. Some skills explicitly instruct agents to store credentials in MEMORY.md files as plaintext.

**Why it happens:** OpenClaw skills are markdown instructions processed by an LLM. Any credential mentioned in the instruction flow passes through the model's context. The openclaw.json config stores MCP server environment variables including API keys. If a malicious or poorly-written skill accesses the filesystem, it can read these credentials.

**Consequences:** PriceLabs API key theft allows an attacker to read all portfolio data (listing details, revenue, reservations) and write arbitrary price changes to live listings. With the key, an attacker can set $1 nightly rates across an entire portfolio.

**Prevention:**
1. Never pass the PriceLabs API key through skill instructions. Keep it exclusively in the MCP server's environment variables.
2. Configure the MCP server to handle all API authentication internally -- skills request actions, the MCP server authenticates.
3. Use OpenClaw's credential isolation: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` for per-agent credentials.
4. Set filesystem permissions: `chmod 600 ~/.openclaw/openclaw.json` and `chmod 700 ~/.openclaw/`.
5. Enable log redaction: `logging.redactSensitive: "tools"` and add `redactPatterns: ["api[_-]?key", "X-API-Key", "pricelabs"]`.
6. Run `openclaw security audit --deep` regularly to detect credential exposure.
7. Install only verified skills. Audit any custom skills for credential handling patterns.
8. Run `mcp-scan` to audit installed skills for credential leak patterns (per Snyk recommendation).

**Detection:** Regular `openclaw security audit` runs. Monitor logs for API key patterns. Set up alerts for unexpected API usage patterns (requests from unfamiliar IPs if PriceLabs provides such logging).

**Phase:** Phase 1 (infrastructure setup). Security architecture must be established before any credentials are configured.

**Confidence:** HIGH -- Snyk research (Feb 2026) documented 283 leaky skills. OpenClaw official security docs confirm credential management patterns. CVE-2026-25253 demonstrates real exploitation paths.

---

### Pitfall 6: MCP Server Runs With Full System Access

**What goes wrong:** By default, OpenClaw MCP servers execute with the same permissions as the OpenClaw process. A PriceLabs MCP server that handles API calls also has access to the filesystem, network, and any other resources available to the process owner. A prompt injection attack or malicious skill could instruct the MCP server to perform unintended operations.

**Why it happens:** MCP protocol does not inherently sandbox server processes. OpenClaw's "lethal trifecta" (identified by Simon Willison): access to private data + exposure to untrusted content + ability to communicate externally = vulnerable by design.

**Consequences:** A compromised or manipulated MCP server could exfiltrate credentials, modify system files, make unauthorized network requests, or pivot to other services running on the same host.

**Prevention:**
1. Run OpenClaw in Docker with sandbox mode enabled:
   ```json
   {
     "agents": {
       "defaults": {
         "sandbox": {
           "mode": "docker",
           "scope": "agent",
           "workspaceAccess": "none"
         }
       }
     }
   }
   ```
2. Use tool allowlists to restrict the PriceLabs agent to only the tools it needs:
   ```json
   {
     "tools": {
       "profile": "messaging",
       "allow": ["read", "mcp_pricelabs"],
       "deny": ["exec", "write", "browser", "cron", "gateway"]
     }
   }
   ```
3. Bind the gateway to loopback only: `gateway.bind: "loopback"`.
4. Enable gateway authentication: `gateway.auth.mode: "token"`.
5. Deny shell execution: `tools.exec.security: "deny"`.
6. Disable elevated mode: `tools.elevated.enabled: false`.

**Detection:** Run `openclaw security audit --deep` after every configuration change. Monitor Docker container resource usage for anomalies. Check tool invocation logs for unexpected tool calls.

**Phase:** Phase 1 (infrastructure setup). Container isolation and tool restriction must be the first configuration step.

**Confidence:** HIGH -- OpenClaw official security documentation provides these exact configurations. Multiple security vendors (Cisco, CrowdStrike, Trend Micro, Kaspersky) have published analyses of these attack vectors in Jan-Feb 2026.

---

### Pitfall 7: No Undo for API Write Operations

**What goes wrong:** PriceLabs API write operations (POST /v1/listings for base/min/max price changes, POST overrides for DSOs) take effect on the next sync cycle and propagate to live OTA listings. There is no "undo" endpoint, no transaction rollback, no versioning of previous values. Once a price change syncs to Airbnb/Vrbo, reversing it requires another API call and another sync cycle (which runs nightly 6pm-6am Chicago time).

**Why it happens:** PriceLabs is designed for human operators who review changes in the dashboard before syncing. The API was added for programmatic access but inherits the same one-way write model.

**Consequences:** An agent error that sets wrong prices could be live for up to 12 hours before the next sync corrects it. During peak booking periods, even a few hours of wrong pricing can result in multiple bookings at incorrect rates.

**Prevention:**
1. Implement a local state store that snapshots the current values before every write operation.
2. Store: `{listing_id, field, old_value, new_value, timestamp, approval_id}` for every change.
3. Build a "rollback" capability that reads the snapshot and writes the old values back.
4. Implement a mandatory confirmation delay: after user approval, wait 5 minutes before executing, with a cancel option. This provides a buffer against accidental approvals.
5. For DSOs, always store the full set of existing overrides before modification so they can be restored.
6. Consider triggering `POST /v1/push_prices` immediately after critical corrections rather than waiting for the nightly sync.

**Detection:** Maintain an audit log of all write operations. Provide a "recent changes" command that shows all modifications in the last 24 hours with rollback options.

**Phase:** Phase 2 (core agent logic). The snapshot/rollback system should be built alongside the first write operations.

**Confidence:** HIGH -- confirmed from API docs that there is no undo endpoint. Sync timing from algorithm docs (`research/05-algorithm-and-settings.md` line 29).

---

## Moderate Pitfalls

Mistakes that degrade agent quality, user trust, or require significant rework.

---

### Pitfall 8: Agent Recommends Base Price Changes Too Frequently

**What goes wrong:** The agent detects a slow week and recommends lowering the base price. The host approves. Next week picks up, agent recommends raising it. This "base price yo-yo" creates noise, confuses the algorithm, and trains the host to distrust the agent.

**Why it happens:** The PriceLabs algorithm already handles short-term demand fluctuations through its customizations (last-minute discounts, occupancy-based adjustments). Base price is meant to be a stable anchor adjusted monthly at most. An AI agent analyzing daily data will see patterns that feel actionable but should be left to the algorithm.

**Consequences:** Frequent base price changes undermine the algorithm's effectiveness. The host loses confidence in the agent. Revenue actually decreases because the algorithm cannot establish stable baseline patterns.

**Prevention:**
1. Enforce a minimum 30-day interval between base price change recommendations.
2. Require consistent under/overperformance over 30+ days before suggesting a change (per PriceLabs best practice).
3. Compare against `recommended_base_price` from the API -- only recommend changes when the delta exceeds 10%.
4. Frame recommendations using neighborhood data percentiles, not short-term occupancy swings.
5. Hard-code this rule: "Never recommend base price changes in response to a single slow week."

**Detection:** Track base price change frequency per listing. Alert if agent recommends more than one base price change per listing per month.

**Phase:** Phase 3 (optimization intelligence). This is a logic design decision for the recommendation engine.

**Confidence:** HIGH -- PriceLabs optimization playbook and community consensus: "Only adjust when consistently under/overperforming over 30+ days" (`research/03-optimization-playbook.md` lines 55-58).

---

### Pitfall 9: Panic Pricing Recommendations (Race to the Bottom)

**What goes wrong:** Agent sees low occupancy 30-60 days out and recommends aggressive discounting. Host approves multiple price drops. Competitors see lower prices and drop theirs. The market enters a downward spiral. The host fills dates at rates below profitability.

**Why it happens:** Occupancy-based reasoning without context. The agent compares your occupancy to market average but does not factor in booking lead time patterns for your market. A beach house 45 days out may look "underbooked" but is normal for that market type.

**Consequences:** Revenue per booking drops below cleaning + operating costs. Adjacent dates are devalued. The host's listing becomes associated with low rates, attracting less desirable guests and reducing review quality.

**Prevention:**
1. Always contextualize occupancy against market benchmarks AND same-time-last-year (STLY) data.
2. Implement market-type-aware lead time expectations: urban (7-14 days), beach (30-45 days), luxury (60-90 days).
3. Use occupancy-based adjustments (already built into PriceLabs) for gradual changes instead of recommending manual price cuts.
4. Set a hard floor: never recommend a nightly rate below the listing's `min` price, and never recommend lowering `min` price by more than 10% in a single change.
5. Show the user what last year's bookings looked like at this time before recommending cuts.

**Detection:** Track the direction and magnitude of all price recommendations. Alert if the agent has recommended more than 3 price decreases in a row for the same listing without an intervening increase.

**Phase:** Phase 3 (optimization intelligence). This is core recommendation logic.

**Confidence:** HIGH -- documented as the most common STR pricing mistake across PriceLabs blog, community forums, and industry sources.

---

### Pitfall 10: Orphan Day Creation Through DSO Min-Stay Settings

**What goes wrong:** The agent sets a DSO with a `min_stay` of 3 on a date that has bookings on either side, creating a 2-night gap that cannot be filled because of the 3-night minimum. The DSO's min-stay overrides PriceLabs' orphan day management, which normally would have reduced the min-stay to fill the gap.

**Why it happens:** DSOs override ALL other settings including orphan day rules. PriceLabs' documentation explicitly states: "Orphan Min-Stay settings do not reduce the minimum stay when a Date-Specific Override is in place." The agent does not check surrounding booking context before setting min-stay.

**Consequences:** Revenue-producing dates become unbookable. The orphan gap widens. This is invisible until the dates pass unbooked.

**Prevention:**
1. Before setting any DSO min-stay, check the surrounding 7-day booking context using GET /v1/listing_prices (check `booking_status` for adjacent dates).
2. Never set DSO min-stay that would create an unfillable gap between existing bookings.
3. Implement gap detection: if a DSO min-stay would leave fewer available nights than the min-stay value between two booked periods, reject or warn.
4. Prefer letting PriceLabs' built-in orphan management handle min-stay adjustments rather than setting explicit DSO min-stays.

**Detection:** After every DSO write with min-stay, scan the surrounding calendar for newly created orphan gaps. Alert the user if gaps are detected.

**Phase:** Phase 3 (optimization intelligence). Requires calendar-aware logic built on top of the MCP read operations.

**Confidence:** HIGH -- confirmed in PriceLabs help docs and algorithm settings reference (`research/05-algorithm-and-settings.md` lines 58-63).

---

### Pitfall 11: Dual Pricing Conflicts With PMS Dynamic Pricing

**What goes wrong:** The host uses Hostaway, OwnerRez, or Guesty as their PMS. These systems have their own dynamic pricing rules, gap rules, or min-stay rules. When both PriceLabs and the PMS are pushing prices, they conflict. Prices oscillate between two systems, creating unpredictable rates for guests.

**Why it happens:** The agent does not know (and cannot query via the PriceLabs API) whether the host's PMS has its own pricing rules enabled. PriceLabs pushes prices to the PMS, but if the PMS overrides them with its own rules, the final guest-facing price differs from what PriceLabs intended.

**Consequences:** Prices on OTAs do not match what PriceLabs shows. Host sees different prices in PriceLabs dashboard vs. Airbnb. Trust in both systems erodes. Revenue optimization fails because neither system has full control.

**Prevention:**
1. During onboarding, explicitly ask the user which PMS they use and warn about known conflicts.
2. Maintain a known-conflicts database:
   - Hostaway: must disable Hostaway Dynamic Pricing before using PriceLabs.
   - OwnerRez: gap rules must be configured in one system only, not both.
   - Guesty: API key expires after 4 hours during setup.
3. Include a PMS conflict check in the portfolio health workflow.
4. If the agent detects price mismatches between PriceLabs prices and actual booking prices (from reservation data), flag a possible PMS conflict.

**Detection:** Compare `user_price` from listing_prices endpoint against `rental_revenue / no_of_days` from reservation_data. Consistent discrepancies indicate PMS interference.

**Phase:** Phase 2 (core agent logic). PMS awareness should be part of the onboarding flow.

**Confidence:** HIGH -- documented conflicts with specific PMS providers in `research/07-common-mistakes.md` lines 50-64.

---

### Pitfall 12: Human-in-the-Loop Approval Fatigue

**What goes wrong:** The agent surfaces 15 recommendations daily across a 50-listing portfolio. The host starts rubber-stamping approvals without reading them. Alternatively, the host stops responding entirely and the agent's recommendations pile up unapproved, becoming stale.

**Why it happens:** The project mandates human approval for ALL pricing changes (correct for safety). But if the approval interface generates too many low-value prompts, users either approve everything blindly (defeating the purpose) or disengage entirely.

**Consequences:** Blind approval negates the safety benefit -- might as well be autonomous. Disengagement means no pricing optimization happens at all.

**Prevention:**
1. Batch recommendations: instead of 15 individual prompts, send one daily digest with all recommendations grouped by priority (critical / recommended / optional).
2. Implement tiered approval: low-risk changes (DSOs within 10% of algorithm suggestion) could be auto-approved with notification. High-risk changes (base price, large DSOs, min price) always require explicit approval.
3. Set approval expiry: recommendations older than 48 hours expire and are recalculated. Do not let stale recommendations accumulate.
4. Track approval patterns: if a user approves 100% of recommendations for 30 days, suggest enabling auto-approval for low-risk categories.
5. Provide one-tap "approve all recommended" for the daily digest with individual override capability.

**Detection:** Track approval rate, response time, and staleness. Alert if average response time exceeds 24 hours or if approval rate is consistently 100% (likely rubber-stamping).

**Phase:** Phase 3 (messaging and UX). Approval workflow design is a UX problem, not just a safety mechanism.

**Confidence:** MEDIUM -- pattern well-documented in HITL literature (Permit.io, Vellum, enterprise AI guides). Specific application to this project requires validation with real user behavior.

---

### Pitfall 13: Stale Cache Causing Incorrect Recommendations

**What goes wrong:** The agent caches listing data and neighborhood data to stay within rate limits. A host makes manual changes in the PriceLabs dashboard (adjusts base price, adds DSOs, changes settings). The agent's cache does not reflect these changes and makes recommendations based on outdated state.

**Why it happens:** PriceLabs has no webhook or push notification system for the Customer API. The only way to detect changes is to poll endpoints. Aggressive caching (necessary for rate limiting) creates a staleness window.

**Consequences:** Agent recommends a base price increase when the host already increased it 2 hours ago. Agent sets a DSO on a date that the host already manually overrode. Duplicate or conflicting changes erode trust.

**Prevention:**
1. Cache with awareness: before any write operation, always fetch fresh data for the specific listing being modified (1 API call, worth the budget).
2. Use `last_refreshed_at` and `last_date_pushed` timestamps to detect changes since last cache refresh.
3. Implement a daily full cache refresh during off-peak hours (early morning, when the 1000/hour budget is least constrained).
4. When displaying cached data, show the cache age: "Data as of 3 hours ago. Refresh?"
5. Before presenting recommendations, compare cached values with a fresh single-listing fetch to detect drift.

**Detection:** Log cache hit/miss rates. Track recommendations that were presented to users but based on data more than 6 hours old. Compare cached vs fresh data periodically and report drift percentage.

**Phase:** Phase 2 (core agent logic). Cache strategy is part of the data layer design.

**Confidence:** MEDIUM -- no webhook support confirmed from API docs (no webhook endpoints in Customer API). Cache invalidation strategy is inference-based.

---

## Minor Pitfalls

Issues that cause friction but are straightforward to fix.

---

### Pitfall 14: Wrong Airbnb Fee Calculation in Revenue Projections

**What goes wrong:** The agent calculates projected revenue by adding 15.5% to cover Airbnb's host fee, but the math is wrong. The fee is calculated on the marked-up price, not the original price, so the required markup is actually lower (approximately 13.4% to net 15.5%).

**Prevention:** Use the actual Airbnb fee formula: `net = gross * (1 - fee_rate)` and `required_gross = target_net / (1 - fee_rate)`. Never use simple percentage addition. Fetch actual fee rates from reservation data where available.

**Phase:** Phase 3 (optimization intelligence).

**Confidence:** HIGH -- documented in `research/07-common-mistakes.md` lines 33-35.

---

### Pitfall 15: Inconsistent Pricing in Weekly-Stay Markets

**What goes wrong:** In beach/resort markets, guests expect consistent weekly rates (e.g., $250/night all week). PriceLabs sets different prices each day ($230 Mon, $260 Wed, $280 Fri). This confuses guests and may reduce bookings in markets where weekly consistency is expected.

**Prevention:** Detect market type during onboarding. For weekly-stay markets, recommend seasonal profiles with stable pricing rather than daily dynamic adjustments. Use DSOs for consistent weekly blocks when appropriate.

**Phase:** Phase 3 (optimization intelligence).

**Confidence:** HIGH -- documented in `research/07-common-mistakes.md` lines 38-39.

---

### Pitfall 16: Thin Market Data Leading to Bad Recommendations

**What goes wrong:** In rural or unique markets, PriceLabs may have fewer than 50 comparable listings (against its ideal of 350). The neighborhood data becomes unreliable, and agent recommendations based on this data are misleading.

**Prevention:** Check the `Listings Used` field in neighborhood data responses. If below 100, flag the data as low-confidence and tell the user: "Your market has limited comparison data (N listings). Recommendations should be cross-checked manually." Prefer STLY data over market comparisons in thin markets.

**Phase:** Phase 3 (optimization intelligence).

**Confidence:** MEDIUM -- thin market issues documented in user complaints (`research/07-common-mistakes.md` lines 89-91) but specific threshold of 100 is an estimate.

---

### Pitfall 17: Sync Timing Misunderstanding

**What goes wrong:** The agent writes a DSO and tells the user "Done! Your prices are updated." But PriceLabs syncs prices nightly between 6pm-6am Chicago time. The actual OTA listing will not reflect the change until the next sync cycle, which could be hours away.

**Prevention:** After any write operation, include the sync timing caveat: "Override saved to PriceLabs. It will sync to Airbnb during the next cycle (nightly 6pm-6am CT). For immediate sync, I can trigger a manual push." Offer to call POST /v1/push_prices for urgent changes.

**Phase:** Phase 2 (core agent logic).

**Confidence:** HIGH -- sync timing documented in `research/05-algorithm-and-settings.md` lines 29-31.

---

### Pitfall 18: OpenClaw Prompt Injection via Messaging Channels

**What goes wrong:** Since the agent is accessible via Slack and Telegram, an attacker in a shared Slack channel or Telegram group could craft a message that causes the agent to perform unintended actions (read competitor data, change prices, exfiltrate information).

**Prevention:**
1. Use `requireMention: true` for all group channels.
2. Implement per-channel allowlists via `dmPolicy: "allowlist"` or `dmPolicy: "pairing"`.
3. Use `session.dmScope: "per-channel-peer"` to prevent cross-user context leakage.
4. Never include pricing data or API responses in group channels -- only in DMs with verified users.
5. Use Opus 4.6 which has stronger prompt injection resistance.

**Phase:** Phase 1 (infrastructure setup). Channel security must be configured before the agent is deployed.

**Confidence:** HIGH -- OpenClaw official security docs provide these exact configurations. Giskard research (Jan 2026) demonstrated prompt injection attacks on OpenClaw deployments.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: MCP Server Foundation | Rate limit exhaustion during development/testing | Use a separate API key for dev. Implement rate limiting from the first line of code. |
| Phase 1: MCP Server Foundation | API key hardcoded in source or committed to git | Use .env files, add to .gitignore immediately. Never log API keys. |
| Phase 1: Infrastructure Setup | OpenClaw running without Docker sandbox | Start with Docker isolation from day one. Do not defer security hardening. |
| Phase 1: Infrastructure Setup | Default OpenClaw config exposes gateway to network | Set `gateway.bind: "loopback"` and enable token auth before first run. |
| Phase 2: Core Agent Logic | Agent treats all listings identically | Listings differ by market type, size, and performance tier. Build listing-context-aware logic. |
| Phase 2: Core Agent Logic | No state persistence between sessions | OpenClaw has no built-in state beyond session history. Design explicit state storage (file-based or database) for cache, audit logs, and approval state. |
| Phase 3: Optimization Intelligence | Algorithm second-guessing PriceLabs | The agent should augment PriceLabs' algorithm with strategic recommendations (base price, DSOs, events), NOT override daily price calculations. |
| Phase 3: Optimization Intelligence | Recommending changes for booked dates | Always check `booking_status` before recommending price changes. Booked dates cannot have their prices changed. |
| Phase 3: Messaging UX | Approval message formatting differs between Slack and Telegram | Design approval messages that render correctly on both platforms. Test formatting on both before launch. |
| Phase 4: Multi-User Scaling | Shared API key across users | Each user needs their own PriceLabs API key. Per-agent credential isolation via OpenClaw auth profiles. |
| Phase 4: Multi-User Scaling | One user's session seeing another user's data | Enforce `session.dmScope: "per-channel-peer"` and never share listing data across sessions. |

---

## Pre-Flight Checklist for Every Write Operation

Before the agent executes ANY PriceLabs API write, this sequence must complete:

1. **Fresh data fetch** -- GET current state for the specific listing (1 API call)
2. **Validation** -- Check min/max price bounds, currency match, date validity, booking status
3. **Impact calculation** -- Compute the effective nightly rate and show it to the user
4. **Human approval** -- Present the change with before/after comparison; wait for explicit "yes"
5. **Execute** -- Make the API call
6. **Verify** -- GET the state again to confirm the change applied (especially for DSOs)
7. **Log** -- Record old value, new value, timestamp, approval reference, verification result
8. **Report** -- Tell the user the confirmed result with sync timing caveat

Any step that fails should abort the operation and notify the user.

---

## Sources

### PriceLabs API and Domain
- [PriceLabs Customer API Documentation](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api) -- HIGH confidence
- [PriceLabs API SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) -- HIGH confidence
- [PriceLabs Common Pricing Mistakes](https://hello.pricelabs.co/common-pricing-mistakes-airbnb-vacation-rental-owners-make/) -- HIGH confidence
- [Top 6 PriceLabs Mistakes (MyPerfectHost)](https://www.myperfecthost.com/blog/how-to-fix-the-biggest-short-term-rental-pricing-mistakes-using-pricelabs) -- MEDIUM confidence
- [PriceLabs Revenue Management Strategy 2026](https://hello.pricelabs.co/blog/revenue-management-strategy/) -- MEDIUM confidence
- [MotoPress API Currency Issue](https://motopress.com/forums/topic/api-issue-pricelabs-eur-currency-not-recognized-by-the-plugin/) -- MEDIUM confidence
- Project research: `research/02-api-reference.md`, `research/03-optimization-playbook.md`, `research/05-algorithm-and-settings.md`, `research/07-common-mistakes.md` -- HIGH confidence

### OpenClaw Security
- [OpenClaw Official Security Documentation](https://docs.openclaw.ai/gateway/security) -- HIGH confidence
- [Snyk: 280+ Leaky Skills in ClawHub](https://snyk.io/blog/openclaw-skills-credential-leaks-research/) -- HIGH confidence
- [Cisco: Personal AI Agents Are a Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare) -- HIGH confidence
- [CrowdStrike: OpenClaw AI Super Agent Security](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/) -- HIGH confidence
- [Kaspersky: OpenClaw Vulnerabilities](https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/) -- HIGH confidence
- [VentureBeat: OpenClaw Security Model](https://venturebeat.com/security/openclaw-agentic-ai-security-risk-ciso-guide) -- MEDIUM confidence
- [Giskard: OpenClaw Data Leakage and Prompt Injection](https://www.giskard.ai/knowledge/openclaw-security-vulnerabilities-include-data-leakage-and-prompt-injection-risks) -- MEDIUM confidence
- [Microsoft: Running OpenClaw Safely](https://www.microsoft.com/en-us/security/blog/2026/02/19/running-openclaw-safely-identity-isolation-runtime-risk/) -- HIGH confidence

### AI Agent Patterns
- [Permit.io: Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) -- MEDIUM confidence
- [OWASP AI Agent Security Top 10 (2026)](https://medium.com/@oracle_43885/owasps-ai-agent-security-top-10-agent-security-risks-2026-fc5c435e86eb) -- MEDIUM confidence
- [Guardrails-by-Construction Approach](https://micheallanham.substack.com/p/transitioning-to-guardrails-by-construction) -- MEDIUM confidence
- [Vellum: 2026 Guide to AI Agent Workflows](https://www.vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns) -- MEDIUM confidence
