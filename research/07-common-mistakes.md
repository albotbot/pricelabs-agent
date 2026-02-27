# Common PriceLabs Mistakes & Issues

## Setup & Configuration Mistakes

### 1. Static Base Price Without Monitoring
**Mistake:** Setting a base price once and never adjusting.
**Fix:** Use Base Price Help tool monthly. Check Neighborhood Data weekly. Only adjust when consistently under/overperforming over 30+ days.

### 2. Ignoring Orphan Nights
**Mistake:** Not enabling orphan night rules, leaving 1-2 day gaps unbooked.
**Fix:** Enable orphan rules with 20% discount for 1-2 night gaps. Enable auto min-stay adjustment. This alone produced a 7% revenue increase in controlled testing.

### 3. Ignoring Market Data
**Mistake:** Not regularly checking competitive landscape.
**Fix:** Review Neighborhood Data weekly in both daily and monthly views. Build comp set calendars. Filter by bedroom count.

### 4. Panic Pricing / Race to the Bottom
**Mistake:** Drastically dropping prices when bookings slow.
**Fix:** Focus on securing bookings 12-60 days in advance. Use Occupancy-Based Adjustments for gradual changes. Trust the algorithm for daily fluctuations.

### 5. Poor Minimum Stay Configuration
**Mistake:** Same min-stay year-round.
**Fix:** Use "Help Me Choose Minimum Stays" tool (refreshed every 15 days). Longer minimums during peak, shorter during slow. Reduce as dates approach.

### 6. Over-Adjusting or Under-Adjusting
**Mistake:** Either tweaking daily (creating noise) or never intervening.
**Fix:** Review weekly, not daily. Let algorithm handle daily fluctuations. Intervene for events and monthly base price reviews.

### 7. Not Syncing Across Channels
**Mistake:** Different prices on Airbnb, Vrbo, Booking.com without proper sync.
**Fix:** Use PMS-as-hub architecture. Connect all channels through PriceLabs or your PMS.

### 8. Wrong Airbnb Fee Calculation
**Mistake:** Assuming you need to increase price by 15.5% to cover host fee.
**Reality:** The fee is calculated on the final marked-up price, so the math is different. The actual required markup is lower.

### 9. Inconsistent Daily Pricing in Weekly Markets
**Mistake:** In beachfront/resort markets where guests expect consistent weekly rates, PriceLabs sets different prices every day.
**Fix:** Use seasonal profiles with more stable pricing. Or use date-specific overrides for consistent weekly blocks.

---

## Technical & Integration Issues

### 10. VRBO Price Display Mismatches
**Complaint:** PriceLabs rates not matching what guests see on VRBO.
**Workaround:** Verify integration settings. Check that PMS markup and fees are correctly configured. VRBO adds service fees that change the displayed price.

### 11. Booking.com Calendar Sync Gap
**Issue:** Direct Booking.com integration syncs prices but NOT availability.
**Fix:** Set up iCal sync alongside the direct integration for calendar availability.

### 12. Hostaway Dual Pricing Conflict
**Issue:** Cannot use both Hostaway Dynamic Pricing and PriceLabs simultaneously.
**Fix:** Choose one. Disable Hostaway's built-in dynamic pricing before connecting PriceLabs.

### 13. OwnerRez Gap Rule Conflict
**Issue:** Gap night rules between PriceLabs and OwnerRez are incompatible.
**Fix:** Configure gap rules in one system only, not both.

### 14. Guesty API Key Expiration
**Issue:** API key valid for only 4 hours during initial setup.
**Fix:** Complete the connection process quickly after generating the key.

---

## Common Complaints & Workarounds

### Steep Learning Curve
**Complaint:** Interface overwhelming, especially for beginners. Dashboard described as "clunky" and "dated." 2-3 hours initial setup.
**Workaround:**
- Start with basic features (base price, min/max) only
- Add advanced customizations gradually
- Take advantage of PriceLabs onboarding calls
- Review weekly, not daily

### No Mobile App
**Complaint:** No dedicated mobile app; website not fully mobile-optimized.
**Workaround:** Access through mobile browser. Manage critical adjustments through PMS mobile apps.

### Customer Service Inconsistency
**Complaint:** Some tickets unanswered for over a week; no phone support. Others praise fast, responsive support.
**Workaround:** Book 15-minute call slots for urgent issues. Use knowledge base and community forums for self-service.

### Billing Issues
**Complaint:** Full monthly charge even for partial-month usage. No pro-rata billing. Reports of charges after cancellation.
**Workaround:** Cancel well before billing cycle. Document cancellation with screenshots.

### Data Accuracy in Thin Markets
**Complaint:** Recommendations can be misleading in markets with few comparable listings.
**Workaround:** Always cross-check with Neighborhood Data. Use comp sets to validate. Rely more on manual adjustments in thin markets.

### Cost for Single-Property Hosts
**Complaint:** At $19.99/month, cost-benefit questionable for single properties.
**Workaround:** Test during 30-day free trial. If revenue increase (typically 20-40%) exceeds $20/month, it's worth it. Consider Wheelhouse free tier as alternative.

---

## Trustpilot Review Distribution
- 84% five-star reviews
- 9% one-star reviews
- **Bimodal distribution** — most users love it, small minority have serious complaints
- Common 1-star themes: billing disputes, support responsiveness, data accuracy in thin markets

---

## Sources
- [Capterra Reviews](https://www.capterra.com/p/158348/PriceLabs/reviews/)
- [BiggerPockets Forum](https://www.biggerpockets.com/forums/530/topics/1078339-pricelabs-optimization-to-increase-revenue)
- Community discussions on Reddit
- [PriceLabs Help Center](https://help.pricelabs.co/)
