# PriceLabs Algorithm & Settings Reference

## The Hyper Local Pulse (HLP) Algorithm

### How It Works
HLP defines a hyper-local market as **350 similar-sized nearby listings within a dynamically determined radius of up to 15km**, using H3 hexagons for real-time data updates.

The algorithm calculates the optimal price that maximizes **expected revenue** by understanding the probability of a future date booking at a given price.

### Data Inputs
1. **Seasonality patterns** - Historical pricing and occupancy by season
2. **Day-of-week demand** - Weekday vs. weekend demand variations
3. **Events and holidays** - 4-way detection system:
   - Prior-year pacing data
   - Early demand signals (booking velocity)
   - Competitor pricing changes
   - Hotel price indications
4. **Booking pacing / pickup rate** - Speed at which dates are being booked
5. **Lead time** - Days until check-in
6. **Competitor pricing** - Including hotels and similar STRs
7. **Historical listing performance** - Your property's past results
8. **Local market demand trends** - Real-time market conditions
9. **Review count and rating** (beta, 2025-2026) - Factors your specific reviews into Base Price recommendations

### Performance Claim
Within 3 months of adopting HLP, new PriceLabs users experienced an average **26% boost in RevPAR**.

### Sync Frequency
- Default: Prices sync **nightly between 6pm and 6am Chicago Time**
- Additional manual "Sync Now" available
- 10-minute buffer after configuration changes before pushing
- Customizable sync schedule in settings

---

## Complete Settings Reference

### TIER 1: Core Price Settings

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| **Base Price** | Anchor price; all customizations applied on top | Set at 50th percentile of market booked prices |
| **Minimum Price** | Absolute floor; algorithm never goes below | Set 30-40% below base for flexibility |
| **Maximum Price** | Absolute ceiling; algorithm never exceeds | Set 200-300% above base to capture events |

### TIER 2: Automated Customizations

#### Last-Minute Discounts
- **Default:** Gradual 30% discount over 15 days
- **7 curve options** available
- Markets compress pricing ~18 days before arrival
- Uses "Last-Minute Recommendation" data for your market

#### Far-Out Pricing
- **Options:** Fixed Price, % Change on Base, % Change on Minimum
- For dates where demand signals are weak (90+ days out)

#### Orphan Day / Gap Management
- **Default:** 20% discount on gaps of 2 nights or less
- Configurable by gap length and day-of-week
- Auto min-stay adjustment to prevent creating new gaps
- **Priority rule:** Overrides other settings when reducing min-night

#### Weekend Pricing
- **Default weekend:** Friday-Saturday
- Customizable to any day combination
- Can set different premiums by day

#### Occupancy-Based Adjustments (Listing Level)
- Auto-adjusts rates based on your occupancy percentage
- 4 pre-filled profiles: Short/Medium/Long Booking Window, Custom
- Day ranges must increase sequentially
- Each band must have smaller adjustment than previous

#### Portfolio Occupancy-Based Adjustments (Group Level)
- Adjusts based on occupancy of listing, room type, or entire group
- Especially powerful for multi-unit properties, hotels, apartment buildings

### TIER 3: Stay Configuration

#### Length of Stay Pricing
- Weekly discount (7+ nights)
- Monthly discount (28+ nights)
- Set at listing level

#### Minimum Stay Rules
- Dynamic recommendations (refreshed every 15 days)
- Day-of-week controls (best-in-class)
- Two modes: short-term and mid-term
- Uses opportunity cost vs. guaranteed revenue calculation

**Min Stay Priority:**
1. Date-specific overrides (highest)
2. Far-out customization
3. Last-minute customization
4. Default setting (lowest)

### TIER 4: Override Settings

#### Seasonal Profiles
- Override Min, Base, and Max for date ranges
- Downloadable/uploadable as CSV for bulk management
- Handles scenarios default seasonality doesn't capture

#### Date-Specific Overrides (DSOs)
- Fixed price override
- Percentage override (discount or premium)
- Min-nights override
- **DSO overrides ALL other settings** including Min Price
- Percentage range: -75% to +500%
- Can apply at group level for bulk

### TIER 5: Structural Settings

#### Group-Level Settings
- Apply customizations to property groups (e.g., by city, bedroom count)
- Override account-level defaults

#### Account-Level Settings
- Apply to all listings under a PMS/channel
- Lowest priority in hierarchy

### Setting Priority Hierarchy
```
Listing Level > Group Level > Account Level
DSO > All Other Customizations
Orphan Day (reducing min-stay) > Other Min-Stay Settings
```

### Customization Stacking Rules

**When multiple DISCOUNTS apply to same date:**
- Only the **largest discount** is applied
- Prevents excessive stacking
- Example: Last-minute 20% + Orphan 25% = only 25% applied

**When multiple PREMIUMS apply to same date:**
- **All premiums stack and are applied together**
- Example: Weekend +15% + High occupancy +10% = +25% applied

---

## Demand Color Codes

Available in the API `demand_color` field and in the dashboard:

| Color | Meaning |
|-------|---------|
| Red (#FF0000) | High Demand |
| Orange | Above Average Demand |
| Yellow | Average Demand |
| Green | Below Average Demand |
| Blue | Low Demand |

---

## Health Scores

Available via API in `health_7_day`, `health_30_day`, `health_60_day` fields:
- Indicates how well the listing is performing relative to market
- Use for automated alerting in agent workflows

---

## Neighborhood Data Metrics

Available via `/v1/neighborhood_data` endpoint:

### Future Percentile Prices (by bedroom count)
- 25th percentile
- 50th percentile (median)
- 75th percentile
- Median booked price
- 90th percentile

### Future Occupancy/Bookings
- Occupancy rate
- New bookings
- Cancellations
- Last-year comparisons

### Market KPIs
- Total Available Days
- Booking Window (average lead time)
- Length of Stay (average)
- Revenue
- Total Booked Days

---

## Sources
- [PriceLabs Customizations Blog](https://hello.pricelabs.co/optimize-your-pricing-strategies-using-customizations/)
- [Top 10 Customizations](https://hello.pricelabs.co/top-10-pricelabs-customization/)
- [Min Stay Engine](https://hello.pricelabs.co/minimum-stay-recommendation-engine/)
- [Hotel Dynamic Pricing Guide](https://hello.pricelabs.co/blog/guide-to-hotel-dynamic-pricing/)
- [2026 STR Trends](https://hello.pricelabs.co/blog/short-term-rental-trends/)
