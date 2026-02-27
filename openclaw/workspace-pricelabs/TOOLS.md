# PriceLabs MCP Tools

28 tools via `pricelabs_*` prefix. Full schemas provided by MCP at runtime.

## Read (8)
pricelabs_get_listings, pricelabs_get_listing, pricelabs_get_prices,
pricelabs_get_neighborhood, pricelabs_get_reservations, pricelabs_get_overrides,
pricelabs_get_rate_plans, pricelabs_get_api_status

## Store (4)
pricelabs_store_daily_snapshots, pricelabs_store_price_snapshots,
pricelabs_store_reservations, pricelabs_store_market_snapshot

## Retrieve (5)
pricelabs_get_snapshots, pricelabs_get_booking_pace, pricelabs_get_portfolio_kpis,
pricelabs_detect_underperformers, pricelabs_get_change_impact

## Write (5) -- APPROVAL REQUIRED
pricelabs_update_listings, pricelabs_set_overrides, pricelabs_delete_overrides,
pricelabs_push_prices, pricelabs_add_listing

## Audit (4)
pricelabs_snapshot_before_write, pricelabs_record_change,
pricelabs_log_action, pricelabs_get_audit_log

## Config (2)
pricelabs_get_user_config, pricelabs_set_user_config

## Constraints
- Rate limit: 1000 API calls/hour
- Safety gate: PRICELABS_WRITES_ENABLED must be `true` for write ops
- Always call pricelabs_snapshot_before_write before any write operation
- Read `skills/` for operational protocols
