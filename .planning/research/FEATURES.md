# Feature Landscape

**Domain:** AI-powered Short-Term Rental Revenue Management Agent (PriceLabs + OpenClaw)
**Researched:** 2026-02-22
**Overall Confidence:** HIGH -- grounded in PriceLabs API docs, competitor analysis, optimization playbook, and verified market research

## Context

This feature map is for an AI agent that sits *on top of* PriceLabs, not a replacement for it. PriceLabs already handles dynamic pricing, algorithm-driven rate optimization, and channel sync. The agent's value is in the **monitoring, interpretation, recommendation, and execution layers** that PriceLabs' dashboard requires humans to do manually. The interface is conversational (Slack/Telegram), not a web dashboard.

The agent operates through the PriceLabs Customer API (12 endpoints, 1000 req/hour, $1/listing/month).

---

## Table Stakes

Features users expect from an AI revenue management agent. Missing any of these and the product feels incomplete -- users will revert to manually checking PriceLabs dashboard.

### TS-1: Daily Portfolio Health Summary
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | The #1 complaint about PriceLabs is "set it and forget it" failure. The weekly optimization loop is essential (per PriceLabs' own guidance), but most hosts skip it. A daily push notification is the core value proposition of an always-on agent. |
| **Complexity** | Low |
| **API Dependencies** | `GET /v1/listings` (health scores, occupancy, revenue, STLY fields) |
| **What It Includes** | Health scores (7/30/60-day) for each listing, portfolio-level occupancy vs market occupancy, revenue vs STLY revenue, listings needing attention flagged with specific reasons |
| **Delivery** | Slack and Telegram message, formatted card/block, sent at configurable time (e.g., 8am local) |
| **Notes** | This is the "heartbeat" of the agent. If this doesn't work reliably, nothing else matters. |

### TS-2: Underperformance Detection and Alerting
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Users need to know WHICH listings need attention and WHY, not just see raw numbers. PriceLabs provides health scores but no interpretation or recommended action. |
| **Complexity** | Medium |
| **API Dependencies** | `GET /v1/listings` (health scores, occupancy vs market), `POST /v1/listing_prices` (demand colors, booking status), `GET /v1/neighborhood_data` (market percentiles) |
| **What It Includes** | Alerts when listing occupancy trails market by >10pts at any horizon (7/30/60/90 days), alerts when health score degrades, alerts when revenue pacing falls behind STLY by configurable threshold, contextual explanation ("Your 2BR downtown is 15pts below market at 30-day horizon; market occupancy is 72%, yours is 57%") |
| **Notes** | The interpretation layer is what makes this an agent, not a dashboard. Must include the "why" and a recommended next step. |

### TS-3: Natural Language Q&A About Portfolio
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Guesty Copilot already offers "ask about revenue, occupancy, or performance and get instant answers in plain language." Jurny's NIA offers the same. This is becoming table stakes for AI-powered property management tools in 2026. |
| **Complexity** | Medium |
| **API Dependencies** | All read endpoints -- `GET /v1/listings`, `POST /v1/listing_prices`, `GET /v1/neighborhood_data`, `GET /v1/reservation_data` |
| **What It Includes** | "How is my portfolio doing this week?" / "What's my occupancy for March?" / "Which listing has the lowest health score?" / "How does my ADR compare to market?" / "Show me my orphan gaps for next 30 days" |
| **Notes** | Claude Opus 4.6 handles the NL understanding; the agent translates questions into API calls and formats responses. The conversational interface IS the product -- it replaces the PriceLabs dashboard for routine checks. |

### TS-4: Pricing Change Recommendations with Human Approval
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | This is the core promise of a revenue management *agent*. Without actionable recommendations, it's just a reporting bot. The human-in-the-loop approval pattern is industry standard -- Guesty uses it, multifamily uses it, and PriceLabs' own guidance says "blend AI recommendations with your own market expertise." |
| **Complexity** | High |
| **API Dependencies** | `POST /v1/listings` (update base/min/max), `POST /v1/listings/{id}/overrides` (DSOs), `POST /v1/push_prices` (sync) |
| **What It Includes** | Base price adjustment recommendations (with market percentile context), date-specific override recommendations (events, demand spikes), min-stay adjustment recommendations, clear presentation: current value, recommended value, reasoning, expected impact |
| **Approval Flow** | Agent sends recommendation via Slack/Telegram with approve/reject buttons. On approve, agent executes via API and confirms. On reject, agent logs and learns from pattern. No pricing change ever happens without explicit user action. |
| **Notes** | The approval UX must be frictionless -- one tap to approve. Batch approvals for multiple listings. Show enough context to decide without opening PriceLabs dashboard. |

### TS-5: Orphan Day Detection and Fill Strategies
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Orphan day management is the highest-impact quick win in STR revenue management (7% revenue increase in controlled testing). PriceLabs has built-in gap filler rules, but the agent should proactively detect gaps forming and recommend specific strategies. |
| **Complexity** | Medium |
| **API Dependencies** | `POST /v1/listing_prices` (booking_status, min_stay per date), `GET /v1/listings/{id}/overrides` (existing DSOs) |
| **What It Includes** | Scan calendar for 1-4 night gaps between bookings, classify gap type (orphan=1-2 nights, short gap=3-4 nights), recommend strategy (discount DSO, min-stay reduction, or both), show revenue impact estimate ("filling this 2-night gap at $150/night = $300 vs $0") |
| **Notes** | Must check if PriceLabs orphan rules are already handling the gap before recommending manual intervention. The agent adds value when gaps slip through the automated rules. |

### TS-6: Weekly Optimization Report
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | PriceLabs explicitly recommends a 15-30 minute weekly optimization loop. Most hosts skip it. The agent should automate the data gathering and present a structured weekly review. Industry standard: pacing views at 7/30/60/90-day horizons. |
| **Complexity** | Medium |
| **API Dependencies** | All read endpoints |
| **What It Includes** | Week-over-week portfolio performance (revenue, ADR, occupancy, RevPAR), booking pace vs STLY at 7/30/60/90-day windows, market position (your rates vs 25th/50th/75th/90th percentile), orphan gap summary, upcoming events or demand spikes detected, action items with priority ranking |
| **Notes** | This replaces the manual "weekly optimization loop" from the PriceLabs playbook. Delivered at a configurable day/time (e.g., Monday 9am). |

### TS-7: Booking Pace vs STLY Tracking
| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Booking pace vs same-time-last-year is the fundamental leading indicator in revenue management. PriceLabs API provides `stly_revenue_past_7`, `booking_status_STLY`, `ADR_STLY`, and `booked_date_STLY` fields. Hotels and professional STR managers track this religiously. |
| **Complexity** | Medium |
| **API Dependencies** | `GET /v1/listings` (STLY revenue fields), `POST /v1/listing_prices` (STLY booking status, ADR, booked dates), `GET /v1/reservation_data` (booking history) |
| **What It Includes** | Per-listing and portfolio-level pace comparison, alerts when pacing significantly ahead (opportunity to raise prices) or behind (may need to adjust), trend visualization in text format (sparklines or bar charts in Slack blocks) |
| **Notes** | "Pacing ahead" and "pacing behind" both require different responses. Ahead = potential to increase rates. Behind = investigate cause before discounting. The agent must present the right framing. |

---

## Differentiators

Features that set this agent apart from checking PriceLabs dashboard manually, from Guesty's AI agent, and from hiring a human revenue manager. Not expected, but create significant value.

### D-1: Proactive Event-Based Pricing Recommendations
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | PriceLabs' HLP algorithm has 4-way event detection, but it misses hyper-local events (neighborhood festivals, one-off concerts, sports events). The agent monitors demand color changes and booking velocity to detect events the algorithm may underweight, then recommends DSOs with specific premium percentages. |
| **Complexity** | High |
| **API Dependencies** | `POST /v1/listing_prices` (demand_color, demand_desc), `GET /v1/neighborhood_data` (market occupancy shifts), `POST /v1/listings/{id}/overrides` (create DSOs) |
| **How It Works** | Daily scan of demand colors across portfolio. When a date shifts from green/yellow to orange/red unexpectedly, agent investigates (checks all listings in area, compares to STLY). If event-like pattern detected, recommends premium DSO. |
| **Notes** | DPGO is the only competitor with notably better event detection than PriceLabs. This feature closes that gap for PriceLabs users. |

### D-2: Contextual Base Price Calibration Recommendations
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | PriceLabs provides a `recommended_base_price` field, but doesn't explain the reasoning or timing. The agent analyzes 30+ day performance trends, market percentile positioning, and occupancy patterns to recommend base price changes with full context -- and only when the data warrants it (not weekly, not daily). |
| **Complexity** | Medium |
| **API Dependencies** | `GET /v1/listings` (recommended_base_price, current base), `GET /v1/neighborhood_data` (market percentiles), `GET /v1/reservation_data` (historical booking patterns) |
| **How It Works** | Monthly scan: compare current base to recommended, check market percentile positioning (is listing at 30th percentile but quality warrants 60th?), analyze 30-day occupancy trend. Only recommend changes when delta is significant AND sustained. |
| **Notes** | This is exactly what a human revenue manager does. The agent automates the analysis but keeps the human in the decision loop. PriceLabs explicitly says "don't change base price more than monthly" -- the agent enforces this discipline. |

### D-3: Competitive Position Analysis in Natural Language
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | PriceLabs provides raw neighborhood data (percentiles, occupancy). The agent translates this into actionable prose: "Your 2BR downtown is priced at the 62nd percentile of booked rates. Market occupancy is 78%. You have room to push rates up to 75th percentile ($185/night) without risking occupancy." |
| **Complexity** | Medium |
| **API Dependencies** | `GET /v1/neighborhood_data` (percentile prices, market KPIs), `GET /v1/listings` (current pricing) |
| **Notes** | This is a "PriceLabs translator" -- turning data that requires dashboard expertise into insights accessible via chat. Particularly valuable for hosts who find PriceLabs' interface "clunky" and "overwhelming" (common complaint). |

### D-4: Multi-Listing Batch Operations with Grouped Approvals
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | For portfolios with 10+ listings, approving changes one-by-one via chat is tedious. Batch recommendations ("I recommend raising base prices on your 5 downtown 2BRs by 8-12% based on market shift") with single-approval execution. |
| **Complexity** | Medium |
| **API Dependencies** | `POST /v1/listings` (batch update), `POST /v1/listings/{id}/overrides` (per-listing DSOs) |
| **Notes** | PriceLabs already supports group-level settings. The agent leverages groups/tags for intelligent batching. This scales the approval workflow for larger portfolios without message fatigue. |

### D-5: Revenue Impact Tracking for Applied Changes
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | After a user approves a pricing change, the agent tracks the outcome. "You raised base price on Lakeside Cabin from $150 to $170 two weeks ago. Since then: occupancy held at 82% (was 85%), ADR up 13%, RevPAR up 9%. The change is working." This builds trust and helps users calibrate their approval threshold. |
| **Complexity** | High |
| **API Dependencies** | `GET /v1/listings` (revenue, occupancy over time), `GET /v1/reservation_data` (bookings since change), internal state tracking |
| **How It Works** | Agent logs every approved change with timestamp. After 7, 14, and 30 days, re-evaluates performance metrics vs pre-change baseline. Reports impact in weekly summary. |
| **Notes** | No competitor offers this. Human revenue managers sometimes track this manually. Automating it creates a feedback loop that makes the agent increasingly trusted and useful. |

### D-6: Cancellation Impact Analysis
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | When a cancellation occurs, the now-open dates may need repricing. The agent detects cancellations via reservation data, assesses the revenue gap, and recommends a fill strategy (discount DSO if close-in, standard rates if far out, min-stay adjustment). |
| **Complexity** | Medium |
| **API Dependencies** | `GET /v1/reservation_data` (cancelled_on, check_in, check_out, rental_revenue), `POST /v1/listing_prices` (current pricing for those dates), `POST /v1/listings/{id}/overrides` (if DSO needed) |
| **Notes** | PriceLabs' algorithm will eventually adjust pricing for newly-open dates, but there's a lag (nightly sync). The agent can recommend immediate action, especially for close-in cancellations where every hour matters. |

### D-7: Configurable Alert Thresholds and Preferences
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Different hosts have different risk appetites and attention budgets. A host with 3 properties wants granular alerts. A PM with 50 properties wants only critical issues. Configurable thresholds ("alert me when occupancy trails market by >15pts" vs default >10pts) and frequency (daily vs twice-daily vs weekly-only). |
| **Complexity** | Low |
| **Notes** | Simple configuration, but dramatically improves signal-to-noise ratio. Without this, the agent becomes annoying for power users or too quiet for engaged hosts. |

### D-8: Demand Calendar Visualization via Chat
| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | PriceLabs' demand color system (red/orange/yellow/green/blue) is one of its most useful features but requires opening the dashboard. The agent can render a text-based calendar showing demand colors, prices, and booking status for any date range -- directly in Slack/Telegram. |
| **Complexity** | Low-Medium |
| **API Dependencies** | `POST /v1/listing_prices` (demand_color, price, booking_status per date) |
| **Notes** | Slack Block Kit and Telegram formatting support colored text/emoji that can approximate the PriceLabs demand color calendar. This keeps users in their messaging app. |

---

## Anti-Features

Features to explicitly NOT build. Each would be tempting but would either waste effort, create liability, or harm the product.

### AF-1: Fully Autonomous Pricing (No Approval)
| Anti-Feature | Fully autonomous mode where agent makes pricing changes without user approval |
|--------------|-----------|
| **Why Avoid** | Trust is the #1 barrier to AI pricing adoption. PriceLabs itself already does autonomous algorithmic pricing -- the agent's value is in the recommendation/interpretation layer, not in replacing PriceLabs' automation. Removing the approval gate removes the agent's unique value proposition (human judgment + AI analysis). One bad autonomous change on a luxury property could cost thousands and destroy trust permanently. |
| **What to Do Instead** | Always require explicit approval. Build trust over time through accurate recommendations and impact tracking (D-5). Eventually offer "auto-approve for changes under X%" as an opt-in, but never as default. |

### AF-2: Custom Pricing Algorithm / Shadow Pricing
| Anti-Feature | Building a separate pricing engine that competes with or overrides PriceLabs' HLP algorithm |
|--------------|-----------|
| **Why Avoid** | PriceLabs' HLP algorithm uses 350 comparable listings, H3 hexagons, and 9+ data inputs updated nightly. Replicating this is a multi-year, multi-million dollar effort. The agent should enhance PriceLabs' output, not compete with it. Users are paying for PriceLabs precisely because of HLP. |
| **What to Do Instead** | Use PriceLabs' calculated prices as ground truth. Add value through interpretation, timing, and edge cases (orphan gaps, events, cancellations) rather than re-computing prices. |

### AF-3: Web Dashboard or Mobile App
| Anti-Feature | Building any visual UI beyond messaging |
|--------------|-----------|
| **Why Avoid** | PriceLabs already has a web dashboard. Building another one duplicates effort and splits attention. The conversational interface IS the differentiator -- it meets users where they already are (Slack/Telegram). A dashboard would also dramatically increase development scope and maintenance burden. |
| **What to Do Instead** | Invest in rich Slack Block Kit / Telegram formatting. Use text-based visualizations. Link to PriceLabs dashboard when users need deeper exploration. |

### AF-4: Direct OTA Integration (Airbnb, Vrbo, Booking.com)
| Anti-Feature | Connecting directly to Airbnb/Vrbo/Booking.com APIs |
|--------------|-----------|
| **Why Avoid** | PriceLabs handles all channel integrations through 152+ PMS connectors. Direct OTA integration would create data conflicts, require managing OAuth flows for each platform, and introduce channel-specific pricing rules the agent has no business managing. |
| **What to Do Instead** | Trust PriceLabs' channel sync. The agent's job is to set the right prices in PriceLabs; PriceLabs pushes them to channels. |

### AF-5: Guest Communication / Messaging
| Anti-Feature | Handling guest messages, reviews, or pre-arrival communication |
|--------------|-----------|
| **Why Avoid** | Guest communication is a completely different domain with different NLP requirements, compliance concerns (fair housing), and competitive landscape (Guesty ReplyAI, Hospitable, Breezeway Assist). Revenue management and guest communication should be separate agents/products. |
| **What to Do Instead** | Stay laser-focused on revenue management. If users want guest communication, recommend purpose-built tools. |

### AF-6: Revenue Prediction / Forecasting Engine
| Anti-Feature | Building forward-looking revenue forecasts ("you'll make $X next month") |
|--------------|-----------|
| **Why Avoid** | Revenue forecasting in STR requires modeling cancellation rates, booking velocity curves, seasonal patterns, and macroeconomic factors. PriceLabs is building this (Goal Setup feature). A wrong forecast damages credibility more than having no forecast. The API doesn't provide the data granularity needed for accurate forecasting. |
| **What to Do Instead** | Report on pace and trends (leading indicators) rather than point predictions. "Pacing 12% ahead of STLY" is more useful and less risky than "You'll make $15,200 next month." |

### AF-7: Multi-PMS / Multi-Pricing-Tool Support
| Anti-Feature | Supporting Beyond Pricing, Wheelhouse, DPGO, or non-PriceLabs pricing tools |
|--------------|-----------|
| **Why Avoid** | Each pricing tool has different APIs, different concepts, different data models. Building for one tool well is hard enough. PriceLabs has the deepest API (12 endpoints), the most integrations (152+ PMS), and the strongest market position for professional managers. Go deep on PriceLabs first. |
| **What to Do Instead** | Build a clean abstraction layer so the architecture COULD support other tools later, but only implement PriceLabs now. |

---

## Feature Dependencies

```
TS-1 (Daily Health Summary) ─── foundation for everything
  |
  ├── TS-2 (Underperformance Detection) ── requires health data interpretation
  |     |
  |     └── D-1 (Event-Based Recommendations) ── requires demand pattern analysis
  |
  ├── TS-7 (Booking Pace vs STLY) ── requires listing + pricing data
  |     |
  |     └── D-2 (Base Price Calibration) ── requires pace + market context
  |
  └── TS-6 (Weekly Report) ── aggregates all monitoring data
        |
        └── D-5 (Revenue Impact Tracking) ── requires historical change log

TS-3 (NL Q&A) ─── independent; needs all read endpoints
  |
  └── D-3 (Competitive Position Analysis) ── specialized Q&A variant

TS-4 (Pricing Recommendations + Approval) ─── core write workflow
  |
  ├── TS-5 (Orphan Day Detection) ── specific recommendation type
  |
  ├── D-4 (Batch Operations) ── scales the approval workflow
  |
  └── D-6 (Cancellation Impact) ── reactive recommendation trigger

D-7 (Configurable Thresholds) ─── applies to all alerting features
D-8 (Demand Calendar) ─── visualization utility, independent
```

**Critical path:** TS-1 --> TS-2 --> TS-4 --> TS-5
This is the minimum path from "monitoring" to "actionable agent."

---

## MVP Recommendation

### Phase 1: Monitoring Foundation (ship first)
1. **TS-1: Daily Portfolio Health Summary** -- the heartbeat
2. **TS-7: Booking Pace vs STLY Tracking** -- the leading indicator
3. **TS-3: Natural Language Q&A** -- the conversational interface

**Rationale:** These three features deliver immediate daily value through read-only API operations. Zero risk of making bad pricing changes. Users see value on day one. This validates the core premise: "Is a conversational PriceLabs interface useful?"

### Phase 2: Analysis Layer
4. **TS-2: Underperformance Detection** -- smart alerting
5. **TS-6: Weekly Optimization Report** -- replaces manual weekly loop
6. **D-3: Competitive Position Analysis** -- market context in plain language
7. **D-8: Demand Calendar Visualization** -- dashboard in chat

**Rationale:** Builds on monitoring foundation with interpretation. Still read-only. Proves the agent can surface insights humans would miss or skip.

### Phase 3: Recommendation Engine
8. **TS-4: Pricing Change Recommendations + Approval** -- core agent capability
9. **TS-5: Orphan Day Detection and Fill** -- highest-impact quick win
10. **D-1: Event-Based Pricing Recommendations** -- proactive value
11. **D-2: Base Price Calibration** -- monthly optimization

**Rationale:** Write operations unlock the full agent value. By this point, users trust the agent's analysis (from Phase 1-2) and are ready to act on its recommendations.

### Phase 4: Scale and Sophisttic Features
12. **D-4: Batch Operations** -- portfolio scale
13. **D-5: Revenue Impact Tracking** -- feedback loop
14. **D-6: Cancellation Impact Analysis** -- reactive intelligence
15. **D-7: Configurable Thresholds** -- personalization

### Defer Indefinitely
- AF-1 through AF-7 (all anti-features)
- Revenue forecasting (let PriceLabs build this)
- Web dashboard (messaging is the interface)

---

## Complexity Summary

| Feature | Complexity | API Calls/Run | Write Operations |
|---------|-----------|---------------|-----------------|
| TS-1: Daily Health Summary | Low | 1 (listings) | None |
| TS-2: Underperformance Detection | Medium | 2-3 (listings, prices, neighborhood) | None |
| TS-3: NL Q&A | Medium | 1-4 (varies by question) | None |
| TS-4: Pricing Recommendations + Approval | High | 3-4 (read) + 1-2 (write on approval) | Yes |
| TS-5: Orphan Day Detection | Medium | 1-2 (prices, overrides) | Yes (on approval) |
| TS-6: Weekly Report | Medium | 3-4 (all read endpoints) | None |
| TS-7: Booking Pace vs STLY | Medium | 1-2 (listings, prices) | None |
| D-1: Event Recommendations | High | 2-3 (prices, neighborhood) | Yes (on approval) |
| D-2: Base Price Calibration | Medium | 2-3 (listings, neighborhood, reservations) | Yes (on approval) |
| D-3: Competitive Position | Medium | 2 (listings, neighborhood) | None |
| D-4: Batch Operations | Medium | 1-2 (listings, batch write) | Yes |
| D-5: Revenue Impact Tracking | High | 2+ (listings, reservations) + internal state | None |
| D-6: Cancellation Impact | Medium | 2-3 (reservations, prices, overrides) | Yes (on approval) |
| D-7: Configurable Thresholds | Low | 0 (config only) | None |
| D-8: Demand Calendar | Low-Medium | 1 (prices) | None |

### API Budget Consideration
At 1000 requests/hour, a portfolio of 50 listings running all features would use approximately:
- Daily health check: ~3-5 requests (listings + paginated prices)
- NL Q&A: ~2-4 requests per question
- Weekly report: ~10-15 requests
- Orphan/event scanning: ~5-10 requests per listing scan

Well within budget for single-user. Multi-user (Phase 4+) will need request pooling and caching strategies.

---

## Competitive Positioning

| Feature Area | PriceLabs Dashboard | Guesty AI Agent | This Agent |
|-------------|-------------------|-----------------|------------|
| Health monitoring | Manual check required | Embedded in PMS | Push notifications via Slack/Telegram |
| NL Q&A | Not available | Copilot (PMS-wide data) | Portfolio-specific, pricing-focused |
| Pricing recommendations | Algorithm auto-applies | Unified pricing/content/availability | Contextualized with market data, approval-gated |
| Orphan management | Automated rules | Not specialized | Proactive detection + rule gap filling |
| STLY tracking | Data available, manual analysis | Part of revenue agent | Automated alerting with thresholds |
| Event detection | 4-way algorithm | Not specialized | Agent supplements algorithm's blind spots |
| Impact tracking | Not available | Not available | Unique differentiator |
| Batch operations | Group-level in dashboard | Not specialized | Chat-based grouped approvals |

**Key differentiation vs Guesty's AI Agent:** Guesty's agent is PMS-embedded (only for Guesty users) and focuses broadly across pricing, content, and availability. This agent is PriceLabs-specific, deeper on revenue management, works with any PMS that PriceLabs supports (152+), and delivers via messaging platforms users already have open all day.

---

## Sources

### HIGH Confidence (Official docs, API reference, first-party research)
- PriceLabs Customer API documentation (12 endpoints verified) -- `research/02-api-reference.md`
- PriceLabs optimization playbook (12 strategies documented) -- `research/03-optimization-playbook.md`
- PriceLabs algorithm and settings reference -- `research/05-algorithm-and-settings.md`
- PriceLabs competitor analysis -- `research/06-competitor-analysis.md`
- [PriceLabs Revenue Management Strategy 2026](https://hello.pricelabs.co/blog/revenue-management-strategy/)
- [PriceLabs Orphan Gap Management](https://hello.pricelabs.co/how-to-use-orphan-gaps-for-increasing-revenue/)
- [PriceLabs Min Stay Recommendation Engine](https://hello.pricelabs.co/minimum-stay-recommendation-engine/)
- [PriceLabs Listing Health](https://hello.pricelabs.co/glossary/listing-health/)

### MEDIUM Confidence (Verified across multiple sources)
- [Guesty AI Agent for Revenue Management (PR Newswire)](https://www.prnewswire.com/news-releases/guesty-unveils-first-ai-agent-for-revenue-management-as-it-accelerates-multi-agent-ai-product-strategy-302630233.html)
- [Guesty AI Features](https://www.guesty.com/features/ai-for-short-term-rentals/)
- [Hostaway 2026 STR Report - 61% AI Adoption](https://www.hostaway.com/blog/2026-short-term-rental-report/)
- [Booking Pace and STLY in Revenue Management](https://www.mylighthouse.com/resources/blog/booking-pickup-and-pace-revenue-management)
- [AirDNA Short-Term Rental Metrics](https://www.airdna.co/blog/short-term-rental-metrics)
- [STR KPIs for Property Managers](https://hosttools.com/blog/short-term-rental-tips/KPI-property-management/)
- [Human-in-the-Loop Pricing Automation](https://www.apartmentiq.io/multifamily-pricing-automation-revenue-management-2026/)

### LOW Confidence (Single source, needs validation)
- Jurny NIA's conversational analytics capabilities (single marketing source)
- Key Data Dashboard's 40+ KPI tracking (marketing claim, not verified)
- DPGO's claim of 200+ local market parameters (competitor marketing)
