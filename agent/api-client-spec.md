# PriceLabs API Client Specification

## Client Configuration

```typescript
interface PriceLabsClientConfig {
  apiKey: string;           // X-API-Key header value
  baseUrl: string;          // "https://api.pricelabs.co"
  timeout: number;          // 300000 (300 seconds recommended)
  maxRetries: number;       // 3
  rateLimitPerHour: number; // 1000
}
```

## Endpoint Implementations

### 1. getListings(options?)
```
GET /v1/listings
Query: { skip_hidden?: boolean, only_syncing_listings?: boolean }
Returns: ListingState[]
Rate: 1 request
```

### 2. getListing(listingId)
```
GET /v1/listings/{listing_id}
Returns: ListingState
Rate: 1 request
```

### 3. updateListings(listings)
```
POST /v1/listings
Body: { listings: [{ id, pms, min?, base?, max?, tags? }] }
Returns: { listings: [{ id, min, base, max }] }
Rate: 1 request
```

### 4. getPrices(listings)
```
POST /v1/listing_prices
Body: { listings: [{ id, pms, dateFrom?, dateTo?, reason?: boolean }] }
Returns: ListingPriceResponse[]
Rate: 1 request (batch multiple listings)
```

### 5. getOverrides(listingId, pms)
```
GET /v1/listings/{listing_id}/overrides?pms={pms}
Returns: Override[]
Rate: 1 request
```

### 6. setOverrides(listingId, overrides)
```
POST /v1/listings/{listing_id}/overrides
Body: { pms, update_children?, overrides: Override[] }
Returns: { overrides: Override[], child_listings_update_info? }
Rate: 1 request
```

### 7. deleteOverrides(listingId, dates, pms)
```
DELETE /v1/listings/{listing_id}/overrides
Body: { overrides: [{ date }], pms, update_children? }
Returns: 204 No Content
Rate: 1 request
```

### 8. getNeighborhoodData(listingId, pms)
```
GET /v1/neighborhood_data?pms={pms}&listing_id={listing_id}
Returns: MarketData
Rate: 1 request
```

### 9. getReservations(options)
```
GET /v1/reservation_data
Query: { pms?, start_date, end_date, limit?, offset? }
Returns: { pms_name, next_page, data: Reservation[] }
Rate: 1 request per page
```

### 10. pushPrices(listingId, pmsName)
```
POST /v1/push_prices
Body: { listing, pms_name }
Returns: confirmation
Rate: 1 request
```

### 11. getRatePlans(listingId, pmsName)
```
GET /v1/fetch_rate_plans?listing_id={id}&pms_name={pms}
Returns: RatePlanResponse
Rate: 1 request
```

## Error Handling

```typescript
interface PriceLabsError {
  status: number;       // HTTP status code
  message: string;      // Error description
  retryable: boolean;   // Whether to retry
  retryAfter?: number;  // Seconds to wait (for 429)
}

// Error handling strategy:
// 429: Wait for Retry-After header, then retry
// 400: Log error, do not retry (bad request)
// 401: Alert — API key issue
// 500+: Retry up to 3 times with exponential backoff
```

## Rate Limiter Implementation

```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxPerHour: number = 1000;

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove requests older than 1 hour
    this.requests = this.requests.filter(t => now - t < 3600000);
    if (this.requests.length >= this.maxPerHour) {
      const waitMs = this.requests[0] + 3600000 - now;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    this.requests.push(Date.now());
  }
}
```

## Caching Strategy

| Endpoint | Cache Duration | Invalidation |
|----------|---------------|-------------|
| getListings | 1 hour | On update |
| getListing | 1 hour | On update |
| getPrices | 6 hours | On sync trigger |
| getNeighborhoodData | 24 hours | Daily refresh |
| getReservations | 1 hour | On new booking |
| getOverrides | 6 hours | On override change |

## Batch Operations

For portfolio-wide operations, batch API calls efficiently:

```typescript
// Good: Batch price fetches (single request)
const prices = await client.getPrices([
  { id: "1", pms: "airbnb" },
  { id: "2", pms: "airbnb" },
  { id: "3", pms: "airbnb" }
]);

// Bad: Individual price fetches (3 requests)
const p1 = await client.getPrices([{ id: "1", pms: "airbnb" }]);
const p2 = await client.getPrices([{ id: "2", pms: "airbnb" }]);
const p3 = await client.getPrices([{ id: "3", pms: "airbnb" }]);
```

## Special API Behaviors to Handle

1. **DSO percentage range:** -75 to 500 — validate before sending
2. **Currency must match PMS** when price_type is "fixed"
3. **min_stay must be integer > 0**
4. **check_in/check_out binary strings:** 7 characters representing Mon-Sun (e.g., "1111100")
5. **add_listing_data only works for "bookingsync" PMS**
6. **Erroneous DSO dates silently omitted** from response
7. **listing_prices error statuses** appear in place of data: LISTING_NOT_PRESENT, LISTING_NO_DATA, LISTING_TOGGLE_OFF
