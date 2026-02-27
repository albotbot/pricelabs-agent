# PriceLabs API Reference

> Complete technical documentation for building agents and integrations

## API Ecosystem Overview

PriceLabs has **3 distinct API products** plus a widget:

| API | Base URL | Auth | Rate Limit | For |
|-----|----------|------|------------|-----|
| Customer API | `api.pricelabs.co` | `X-API-Key` header | 1000/hour | End-user customers |
| Integration API (IAPI) | `api.pricelabs.co/v1/integration/api` | `X-INTEGRATION-TOKEN` + `X-INTEGRATION-NAME` | 300/minute | PMS/OTA partners |
| Revenue Estimator API | `api.pricelabs.co/widgets/re_widget` | Domain whitelisting | Per plan | Realtors, PMs |

---

## PART 1: CUSTOMER API

**For:** End users who want programmatic access to their PriceLabs account.
**Cost:** $1/listing/month (plus taxes)
**Docs:** [SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) | [Postman](https://documenter.getpostman.com/view/507656/SVSEurQC)

### Authentication

```
Header: X-API-Key: <your-api-key>
```

**How to get your key:**
1. Go to PriceLabs Account Settings
2. Navigate to "API Details"
3. Click "Enable"
4. Choose "I Need API Access"

### Rate Limits
- **1000 requests/hour** per API key
- Exceeded: HTTP `429 Too Many Requests`
- Recommended client timeout: **300 seconds**

---

### Endpoint 1: GET /v1/listings

Get all listings in an account.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `skip_hidden` | string | `true`/`false` - Filter hidden listings |
| `only_syncing_listings` | string | `true`/`false` - Filter by sync status |

**Response Fields:**
```json
{
  "id": "string",
  "pms": "string",              // e.g. "airbnb", "rentalsunited", "vrm"
  "name": "string",
  "latitude": "number",
  "longitude": "number",
  "country": "string",
  "city_name": "string",
  "state": "string",
  "no_of_bedrooms": "number|null",
  "min": "number",              // minimum price
  "base": "number",             // base price
  "max": "object",              // maximum price
  "group": "string",
  "subgroup": "string",
  "tags": ["string"],
  "notes": "string",
  "isHidden": "boolean",
  "push_enabled": "boolean",    // sync toggled on?
  "occupancy_next_7": "number",
  "occupancy_next_30": "number",
  "occupancy_next_60": "number",
  "occupancy_next_90": "number",
  "market_occupancy_next_7": "number",
  "market_occupancy_next_30": "number",
  "market_occupancy_next_60": "number",
  "market_occupancy_next_90": "number",
  "revenue_past_7": "number",
  "stly_revenue_past_7": "number",  // same-time-last-year
  "recommended_base_price": "string",
  "last_date_pushed": "ISO timestamp",
  "last_refreshed_at": "ISO timestamp",
  "health_7_day": "string",
  "health_30_day": "string",
  "health_60_day": "string"
}
```

**Example:**
```bash
curl --location 'https://api.pricelabs.co/v1/listings' \
  --header 'X-API-Key: YOUR_API_KEY'
```

---

### Endpoint 2: GET /v1/listings/{listing_id}

Get a specific listing by ID.

```bash
curl --location 'https://api.pricelabs.co/v1/listings/2854562' \
  --header 'X-API-Key: YOUR_API_KEY'
```

---

### Endpoint 3: POST /v1/listings

Update one or more listings (min/base/max prices, tags).

**Request Body:**
```json
{
  "listings": [
    {
      "id": "string (REQUIRED)",
      "pms": "string (REQUIRED)",
      "min": "number (optional)",
      "base": "number (optional)",
      "max": "number (optional)",
      "tags": ["max 10 tags (optional)"]
    }
  ]
}
```

**Response:** `200 OK` with updated values. `400` for invalid listing/PMS.

---

### Endpoint 4: POST /v1/add_listing_data

Import newly added listings from PMS. **Only works for "bookingsync" PMS.**

```json
{
  "listing_id": "1234",
  "pms_name": "bookingsync"
}
```

---

### Endpoint 5: GET /v1/listings/{listing_id}/overrides

Fetch Date-Specific Overrides (DSOs) for a listing.

**Query:** `?pms=airbnb`

**Response Fields:**
```json
{
  "date": "YYYY-MM-DD",
  "price": "string",
  "price_type": "fixed|percent",
  "currency": "string",
  "min_stay": "number",
  "min_price": "number|null",
  "min_price_type": "fixed|percent_base|percent_min",
  "max_price": "number",
  "max_price_type": "fixed|percent_base|percent_max",
  "check_in_check_out_enabled": "0|1",
  "check_in": "string",       // 7-char binary M-Su e.g. "1111100"
  "check_out": "string",      // 7-char binary M-Su
  "reason": "string"
}
```

---

### Endpoint 6: POST /v1/listings/{listing_id}/overrides

Add/update Date-Specific Overrides.

**Request Body:**
```json
{
  "pms": "airbnb",
  "update_children": true,
  "overrides": [
    {
      "date": "2024-11-10",
      "price": "250",
      "price_type": "percent",     // "fixed" or "percent"
      "currency": "EUR",           // must match PMS currency when fixed
      "min_stay": 10,              // integer > 0
      "min_price": 200,
      "min_price_type": "fixed",
      "max_price": 500,
      "max_price_type": "fixed",
      "base_price": 200,
      "check_in_check_out_enabled": "1",
      "check_in": "1111100",
      "check_out": "1111100",
      "reason": "Special event"
    }
  ]
}
```

**Business Rules:**
- DSO percentage range: **-75 to 500**
- When `price_type` is `fixed`, `currency` must match PMS currency exactly
- Erroneous dates are silently omitted from response
- DSO overrides ALL other settings including Min Price

---

### Endpoint 7: DELETE /v1/listings/{listing_id}/overrides

```json
{
  "overrides": [{"date": "2024-11-10"}],
  "pms": "airbnb",
  "update_children": false
}
```

**Response:** `204 No Content`

---

### Endpoint 8: POST /v1/listing_prices

Get calculated prices for listings. **Most important endpoint for agent development.**

**Request:**
```json
{
  "listings": [
    {
      "id": "12345",
      "pms": "airbnb",
      "dateFrom": "2024-01-01",
      "dateTo": "2024-03-31",
      "reason": true              // include pricing breakdown
    }
  ]
}
```

**Response Fields:**
```json
{
  "id": "string",
  "pms": "string",
  "group": "string",
  "currency": "string",
  "last_refreshed_at": "ISO timestamp",
  "los_pricing": {
    "3": {
      "los_night": "3",
      "max_price": "500",
      "min_price": "100",
      "los_adjustment": "-5"
    }
  },
  "data": [
    {
      "date": "string",
      "price": "number",              // final calculated price
      "user_price": "number",         // user-customized price
      "uncustomized_price": "number", // price before customizations
      "min_stay": "number",
      "booking_status": "string",
      "booking_status_STLY": "string",
      "ADR": "number",               // -1 if unavailable
      "ADR_STLY": "number",
      "unbookable": "0|1",
      "weekly_discount": "number",
      "monthly_discount": "number",
      "extra_person_fee": "number",
      "extra_person_fee_trigger": "number",
      "check_in": "boolean",
      "check_out": "boolean",
      "demand_color": "#hex",         // e.g. "#FF0000"
      "demand_desc": "string",        // e.g. "High Demand"
      "booked_date": "string",
      "booked_date_STLY": "string",
      "reason": {}                    // detailed breakdown (if requested)
    }
  ]
}
```

**Error Status Values (instead of data):**
| Status | Meaning |
|--------|---------|
| `LISTING_NOT_PRESENT` | Listing doesn't exist in PriceLabs |
| `LISTING_NO_DATA` | Prices not yet calculated |
| `LISTING_TOGGLE_OFF` | Sync disabled for listing |

---

### Endpoint 9: POST /v1/push_prices

Trigger price sync for a listing.

```json
{
  "listing": "12345",
  "pms_name": "airbnb"
}
```

---

### Endpoint 10: GET /v1/fetch_rate_plans

Fetch rate plan adjustments.

**Query:** `?listing_id=12345&pms_name=airbnb`

**Response:**
```json
{
  "rate_plans": {
    "id": "...",
    "pms": "...",
    "name": "...",
    "rateplans": {
      "rate_plan_id": {
        "name": "string",
        "type": "string",
        "default": "string",
        "plan_type": "string",
        "adjustment": "number",
        "update_type": "string"
      }
    }
  }
}
```

---

### Endpoint 11: GET /v1/neighborhood_data

Get neighborhood comparison data.

**Query:** `?pms=airbnb&listing_id=12345`

**Response Structure:**
```json
{
  "status": "string",
  "data": {
    "Listings Used": "number",
    "currency": "string",
    "source": "airbnb|vrbo",
    "lat": "number",
    "lng": "number",
    "Neighborhood Data Source": "string",
    "Future Percentile Prices": {
      "X_values": ["dates"],
      "Y_values": [
        ["25th percentile"],
        ["50th percentile"],
        ["75th percentile"],
        ["median booked"],
        ["90th percentile"]
      ]
    },
    "Summary Table Base Price": {},
    "Future Occ/New/Canc": {},
    "Market KPI": {}
  }
}
```

---

### Endpoint 12: GET /v1/reservation_data

Get reservations from PMS.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| `pms` | string | optional |
| `start_date` | YYYY-MM-DD | required |
| `end_date` | YYYY-MM-DD | required |
| `limit` | number | 100 |
| `offset` | number | 0 |

**Response:**
```json
{
  "pms_name": "string",
  "next_page": "boolean",
  "data": [
    {
      "listing_id": "string",
      "listing_name": "string",
      "reservation_id": "string",
      "check_in": "ISO date",
      "check_out": "ISO date",
      "booked_date": "ISO timestamp",
      "cancelled_on": "ISO timestamp",
      "booking_status": "booked|cancelled",
      "rental_revenue": "string",
      "total_cost": "string",
      "no_of_days": "number",
      "currency": "string"
    }
  ]
}
```

---

## PART 2: INTEGRATION API (IAPI)

**For:** PMS/OTA/Channel Manager partners building a native PriceLabs integration.
**Docs:** [SwaggerHub](https://app.swaggerhub.com/apis/PriceLabs/price-labs_connector/1.0.0)

### Authentication
```
X-INTEGRATION-TOKEN: <partner-token>
X-INTEGRATION-NAME: <pms-identifier>
```

**How to get credentials:** Email support@pricelabs.co with PMS name, type, dev account email.

### Rate Limit: 300 requests/minute

### Webhook Security: HMAC-SHA256

PriceLabs signs all webhook requests to PMS. Headers:
- `X-SOURCE`, `X-PL-TIMESTAMP`, `X-PL-REQUESTID`
- `X-PL-SIGNED-HEADERS`, `X-PL-SIGNED-BODY`

**Signature Algorithm:**
```
api_token = "your-token"
header_components = "v1:{X-SOURCE}:{X-PL-TIMESTAMP}:{X-PL-REQUESTID}"
signed_headers = "v1." + HMAC_SHA256(header_components, api_token)
body_components = signed_headers + json_body_string
signed_body = HMAC_SHA256(body_components, api_token)
```

### IAPI Endpoints Summary

| Method | Endpoint | Purpose | Required? |
|--------|----------|---------|-----------|
| POST | /integration | Set URLs, features, regenerate token | MANDATORY |
| POST | /listings | Create/update listings | MANDATORY |
| POST | /calendar | Push rates and availability | MANDATORY |
| POST | /get_prices | Retrieve dynamic pricing | Recommended |
| POST | /reservations | Push reservation data | Required for Portfolio Analytics |
| POST | /rate_plans | Add/update rate plans | Optional |
| POST | /status | Query current state | Optional |

### PMS Must Implement These Webhooks

| Webhook | Purpose | Trigger |
|---------|---------|---------|
| `sync_url` | Receive pricing from PriceLabs | User sync ON, manual sync, daily refresh |
| `calendar_trigger_url` | PriceLabs requests calendar refresh | PriceLabs needs updated data |
| `hook_url` | Error notifications | Sync failures, API timeouts |

### Integration Flow
1. PMS receives credentials from PriceLabs
2. PMS calls `/integration` to set URLs and features
3. User creates listing -> PMS calls `/listings` then `/calendar` (730 days minimum)
4. Rate/availability changes -> PMS calls `/calendar` with deltas
5. PriceLabs triggers `calendar_trigger_url` -> PMS responds via `/calendar`
6. PriceLabs triggers `sync_url` with dynamic prices -> PMS applies them
7. PMS calls `/reservations` for all booking activity
8. Certification process before go-live

---

## PART 3: REVENUE ESTIMATOR API & WIDGET

### Widget (No-Code)

```html
<!-- Step 1: Container -->
<div id="pricelabs-re-widget-div"></div>

<!-- Step 2: Script in footer -->
<script type="text/javascript" src="https://api.pricelabs.co/widgets/re_widget"></script>
```

### API Pricing
| Plan | Monthly | Included | Overage |
|------|---------|----------|---------|
| Plan 1 | $75 | 100 searches | $0.75/search |
| Plan 2 | $249 | 500 searches | $0.50/search |

First 20 calls free for testing.

---

## Key URLs for Agent Development

| Resource | URL |
|----------|-----|
| Customer API SwaggerHub | `https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3` |
| Customer API OpenAPI Spec | `https://api.swaggerhub.com/apis/Customer_API/customer_api/1.0.0-oas3` |
| Integration API SwaggerHub | `https://app.swaggerhub.com/apis/PriceLabs/price-labs_connector/1.0.0` |
| Integration API OpenAPI Spec | `https://api.swaggerhub.com/apis/PriceLabs/price-labs_connector/1.0.0` |
| Postman Collection | `https://documenter.getpostman.com/view/507656/SVSEurQC` |
| Revenue Estimator Widget | `https://api.pricelabs.co/widgets/re_widget` |
| Certification Checklist | `https://docs.google.com/spreadsheets/d/1nSzDMLMneX3Byukieo9CYhbXksYIL_NfT87tmBA5aP4/edit` |

## Error Codes (All APIs)

| Code | Meaning |
|------|---------|
| `200` | Success |
| `204` | No Content (successful delete) |
| `400` | Bad Request |
| `401` | Unauthorized |
| `429` | Too Many Requests (rate limited) |

## Sources
- [PriceLabs Customer API](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api)
- [Building an Integration](https://help.pricelabs.co/portal/en/kb/articles/building-an-integration-with-pricelabs)
- [Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC)
- [Dynamic Pricing API](https://hello.pricelabs.co/dynamic-pricing-api/)
- [Open API Launch](https://hello.pricelabs.co/pricelabs-launches-open-api/)
- [Revenue Estimator API](https://hello.pricelabs.co/revenue-estimator-api-widget/)
