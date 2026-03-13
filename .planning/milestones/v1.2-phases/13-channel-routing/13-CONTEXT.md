# Phase 13: Channel Routing - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Route dedicated Telegram bot and Slack channel exclusively to the PriceLabs agent (Prism) while existing main agent (AlBot) messaging continues completely unaffected. Migrate Telegram from flat config to multi-account format, add the new bot, create Slack channel binding.

**ABSOLUTE CONSTRAINT:** AlBot (id: "main") messaging MUST NOT be impacted. Existing Telegram bot and Slack channels must continue routing to the main agent exactly as they do today. This is non-negotiable.

</domain>

<decisions>
## Implementation Decisions

### Telegram Bot Identity
- Bot name: **Prism**
- Username: **@Prism_Price_Bot**
- Bot token: `7965547116:AAH6yVXqEeZogHDPbQPsjgTja3H6CEQwxV4`
- Bot description/about: "STR portfolio revenue analyst"
- Bot already created via BotFather -- no manual step needed during execution
- Avatar: not set yet -- can be added later via BotFather `/setuserpic`

### Slack Channel Design
- Channel name: **#pricelabs**
- Visibility: Public -- anyone in workspace can find and join
- Topic/description: "PriceLabs pricing & occupancy reports"
- User will create the channel manually before execution -- no Slack API automation needed
- Ensure the Slack bot/app is invited to #pricelabs so it can read/post there

### Access & Membership
- Telegram: Same user access as AlBot -- Beau, Jonas, Elle, Jey can all message @Prism_Price_Bot
- Slack: Open to everyone in workspace (public channel) -- no restricted membership
- Off-topic behavior: Prism responds briefly to off-topic questions but steers back to portfolio topics (natural redirect, not rigid refusal)

### Migration Safety (from Phase 12 lessons)
- Telegram flat-to-multi-account migration is a BREAKING config change
- Must migrate existing AlBot bot to multi-account format FIRST, verify it still works, THEN add Prism bot
- Back up openclaw.json before every config change
- Gateway restart: `sudo systemctl restart openclaw-gateway.service` (system-level only)
- If AlBot stops working after migration, restore backup immediately
- Wait ~30 seconds after restart for Telegram rate limit cooldown

### Claude's Discretion
- Exact Telegram multi-account config structure (research will determine the format)
- Slack binding pattern (peer-channel routing vs other approaches)
- Order of operations for migration steps
- Whether to add Telegram user allowlist in config or let it be open

</decisions>

<specifics>
## Specific Ideas

- User created the Telegram bot proactively during discussion -- @Prism_Price_Bot is already live and ready for token configuration
- The #pricelabs Slack channel will be created manually by the user before execution
- Two manual prerequisites the user handles: (1) Telegram bot already done, (2) Slack channel to be created before execution
- Config changes must be append/merge only -- never replace the full config file
- The post-recovery state has 12 agents in openclaw.json -- config is fragile, treat every edit as high-risk

</specifics>

<deferred>
## Deferred Ideas

- Telegram bot avatar/profile picture -- can be set later via BotFather `/setuserpic`
- Telegram bot /start welcome message -- can be configured after routing works
- Slack app-level customization (custom bot name/avatar per channel) -- future enhancement

</deferred>

---

*Phase: 13-channel-routing*
*Context gathered: 2026-02-27*
