# PriceLabs Agent Architecture

## Agent Purpose

An AI agent that maximizes short-term rental revenue by intelligently operating PriceLabs via its API, monitoring performance, and making data-driven optimization decisions.

---

## Core Capabilities

### 1. Portfolio Monitoring
- Fetch all listings via `GET /v1/listings`
- Track occupancy at 7/30/60/90 day windows
- Compare vs. market occupancy
- Monitor health scores (7/30/60 day)
- Alert on underperforming listings

### 2. Price Analysis & Optimization
- Fetch prices via `POST /v1/listing_prices` with `reason: true`
- Analyze pricing breakdown for each date
- Compare `price` vs `uncustomized_price` to understand customization impact
- Monitor `demand_color` and `demand_desc` for demand signals
- Track ADR vs STLY (same-time-last-year)

### 3. Neighborhood Intelligence
- Fetch market data via `GET /v1/neighborhood_data`
- Track percentile pricing (25th/50th/75th/90th)
- Compare listing pricing to market percentiles
- Monitor market KPIs (booking window, LOS, revenue)
- Alert when listing falls below 25th percentile or above 90th

### 4. Base Price Calibration
- Compare `recommended_base_price` to current base
- Analyze performance over 30-day rolling windows
- Suggest base price adjustments when deviation exceeds threshold
- Apply via `POST /v1/listings`

### 5. Date-Specific Override Management
- Fetch existing DSOs via `GET /v1/listings/{id}/overrides`
- Create event-based overrides via `POST /v1/listings/{id}/overrides`
- Clean up expired overrides via `DELETE /v1/listings/{id}/overrides`
- Detect local events and auto-create premium DSOs

### 6. Reservation Analysis
- Fetch reservations via `GET /v1/reservation_data`
- Track booking pace vs STLY
- Monitor cancellation rates
- Calculate realized RevPAR
- Identify booking patterns (day-of-week, lead time, LOS)

### 7. Sync Management
- Trigger syncs via `POST /v1/push_prices`
- Monitor `last_date_pushed` and `last_refreshed_at`
- Alert on stale syncs (>48 hours)

---

## Agent Workflows

### Daily Workflow
```
1. Fetch all listings → check health scores
2. Identify listings with health_7_day issues
3. For flagged listings → fetch neighborhood_data
4. Compare pricing to market percentiles
5. If pricing > 75th percentile AND low occupancy → suggest base price reduction
6. If pricing < 25th percentile AND high occupancy → suggest base price increase
7. Check for orphan gaps in next 30 days
8. Generate daily summary report
```

### Weekly Workflow
```
1. Run daily workflow
2. Fetch reservation_data for past 7 days
3. Calculate booking pace vs STLY
4. Compare ADR trend vs market
5. Review DSOs for next 90 days
6. Check for upcoming events (external data source)
7. Suggest customization adjustments
8. Generate weekly optimization report
```

### Monthly Workflow
```
1. Run weekly workflow
2. Compare recommended_base_price vs current for all listings
3. Propose base price adjustments where deviation > 10%
4. Analyze seasonal profile effectiveness
5. Review occupancy-based adjustment curve performance
6. Generate monthly strategy report
```

---

## Data Model

### Listing State
```typescript
interface ListingState {
  id: string;
  pms: string;
  name: string;
  location: { lat: number; lng: number; city: string; state: string; country: string };
  bedrooms: number | null;
  pricing: {
    min: number;
    base: number;
    max: number;
    recommended_base: string;
  };
  occupancy: {
    next_7: number;
    next_30: number;
    next_60: number;
    next_90: number;
  };
  market_occupancy: {
    next_7: number;
    next_30: number;
    next_60: number;
    next_90: number;
  };
  health: {
    day_7: string;
    day_30: string;
    day_60: string;
  };
  revenue_past_7: number;
  stly_revenue_past_7: number;
  sync: {
    push_enabled: boolean;
    last_pushed: string; // ISO timestamp
    last_refreshed: string; // ISO timestamp
  };
  tags: string[];
  group: string;
  subgroup: string;
}
```

### Price Day
```typescript
interface PriceDay {
  date: string;
  price: number;
  user_price: number;
  uncustomized_price: number;
  min_stay: number;
  booking_status: string;
  booking_status_STLY: string;
  ADR: number;
  ADR_STLY: number;
  demand: {
    color: string;  // hex
    desc: string;   // "High Demand", etc.
  };
  unbookable: boolean;
  discounts: {
    weekly: number;
    monthly: number;
  };
  extra_person_fee: number;
  extra_person_fee_trigger: number;
  check_in: boolean;
  check_out: boolean;
  reason?: object; // detailed breakdown
}
```

### Market Data
```typescript
interface MarketData {
  listings_used: number;
  currency: string;
  source: "airbnb" | "vrbo";
  location: { lat: number; lng: number };
  percentile_prices: {
    dates: string[];
    p25: number[];
    p50: number[];
    p75: number[];
    median_booked: number[];
    p90: number[];
  };
  future_occupancy: {
    dates: string[];
    occupancy: number[];
    new_bookings: number[];
    cancellations: number[];
  };
  market_kpi: {
    total_available_days: number;
    booking_window: number;
    los: number;
    revenue: number;
    total_booked_days: number;
  };
}
```

---

## Alert Thresholds (Configurable)

| Alert | Condition | Severity |
|-------|-----------|----------|
| Low occupancy | `occupancy_next_30 < market_occupancy_next_30 * 0.8` | Warning |
| Overpriced | Listing price > 90th percentile AND low booking pace | Warning |
| Underpriced | Listing price < 25th percentile AND high booking pace | Info |
| Stale sync | `last_date_pushed` > 48 hours ago | Critical |
| Base price drift | `recommended_base` differs from `base` by > 15% | Warning |
| Health decline | `health_7_day` or `health_30_day` indicates issue | Warning |
| Revenue drop | `revenue_past_7 < stly_revenue_past_7 * 0.7` | Warning |
| Orphan gap | Unbookable gaps < 3 nights in next 30 days | Info |

---

## Technology Stack (Recommendations)

### Option A: Python Agent
```
- httpx or requests for API calls
- APScheduler for cron-like scheduling
- Pydantic for data models
- SQLite or PostgreSQL for state persistence
- Claude API for natural language analysis
```

### Option B: Node.js Agent
```
- axios for API calls
- node-cron for scheduling
- Zod for validation
- SQLite or PostgreSQL for state
- Claude API for analysis
```

### Option C: Claude Code Agent (MCP-based)
```
- Direct Claude Code integration
- PriceLabs API as MCP tools
- Natural language orchestration
- Real-time interactive optimization
```

---

## API Rate Budget

With 1000 requests/hour limit:

| Operation | Requests | Frequency |
|-----------|----------|-----------|
| Get all listings | 1 | Daily |
| Get prices (per listing) | 1 | Daily |
| Get neighborhood data (per listing) | 1 | Weekly |
| Get reservations | 1-5 (paginated) | Daily |
| Push prices | 1 per listing | As needed |
| Get/Set DSOs | 2 per listing | Weekly |

**Budget for 50-listing portfolio:**
- Daily: 50 (prices) + 1 (listings) + 5 (reservations) = ~56 requests
- Weekly adds: 50 (neighborhood) + 100 (DSOs) = ~150 additional
- Well within 1000/hour limit

---

## Sources
- [Customer API Docs](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3)
- [Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC)
