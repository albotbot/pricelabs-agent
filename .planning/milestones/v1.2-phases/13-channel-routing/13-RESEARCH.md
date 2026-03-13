# Phase 13: Channel Routing - Research

**Researched:** 2026-02-27
**Domain:** OpenClaw multi-account Telegram migration + Slack peer-channel routing for dedicated PriceLabs agent
**Confidence:** HIGH

## Summary

Phase 13 routes two dedicated messaging channels to the PriceLabs agent (Prism): a new Telegram bot (@Prism_Price_Bot) and a dedicated #pricelabs Slack channel. The existing AlBot messaging on Telegram and Slack must continue completely unaffected.

The highest-risk operation is the Telegram flat-to-multi-account migration. The live config currently uses a top-level `channels.telegram.botToken` (single-account format). Multi-account requires restructuring to `channels.telegram.accounts` with named account objects. This is a BREAKING config shape change -- if done wrong, AlBot loses Telegram connectivity. The documented pattern from OpenClaw's multi-agent docs and configuration reference is clear: move the existing token to `accounts.default`, verify AlBot still works, then add `accounts.pricelabs` with the new bot token. Base channel settings (like `streaming`, `groupPolicy`) remain at the top level and apply to all accounts unless overridden per-account.

The Slack routing is lower-risk: a single Slack app with peer-channel binding routes the #pricelabs channel to the pricelabs agent. No Slack config restructuring needed -- just add the channel to the allowlist and create a binding.

Both routes require a `bindings[]` array in openclaw.json (currently absent). Bindings are deterministic: accountId matches route Telegram, peer matches route Slack. The default agent catches everything else.

**Primary recommendation:** Migrate Telegram to multi-account format first (high risk), verify AlBot, then add Prism bot and binding. Add Slack channel binding second (low risk). Back up openclaw.json before every change. Restart gateway after each change. Use `openclaw channels status --probe` and test messages to verify after each step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bot name: **Prism**, username: **@Prism_Price_Bot**
- Bot token: `7965547116:AAH6yVXqEeZogHDPbQPsjgTja3H6CEQwxV4`
- Bot already created via BotFather -- no manual step needed during execution
- Slack channel name: **#pricelabs**, public visibility
- Topic/description: "PriceLabs pricing & occupancy reports"
- User will create the Slack channel manually before execution -- no Slack API automation needed
- Ensure the Slack bot/app is invited to #pricelabs so it can read/post there
- Telegram: Same user access as AlBot -- Beau, Jonas, Elle, Jey can all message @Prism_Price_Bot
- Slack: Open to everyone in workspace (public channel) -- no restricted membership
- Off-topic behavior: Prism responds briefly to off-topic questions but steers back to portfolio topics
- Telegram flat-to-multi-account migration is a BREAKING config change
- Must migrate existing AlBot bot to multi-account format FIRST, verify it still works, THEN add Prism bot
- Back up openclaw.json before every config change
- Gateway restart: `sudo systemctl restart openclaw-gateway.service` (system-level only)
- If AlBot stops working after migration, restore backup immediately
- Wait ~30 seconds after restart for Telegram rate limit cooldown
- Config changes must be append/merge only -- never replace the full config file
- The post-recovery state has 12 agents in openclaw.json -- config is fragile, treat every edit as high-risk

### Claude's Discretion
- Exact Telegram multi-account config structure (research will determine the format)
- Slack binding pattern (peer-channel routing vs other approaches)
- Order of operations for migration steps
- Whether to add Telegram user allowlist in config or let it be open

### Deferred Ideas (OUT OF SCOPE)
- Telegram bot avatar/profile picture -- can be set later via BotFather `/setuserpic`
- Telegram bot /start welcome message -- can be configured after routing works
- Slack app-level customization (custom bot name/avatar per channel) -- future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAN-01 | Telegram config migrated from flat `botToken` to multi-account format (`channels.telegram.accounts`) without breaking existing main agent bot | Multi-account Telegram pattern verified in OpenClaw docs (multi-agent.md, configuration-reference.md). Exact config structure documented below. Top-level settings persist; only `botToken` moves into `accounts.default`. |
| CHAN-02 | Dedicated PriceLabs Telegram bot created via BotFather and connected as second account in OpenClaw | Bot already created (@Prism_Price_Bot, token provided). Add as `accounts.pricelabs` with `dmPolicy: "pairing"`. |
| CHAN-03 | Telegram binding routes messages from PriceLabs bot to pricelabs agent (accountId-based routing) | Binding pattern: `{ agentId: "pricelabs", match: { channel: "telegram", accountId: "pricelabs" } }`. AccountId match is tier 6 in routing precedence. Verified in configuration-reference.md. |
| CHAN-04 | Dedicated #pricelabs Slack channel created and added to channel allowlist | User creates channel manually. Config adds `channels.slack.channels.C_PRICELABS: { allow: true, requireMention: false }`. Channel ID obtained after creation. |
| CHAN-05 | Slack binding routes messages in #pricelabs channel to pricelabs agent (peer-channel routing) | Binding pattern: `{ agentId: "pricelabs", match: { channel: "slack", peer: { kind: "channel", id: "C_PRICELABS" } } }`. Peer match is tier 1 (highest priority) in routing. Verified in multi-agent.md and configuration-reference.md. |
| CHAN-06 | Main agent messaging unaffected -- existing Telegram bot and Slack channels continue routing to main agent | Default agent fallback handles this. AlBot is `default: true` in agents.list. Messages not matching any binding route to default agent. No explicit binding needed for main agent on existing channels. |
</phase_requirements>

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| OpenClaw Gateway | v2026.2.25 (deployed) | Multi-agent runtime with channel accounts and bindings | Already running with 12 agents. Multi-account channels documented since v2026.1.6. |
| OpenClaw `bindings[]` | N/A (JSON config) | Route inbound messages to specific agents by channel, accountId, or peer | First-class routing primitive. Deterministic match order documented. Currently absent from live config -- must be added. |
| OpenClaw `channels.telegram.accounts` | N/A (JSON config) | Multi-bot Telegram with named account objects | Documented pattern in multi-agent.md with exact Telegram example. |
| OpenClaw `channels.slack.channels` | N/A (JSON config) | Slack channel allowlist with per-channel controls | Already has 2 channels configured. Add #pricelabs with `requireMention: false`. |
| OpenClaw CLI (`openclaw channels status`, `openclaw agents list`) | v2026.2.25 | Verify channel connectivity and routing | `--probe` flag validates bot connections. `--bindings` shows routing table. |

### Supporting

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `sudo systemctl restart openclaw-gateway.service` | systemd | Gateway restart (system-level service) | After every config change. User decision: system-level restart only. |
| `openclaw channels status --probe` | CLI | Verify Telegram/Slack bot connections | After each migration step to confirm channels are online. |
| `openclaw agents list --bindings` | CLI | Verify routing table | After adding bindings to confirm agent routing. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Peer-channel binding for Slack | teamId binding | TeamId routes ALL Slack messages to one agent. Peer binding is surgical -- only #pricelabs routes to Prism. TeamId would break other Slack channels. |
| accountId binding for Telegram | Peer binding per Telegram user | AccountId is cleaner: one bot = one agent. Peer binding would require maintaining user ID lists. |
| `dmPolicy: "pairing"` for Prism bot | `dmPolicy: "open"` | Pairing requires first-time approval. Safer. User wants same access as AlBot -- approved users can DM both bots. |
| Keeping top-level `botToken` alongside `accounts` | Pure multi-account format | Undefined behavior. Docs say env fallback `TELEGRAM_BOT_TOKEN` applies only to default account. Mixed flat+accounts format is not documented and risky. |

**Installation:**
No new packages. This phase is entirely JSON configuration changes and gateway restarts.

## Architecture Patterns

### Current Live Telegram Config (Single-Account)

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
      "groupPolicy": "allowlist",
      "streaming": "partial"
    }
  }
}
```

### Target Telegram Config (Multi-Account)

```json5
{
  "channels": {
    "telegram": {
      "enabled": true,
      "groupPolicy": "allowlist",
      "streaming": "partial",
      // Top-level botToken REMOVED -- moved into accounts.default
      // Top-level dmPolicy REMOVED -- moved into accounts.default
      "accounts": {
        "default": {
          "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
          "dmPolicy": "pairing"
        },
        "pricelabs": {
          "botToken": "7965547116:AAH6yVXqEeZogHDPbQPsjgTja3H6CEQwxV4",
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

**Source:** OpenClaw docs `/concepts/multi-agent.md` Telegram bots per agent example, `/gateway/configuration-reference.md` Multi-account section.

**Key rules from docs:**
- `default` is used when `accountId` is omitted (CLI + routing)
- Env tokens (`TELEGRAM_BOT_TOKEN`) only apply to the **default** account
- Base channel settings (`streaming`, `groupPolicy`, `enabled`) apply to all accounts unless overridden per account
- Per-account overrides supported: `botToken`, `dmPolicy`, `allowFrom`, `capabilities`, `ackReaction`

### Pattern 1: Telegram Multi-Account Migration (Two-Phase)

**What:** Safely migrate from flat to multi-account Telegram config without disruption.
**When to use:** Any time you need to add a second Telegram bot to an existing gateway.

**Phase A -- Restructure only (no new bot yet):**
1. Back up `openclaw.json`
2. Remove `botToken` and `dmPolicy` from `channels.telegram` top level
3. Add `accounts.default` with the existing bot token and dmPolicy
4. Keep all other top-level settings (`enabled`, `groupPolicy`, `streaming`)
5. Restart gateway
6. Verify AlBot still responds on Telegram (DM the existing bot)
7. Run `openclaw channels status --probe` to confirm Telegram connected

**Phase B -- Add the new bot:**
1. Back up `openclaw.json` (again)
2. Add `accounts.pricelabs` with the Prism bot token
3. Add `bindings[]` array with Telegram accountId binding
4. Restart gateway
5. Verify both bots connect: `openclaw channels status --probe`
6. Test: DM @Prism_Price_Bot, verify Prism persona responds
7. Verify: DM existing bot, verify AlBot still works

**Source:** Synthesized from multi-agent.md Telegram example + PITFALLS.md Pitfall #3.

### Pattern 2: Slack Peer-Channel Binding

**What:** Route a specific Slack channel to a dedicated agent using peer binding.
**When to use:** When multiple agents share one Slack app but own different channels.

```json5
{
  "channels": {
    "slack": {
      // ... existing config unchanged ...
      "channels": {
        "C0AF9MXD0ER": { "allow": true, "requireMention": true, "allowBots": true },
        "C0AG7FJNKNC": { "allow": true, "requireMention": true, "allowBots": true },
        "C_PRICELABS_ID": { "allow": true, "requireMention": false, "allowBots": true }
      }
    }
  },
  "bindings": [
    {
      "agentId": "pricelabs",
      "match": { "channel": "slack", "peer": { "kind": "channel", "id": "C_PRICELABS_ID" } }
    }
  ]
}
```

**Key detail:** `requireMention: false` in the #pricelabs channel means Prism responds to every message without needing `@mention`. This is correct for a dedicated agent channel.

**Source:** OpenClaw docs `/channels/channel-routing.md` routing rules, `/concepts/multi-agent.md` binding examples.

### Pattern 3: Bindings Array (Currently Absent)

**What:** The `bindings[]` top-level array in openclaw.json that routes inbound messages to agents.
**Current state:** The live config has NO `bindings` key at all. All messages currently route to the default agent (AlBot, `"default": true`).
**Target state:** Add `bindings[]` with entries for both Telegram and Slack.

```json5
{
  "bindings": [
    // Slack peer binding (tier 1 -- highest priority)
    {
      "agentId": "pricelabs",
      "match": { "channel": "slack", "peer": { "kind": "channel", "id": "C_PRICELABS_ID" } }
    },
    // Telegram account binding (tier 6)
    {
      "agentId": "pricelabs",
      "match": { "channel": "telegram", "accountId": "pricelabs" }
    }
    // No binding needed for main agent -- default fallback handles it
  ]
}
```

**Routing precedence (from docs):**
1. `match.peer` (exact DM/group/channel id) -- Slack #pricelabs routes here
2. `match.parentPeer` (thread inheritance)
3. `match.guildId + roles` (Discord)
4. `match.guildId` (Discord)
5. `match.teamId` (Slack)
6. `match.accountId` (exact) -- Telegram pricelabs routes here
7. `match.accountId: "*"` (channel-wide)
8. Default agent -- AlBot catches everything else

**Source:** `/gateway/configuration-reference.md` Binding match fields section.

### Pattern 4: Session Key Impact

**What:** Adding multi-account Telegram changes session key structure.
**Current dmScope:** `"per-channel-peer"` (from live config `session.dmScope`).
**With multi-account:** Session keys become `agent:<agentId>:telegram:dm:<userId>`. The docs recommend `per-account-channel-peer` for multi-account setups, which produces `agent:<agentId>:telegram:<accountId>:dm:<userId>`.
**Recommendation:** Keep `per-channel-peer` initially. Only switch to `per-account-channel-peer` if session isolation issues arise. The binding routes messages to the correct agent regardless of dmScope; dmScope only affects whether the same user's DMs on different accounts share a session within the same agent.

**Source:** `/concepts/session.md` session key shapes, `/gateway/security/index.md` dmScope recommendations.

### Anti-Patterns to Avoid

- **Mixed flat + accounts Telegram config:** Do NOT keep `channels.telegram.botToken` alongside `channels.telegram.accounts`. The behavior is undefined. Remove the top-level `botToken` when adding `accounts`.
- **Replacing the entire Telegram section:** Only restructure the token-related fields. Keep `enabled`, `groupPolicy`, `streaming` at the top level. They apply to all accounts.
- **Adding a binding for the main agent:** Not needed and adds maintenance burden. The default agent fallback handles all unmatched messages.
- **Using `requireMention: true` in #pricelabs:** This would require users to @-mention the bot in a dedicated channel -- poor UX. Use `requireMention: false`.
- **Editing openclaw.json while gateway is running without restart:** Config changes require gateway restart. Hot-reload only applies to some settings, NOT channel accounts or bindings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram bot connection | Manual Bot API polling setup | OpenClaw `channels.telegram.accounts` with grammY long-poll | Gateway handles connection, retries, rate limits, message normalization |
| Slack channel routing | Custom message filtering logic | `bindings[].match.peer` with `kind: "channel"` | Deterministic routing built into gateway. Peer match is highest priority. |
| Agent identity in Slack | Custom bot name per message | `agents.list[].identity` + `chat:write.customize` scope | Gateway applies identity automatically on outbound messages |
| Config migration validation | Manual JSON diff | `openclaw channels status --probe` + `openclaw agents list --bindings` | CLI gives definitive channel/agent status |

**Key insight:** All channel routing is declarative JSON config + gateway restart. No code, no scripts, no custom routing logic.

## Common Pitfalls

### Pitfall 1: Flat-to-Multi-Account Migration Breaks AlBot Telegram (CRITICAL)

**What goes wrong:** After restructuring `channels.telegram` from flat to multi-account format, AlBot stops receiving Telegram messages.
**Why it happens:** The top-level `botToken` is removed but `accounts.default.botToken` is not set correctly (typo, wrong key path, or missing). The gateway starts but cannot authenticate with Telegram.
**How to avoid:**
1. Back up openclaw.json BEFORE making changes
2. Migrate to multi-account format in a dedicated step (no new bot yet)
3. Verify AlBot works BEFORE adding the Prism bot
4. Run `openclaw channels status --probe` after restart
5. If AlBot stops working, restore backup immediately: `cp openclaw.json.bak openclaw.json && sudo systemctl restart openclaw-gateway.service`
**Warning signs:** `openclaw channels status --probe` shows Telegram disconnected. AlBot stops responding to Telegram messages. Gateway log shows "telegram: auth error" or "botToken not found for account".

### Pitfall 2: Missing Bindings Array

**What goes wrong:** Telegram multi-account is set up but messages from @Prism_Price_Bot still route to AlBot.
**Why it happens:** The `bindings[]` array was not added to openclaw.json. Without bindings, all messages fall through to the default agent (AlBot).
**How to avoid:** Add `bindings[]` at the top level of openclaw.json with accountId match for Telegram and peer match for Slack. Verify with `openclaw agents list --bindings`.
**Warning signs:** DM to @Prism_Price_Bot returns AlBot persona. `openclaw agents list --bindings` shows no bindings.

### Pitfall 3: Slack Channel ID vs Channel Name

**What goes wrong:** Slack binding uses the channel name (#pricelabs) instead of the channel ID (C0XXXXXXX). Binding never matches.
**Why it happens:** Slack peer bindings require the **channel ID** (starts with `C`), not the display name. Channel names are mutable; IDs are permanent.
**How to avoid:** After the user creates #pricelabs, obtain the channel ID from Slack (right-click channel > Copy link > extract ID, or use Slack API). Use the ID in both `channels.slack.channels` config and `bindings[].match.peer.id`.
**Warning signs:** Messages in #pricelabs get no response (neither AlBot nor Prism). Gateway log may show "no binding matched for peer".

### Pitfall 4: Gateway Restart Timing (Telegram Rate Limits)

**What goes wrong:** Gateway restarts too quickly after a previous restart. Telegram API rejects `getUpdates` calls due to rate limiting. Bot appears offline for 30-60 seconds.
**Why it happens:** Telegram Bot API has rate limits on polling. Rapid restarts can trigger temporary blocks.
**How to avoid:** Wait ~30 seconds between restarts (user decision from CONTEXT.md). Use `openclaw channels status --probe` to confirm connection before testing.
**Warning signs:** Gateway log shows "429 Too Many Requests" from Telegram API. `openclaw channels status --probe` shows Telegram as "connecting" instead of "connected".

### Pitfall 5: Slack Bot Not Invited to #pricelabs

**What goes wrong:** Binding is correct, channel is in allowlist, but Prism cannot see or respond to messages in #pricelabs.
**Why it happens:** The Slack bot/app was not invited to the new channel. Slack requires explicit invitation for bots to access channels.
**How to avoid:** After creating #pricelabs, invite the bot: `/invite @OpenClaw` (or whatever the Slack bot name is) in the channel. Verify the bot appears in channel members.
**Warning signs:** No response to messages in #pricelabs. Gateway log shows no inbound events from the channel.

### Pitfall 6: Forgetting to Keep Top-Level Telegram Settings

**What goes wrong:** When restructuring Telegram config, accidentally moving `groupPolicy`, `streaming`, or `enabled` inside `accounts.default` where they become account-specific instead of global.
**Why it happens:** Copy-paste from examples that show a minimal account config. Existing top-level settings get deleted or moved into the wrong level.
**How to avoid:** Keep `enabled`, `groupPolicy`, `streaming` at `channels.telegram` (top level). Only move `botToken` and `dmPolicy` into `accounts.default`. Base channel settings apply to all accounts unless overridden.
**Warning signs:** Telegram streaming stops working. Group policy changes unexpectedly.

## Code Examples

### Example 1: Complete Telegram Migration (Step-by-Step JSON Changes)

**Before (current live config):**
```json
"telegram": {
  "enabled": true,
  "dmPolicy": "pairing",
  "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
  "groupPolicy": "allowlist",
  "streaming": "partial"
}
```

**After Phase A (restructure only, no new bot):**
```json
"telegram": {
  "enabled": true,
  "groupPolicy": "allowlist",
  "streaming": "partial",
  "accounts": {
    "default": {
      "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
      "dmPolicy": "pairing"
    }
  }
}
```

**After Phase B (add Prism bot):**
```json
"telegram": {
  "enabled": true,
  "groupPolicy": "allowlist",
  "streaming": "partial",
  "accounts": {
    "default": {
      "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
      "dmPolicy": "pairing"
    },
    "pricelabs": {
      "botToken": "7965547116:AAH6yVXqEeZogHDPbQPsjgTja3H6CEQwxV4",
      "dmPolicy": "pairing"
    }
  }
}
```

**Source:** OpenClaw docs `/concepts/multi-agent.md` Telegram bots per agent, verified against `/gateway/configuration-reference.md`.

### Example 2: Complete Bindings Array

```json
"bindings": [
  {
    "agentId": "pricelabs",
    "match": {
      "channel": "slack",
      "peer": { "kind": "channel", "id": "C_PRICELABS_CHANNEL_ID" }
    }
  },
  {
    "agentId": "pricelabs",
    "match": {
      "channel": "telegram",
      "accountId": "pricelabs"
    }
  }
]
```

**Note:** Slack peer binding is listed first for clarity. Binding order within the same tier matters (first match wins), but these are in different tiers (peer=tier 1, accountId=tier 6) so order between them is irrelevant.

**Source:** `/gateway/configuration-reference.md` Binding match fields.

### Example 3: Slack Channel Addition

```json
"channels": {
  "slack": {
    "channels": {
      "C0AF9MXD0ER": { "allow": true, "requireMention": true, "allowBots": true },
      "C0AG7FJNKNC": { "allow": true, "requireMention": true, "allowBots": true },
      "C_PRICELABS_CHANNEL_ID": { "allow": true, "requireMention": false, "allowBots": true }
    }
  }
}
```

**Note:** `requireMention: false` means Prism responds to every message in #pricelabs without needing @-mention. This is the correct behavior for a dedicated agent channel.

### Example 4: Verification Commands

```bash
# After each config change:
sudo systemctl restart openclaw-gateway.service

# Wait 30 seconds for Telegram rate limit cooldown
sleep 30

# Check channel connectivity
openclaw channels status --probe

# Check agent routing
openclaw agents list --bindings

# Test Telegram routing (DM @Prism_Price_Bot)
openclaw message send --channel telegram --account pricelabs --target 8283515561 --message "Who are you?"

# Test Slack routing (post in #pricelabs)
openclaw message send --channel slack --target "channel:C_PRICELABS_CHANNEL_ID" --message "Who are you?"
```

### Example 5: Rollback Procedure

```bash
# If anything breaks after a config change:
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
sudo systemctl restart openclaw-gateway.service
sleep 30
openclaw channels status --probe
# Verify AlBot responds normally
```

## State of the Art

| Old Approach (current) | Current Approach (target) | When Changed | Impact |
|------------------------|---------------------------|--------------|--------|
| Single top-level `botToken` for Telegram | Multi-account `accounts` object | This phase | Breaking migration, must be done carefully |
| No `bindings[]` in config | Explicit bindings for agent routing | This phase | Messages can now route to specific agents by channel/account/peer |
| 2 Slack channels in allowlist | 3 Slack channels (add #pricelabs) | This phase | New channel with `requireMention: false` for dedicated agent |

**Deprecated/outdated:**
- Top-level `channels.telegram.botToken` with `channels.telegram.dmPolicy`: Deprecated when using multi-account. Move to `accounts.default`.
- No `bindings` with multi-agent: Without bindings, all messages route to default agent. Multi-agent setups should always have explicit bindings.

## Open Questions

1. **Whether `channels.telegram.dmPolicy` at top level still applies as default when `accounts` exist**
   - What we know: Docs say "Base channel settings apply to all accounts unless overridden per account." This suggests top-level `dmPolicy` would serve as default. However, the multi-agent.md example shows `dmPolicy` inside each account.
   - What's unclear: Whether the gateway treats `dmPolicy` as a "base channel setting" or a "token-related setting" that must be per-account.
   - Recommendation: Set `dmPolicy` explicitly inside each account to be safe. Do NOT rely on top-level inheritance for access control settings.

2. **Exact Slack channel ID for #pricelabs**
   - What we know: User will create the channel manually before execution. The channel ID is not known yet.
   - What's unclear: Nothing -- this is a runtime value obtained after channel creation.
   - Recommendation: Include a manual step in the plan to obtain the channel ID. Use placeholder `C_PRICELABS_CHANNEL_ID` in plan, replace at execution time.

3. **Whether `per-channel-peer` dmScope works correctly with multi-account Telegram**
   - What we know: Docs recommend `per-account-channel-peer` for multi-account setups. Current config uses `per-channel-peer`.
   - What's unclear: Whether `per-channel-peer` causes session collision when the same user DMs both bots. Since bindings route to different agents, sessions are already isolated by agentId.
   - Recommendation: Keep `per-channel-peer` for now. The binding ensures messages go to different agents (different session stores). Only change to `per-account-channel-peer` if testing reveals issues.

4. **Whether Slack bot needs `chat:write.customize` scope for Prism identity**
   - What we know: Docs say `chat:write.customize` enables custom username and icon per message. The pricelabs agent has `identity.name: "Prism"` and `identity.emoji: "diamond_shape_with_a_dot_inside"` in its agent config.
   - What's unclear: Whether the current Slack app already has `chat:write.customize` scope. If not, this is a Slack admin action.
   - Recommendation: This is out of scope for Phase 13 (deferred in CONTEXT.md as "Slack app-level customization"). Messages will post as the bot's default identity. Custom identity can be added later.

## Sources

### Primary (HIGH confidence)

- **OpenClaw `/concepts/multi-agent.md`** -- Multi-agent routing, Telegram bots per agent example, binding patterns, routing precedence. LOCAL: `/home/NGA/openclaw/docs/concepts/multi-agent.md`
- **OpenClaw `/gateway/configuration-reference.md`** -- Multi-account (all channels) section, binding match fields, deterministic match order, per-account overrides. LOCAL: `/home/NGA/openclaw/docs/gateway/configuration-reference.md`
- **OpenClaw `/channels/telegram.md`** -- Telegram config reference pointers, per-account capabilities, dmPolicy options, token resolution order. LOCAL: `/home/NGA/openclaw/docs/channels/telegram.md`
- **OpenClaw `/channels/slack.md`** -- Slack Socket Mode setup, channel allowlist, peer routing, `chat:write.customize` scope. LOCAL: `/home/NGA/openclaw/docs/channels/slack.md`
- **OpenClaw `/channels/channel-routing.md`** -- Session key shapes, routing rules (peer > parentPeer > guild > team > accountId > default), bindings config overview. LOCAL: `/home/NGA/openclaw/docs/channels/channel-routing.md`
- **Live `~/.openclaw/openclaw.json`** -- Current config with 12 agents, flat Telegram config, 2 Slack channels, NO bindings. Inspected during research.

### Secondary (MEDIUM confidence)

- **ARCHITECTURE.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/ARCHITECTURE.md`) -- Target state architecture, system diagram, channel routing sections. Written during v1.2 research synthesis.
- **PITFALLS.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/PITFALLS.md`) -- Pitfall #3 (Telegram migration), Pitfall #1 (sandbox tool allow). Sourced from OpenClaw docs and v1.1 post-mortems.
- **Phase 12 RESEARCH.md** (`/mnt/c/Projects/pricelabs-agent/.planning/phases/12-agent-registration/12-RESEARCH.md`) -- Agent entry already deployed to live config. Pricelabs agent registered and verified.

### Tertiary (LOW confidence)

- **`dmPolicy` inheritance behavior with multi-account:** Training data suggests top-level dmPolicy applies as default. Not explicitly verified with a live multi-account Telegram test. Mitigated by setting dmPolicy explicitly per account.
- **`per-channel-peer` vs `per-account-channel-peer` impact:** Docs recommend per-account for multi-account, but bindings route to different agents regardless. Session collision risk is theoretical. Needs validation during testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- multi-account Telegram and Slack peer binding patterns verified directly in OpenClaw docs with exact code examples
- Architecture: HIGH -- migration pattern clear from flat to multi-account. Binding patterns well-documented with deterministic match order.
- Pitfalls: HIGH -- primary risk (flat-to-multi-account migration) identified and mitigated with two-phase approach. Rollback procedure documented.

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- config-only phase, no dependency version drift)
