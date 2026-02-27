# PriceLabs Optimization Playbook

> Community-sourced strategies from Reddit, BiggerPockets, power users, and PriceLabs documentation

## ROI Benchmarks

Before diving in, here's what the data shows:

| Metric | Static Pricing | With PriceLabs | Delta |
|--------|---------------|----------------|-------|
| Revenue (90-day test) | $11,448 | $15,012 | **+31.1%** |
| Avg Nightly Rate | $159 | $184.37 | **+16.0%** |
| Occupancy | 80% | 90.5% | **+10.5 pts** |
| Orphan Days | 11 nights | 3 nights | **-72.7%** |
| RevPAR | $127.20 | $166.80 | **+31.1%** |
| Tool Cost (3 months) | -- | $59.97 | **5,843% ROI** |

**User-reported results:**
- Average 45% more revenue than market (consultant report)
- $1,500 extra in one weekend on a single listing
- Base price increased ~40% while maintaining 94% occupancy
- 50-100x return on subscription cost (Trustpilot)
- ~60% increase in per-night booking revenues (Richer Logic, professional manager)

---

## Strategy 1: The Weekly Optimization Loop

**Frequency:** Weekly (15-30 minutes)

1. **Check Neighborhood Data** - Filter by bedroom count, review daily and monthly views
2. **Review Pacing** - Compare 7/30/60/90-day occupancy vs. market and vs. STLY
3. **Audit Base Price** - Use Base Price Help tool monthly; ensure you're within 25th-75th percentile
4. **Check Orphan Days** - Identify any new gaps; verify orphan rules are filling them
5. **Review Upcoming Events** - Set DSOs for events the algorithm might miss
6. **Verify Sync Health** - Check `health_7_day`, `health_30_day`, `health_60_day` fields

**What NOT to do weekly:** Change base price, tweak daily fluctuations, panic about individual slow days.

---

## Strategy 2: Base Price Calibration

The base price is the **anchor** over which all customizations are applied. Getting this right is critical.

**Setting the initial base price:**
1. Open Neighborhood Data -> filter by your bedroom count
2. Look at the **50th percentile** of booked prices in your area
3. Set base price at or slightly above 50th percentile if listing quality is average or above
4. For new listings with few reviews: start at 25th-50th percentile, increase as reviews build
5. For established listings with 4.8+ rating: target 50th-75th percentile

**When to adjust base price:**
- Only when consistently under/overperforming over **30+ days**
- When `recommended_base_price` differs significantly from current
- After major listing upgrades (renovations, new amenities)
- Seasonal market shifts (quarterly review)

**When NOT to adjust:**
- Daily or weekly (algorithm handles short-term fluctuations)
- In response to a single slow week
- During known slow periods (algorithm already adjusts)

---

## Strategy 3: Last-Minute Discount Configuration

**Default:** Gradual 30% discount over 15 days before check-in.

**Market data insight:** Markets typically compress pricing ~18 days before arrival.

**Optimization approach by property type:**

| Property Type | Days Out | Discount | Rationale |
|--------------|----------|----------|-----------|
| Urban apartment | 7 days | 15-20% | High last-minute business travel demand |
| Beach house | 14 days | 20-30% | Longer booking windows, less last-min demand |
| Mountain cabin | 10 days | 15-25% | Moderate last-minute, weekend-heavy |
| Luxury villa | 21 days | 10-20% | Longer lead times, don't discount too aggressively |

**PriceLabs offers 7 different discount curve options** - use the Last-Minute Recommendation in the dashboard to see what your specific market data suggests.

---

## Strategy 4: Orphan Day Management (Highest-Impact Quick Win)

**What:** Filling 1-3 night gaps between bookings that would otherwise go unbooked.

**One user's controlled test:** 7% revenue increase specifically from orphan day filling vs. competing tools.

**Recommended settings:**
```
Orphan Gaps of 1-2 nights: 20% discount
Orphan Gaps of 3-4 nights (weekdays): 20% discount
Orphan Gaps of 3-4 nights (weekends): 15% discount
Auto-adjust minimum stay: ENABLED
```

**Key rule:** If a date qualifies for both orphan day discount AND last-minute discount, PriceLabs applies only the **largest single discount** (prevents excessive stacking).

**Auto min-stay adjustment:** When enabled, PriceLabs will reduce the minimum stay requirement for orphan gap dates to make them bookable. This overrides other min-stay settings when it would reduce (not increase) the required nights.

---

## Strategy 5: Occupancy-Based Adjustments

**Concept:** Automatically adjust rates based on your booking pace relative to occupancy targets.

**Pre-filled profiles:**
| Profile | Target 50% Occupancy At | Best For |
|---------|------------------------|----------|
| Short Booking Window | 11-20 days out | Urban, business markets |
| Medium Booking Window | 16-30 days out | Suburban, mixed markets |
| Long Booking Window | 31-60 days out | Resort, vacation markets |
| Custom | User-defined | Power users |

**Rules:**
- Day ranges must increase sequentially
- Each occupancy band must have a smaller price adjustment than the previous one
- Don't stack with portfolio-level occupancy adjustments unless intentional

**Seasonal tuning:**
- During peak: Aggressive premiums at high occupancy (e.g., +15% at 97% occupancy)
- During slow: More moderate adjustments to avoid pricing yourself out
- Change profiles seasonally or use seasonal customizations to override

---

## Strategy 6: Far-Out Pricing

**For dates 90+ days in the future** where demand signals are weak.

**Three options:**
1. **Fixed Price** - Set a specific nightly rate for far-out dates
2. **% Change on Base Price** - e.g., -10% of base price for dates 6+ months out
3. **% Change on Minimum Price** - Tied to your floor price

**Best practice:** Set far-out prices slightly below your base to capture early bookers at reasonable rates. As dates approach and demand data improves, the algorithm will adjust prices up or down.

---

## Strategy 7: Weekend/Event Pricing

**Default weekend days:** Friday and Saturday
**Customizable to:** Thursday-Sunday, Thursday-Friday (Middle Eastern markets), etc.

**Event handling:**
- HLP algorithm uses **4-way event detection**: prior-year pacing, early demand signals, competitor pricing, hotel price indications
- For major local events the algorithm might miss: use Date-Specific Overrides
- Premium stacking rule: If a date qualifies for multiple premiums, **all premiums stack**

**Power user approach:**
1. Let the algorithm handle daily fluctuations and events it detects
2. Manually add DSOs for hyper-local events (neighborhood festivals, one-off concerts)
3. Review calendar weekly for any dates where the algorithm seems low relative to known events

---

## Strategy 8: Minimum Stay Optimization

PriceLabs is **best-in-class** for minimum stay management.

**Dynamic Min-Stay Engine:**
- Refreshed every 15 days
- Uses opportunity cost vs. guaranteed revenue calculation
- Two modes: short-term and mid-term rental
- Day-of-week level controls (unique to PriceLabs)

**Priority hierarchy:**
1. Date-specific overrides (highest)
2. Far-out customization
3. Last-minute customization
4. Default setting (lowest)

**Best practices:**
- Longer minimums during peak (3-5 nights)
- Shorter minimums during slow periods (1-2 nights)
- Reduce minimums as dates approach to capture last-minute
- Use "Help Me Choose Minimum Stays" tool
- Consider day-of-week rules (e.g., 3-night min for Friday check-in, 1-night for Tuesday)

---

## Strategy 9: Seasonal Profiles

**Use case:** Override Min, Base, and Max Price for specific date ranges when the default market data doesn't capture your property's seasonal patterns.

**Example scenarios:**
- Ski cabin with inverse seasonality from city-center apartments
- Beachfront where guests expect consistent weekly pricing
- Properties near colleges with graduation/move-in demand spikes

**Bulk management:** Download seasonal profiles as CSV, edit in spreadsheet, re-upload. Much faster than UI for multi-property portfolios.

---

## Strategy 10: Group & Account Strategy

**Group strategy for portfolios:**
1. Create groups by bedroom count AND location (e.g., "2BR Downtown", "3BR Beach")
2. Apply customizations at group level
3. Fine-tune at listing level only where needed

**Hierarchy:**
1. Listing Level (highest priority)
2. Group Level
3. Account Level (lowest priority)

**This saves massive time** for portfolios with 10+ properties with similar characteristics.

---

## Strategy 11: Pacing-Driven Monthly Optimization

**Monthly review process:**
1. Export Portfolio Analytics data
2. Compare ADR, RevPAR, occupancy, pacing vs. STLY
3. Compare booking pickup rate at 7/30/60/90-day cutoffs
4. If pace is slower than STLY: consider lowering base or expanding last-minute discounts
5. If pace is faster than STLY: consider raising base price by 5-10%
6. Document changes and review impact next month

---

## Strategy 12: Competitive Intelligence via Comp Sets

**Setup:**
1. Build Market Dashboard comp set with 40+ filters
2. Create Competitor Calendar referencing up to 10 nearby listings
3. Filter by bedroom count for accuracy

**Weekly monitoring:**
- Compare your rates to 25th/50th/75th percentile
- Track market occupancy changes
- Monitor new supply entering your market
- Use Hotel Price Tracker to benchmark against hotel competition

---

## The "DO NOT" List

1. **DO NOT** "set it and forget it" - Weekly monitoring is required
2. **DO NOT** change base price more than monthly
3. **DO NOT** panic-price when bookings slow - use occupancy-based adjustments instead
4. **DO NOT** stack manual adjustments on top of automated ones without understanding priority
5. **DO NOT** ignore orphan days - this is the easiest revenue win
6. **DO NOT** use the same settings for all property types
7. **DO NOT** set minimum price too high - it prevents the algorithm from competing effectively
8. **DO NOT** set maximum price too low - it caps revenue during high-demand events
9. **DO NOT** assume Airbnb fee is 15.5% markup - the math is different
10. **DO NOT** expect identical daily prices in weekly-stay markets - use seasonal profiles instead

---

## Sources
- [PriceLabs Top 10 Customizations](https://hello.pricelabs.co/top-10-pricelabs-customization/)
- [Optimization Strategies Using Customizations](https://hello.pricelabs.co/optimize-your-pricing-strategies-using-customizations/)
- [How to Optimize Airbnb Pricing 2025](https://hello.pricelabs.co/how-to-optimize-your-airbnb-listings-pricing-in-2025/)
- [Min Stay Recommendation Engine](https://hello.pricelabs.co/minimum-stay-recommendation-engine/)
- [BiggerPockets: PriceLabs Optimization](https://www.biggerpockets.com/forums/530/topics/1078339-pricelabs-optimization-to-increase-revenue)
- [OptimizeMyAirbnb: PriceLabs Customizations Tutorial](https://optimizemyairbnb.com/pricelabs-customizations-tutorial-beginner-advanced/)
- [PriceLabs Min/Base/Max Prices](https://help.pricelabs.co/portal/en/kb/articles/what-are-minimum-base-and-maximum-prices-how-to-set-them-up)
