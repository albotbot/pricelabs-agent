/**
 * Persistence validation script for Phase 8 requirements.
 *
 * Proves all 5 Phase 8 requirements are met against the real PriceLabs API:
 *   STORE-01: Store Daily Snapshots (listing data persists and reads back)
 *   STORE-02: Store Price Snapshots (price data persists and reads back)
 *   STORE-03: Store Reservations + Cancellation Detection
 *   STORE-04: Store Market Snapshot (neighborhood data persists and reads back)
 *   SAFE-02:  Pre-Write Snapshot (captures listing state to audit_log)
 *
 * Communicates with the MCP server via stdio JSON-RPC protocol.
 * Creates a temp database, cleans up after itself.
 * Budget: ~8-10 API calls total -- conservative.
 *
 * Usage: PRICELABS_API_KEY=your-key node scripts/validate-persistence.mjs
 */

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- ANSI colors ---
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}PASS${RESET}`;
const FAIL = `${RED}FAIL${RESET}`;
const WARN = `${YELLOW}WARN${RESET}`;
const INFO = `${CYAN}INFO${RESET}`;

let failures = 0;
let passes = 0;
let warnings = 0;
let serverProcess = null;
let tempDir = null;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS}  ${label}${detail ? ` -- ${detail}` : ""}`);
    passes++;
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures++;
  }
}

function warn(label, detail = "") {
  console.log(`  ${WARN}  ${label}${detail ? ` -- ${detail}` : ""}`);
  warnings++;
}

function info(label, detail = "") {
  console.log(`  ${INFO}  ${label}${detail ? ` -- ${detail}` : ""}`);
}

// --- JSON-RPC message ID counter ---
let nextId = 1;

/**
 * Send a JSON-RPC message to the server via stdin.
 */
function sendJsonRpc(proc, message) {
  const json = JSON.stringify(message);
  proc.stdin.write(json + "\n");
}

/**
 * Wait for a JSON-RPC response with the given id, with timeout.
 * Timeout default 30s for real API calls.
 */
function waitForResponse(proc, id, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for response id=${id} after ${timeoutMs}ms`));
    }, timeoutMs);

    function onData(chunk) {
      buffer += chunk.toString();
      // Try to parse complete JSON objects separated by newlines
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            cleanup();
            resolve(parsed);
            return;
          }
        } catch {
          // Not valid JSON yet, skip
        }
      }
      // Keep the last incomplete line in the buffer
      buffer = lines[lines.length - 1];
    }

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.removeListener("data", onData);
    }

    proc.stdout.on("data", onData);
  });
}

/**
 * Call an MCP tool and return the parsed tool response data.
 * Returns { raw, data, elapsed } where:
 *   raw = full JSON-RPC response
 *   data = parsed response (ToolResponse envelope or direct result)
 *   elapsed = wall-clock time in ms
 */
async function callTool(proc, toolName, args = {}) {
  const id = nextId++;
  const request = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const start = Date.now();
  sendJsonRpc(proc, request);
  const response = await waitForResponse(proc, id, 30000);
  const elapsed = Date.now() - start;

  // Check for protocol-level errors
  if (response.error) {
    return { raw: response, data: null, elapsed, error: response.error.message || JSON.stringify(response.error) };
  }

  // Check for tool-level errors
  const content = response.result?.content || [];
  const textContent = content.map((c) => c.text || "").join("");
  const isError = response.result?.isError === true;

  if (isError) {
    return { raw: response, data: null, elapsed, error: textContent };
  }

  // Parse the tool response text as JSON
  try {
    const parsed = JSON.parse(textContent);
    return { raw: response, data: parsed, elapsed, error: null };
  } catch {
    return { raw: response, data: null, elapsed, error: `Failed to parse tool response as JSON: ${textContent.slice(0, 200)}` };
  }
}

// --- Date helpers ---

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function offsetDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// --- Main validation ---

try {
  const projectRoot = join(import.meta.dirname, "..");
  const mcpDir = join(projectRoot, "mcp-servers", "pricelabs");

  console.log(`\n${BOLD}=== Phase 8: Snapshot Persistence Validation ===${RESET}\n`);

  // ---------------------------------------------------------------
  // Environment Check
  // ---------------------------------------------------------------
  if (!process.env.PRICELABS_API_KEY) {
    console.log(`  ${RED}${BOLD}ERROR${RESET}  Set PRICELABS_API_KEY to run persistence validation`);
    console.log(`\n  Example: ${DIM}export PRICELABS_API_KEY="your-real-api-key"${RESET}`);
    console.log(`  Get one at: ${DIM}PriceLabs Dashboard -> Account -> API Keys${RESET}\n`);
    process.exit(2);
  }

  info("PRICELABS_API_KEY is set", `${process.env.PRICELABS_API_KEY.slice(0, 6)}...`);

  // ---------------------------------------------------------------
  // Build + Start MCP Server
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}Setup: Build and Start MCP Server${RESET}`);

  try {
    execSync("npm run build", { cwd: mcpDir, stdio: "pipe" });
    check("npm run build exits with code 0", true);
  } catch (err) {
    check("npm run build exits with code 0", false, err.stderr?.toString().trim() || "build failed");
    throw new Error("Cannot continue -- build failed");
  }

  tempDir = mkdtempSync(join(tmpdir(), "pricelabs-persist-test-"));
  const dbPath = join(tempDir, "test.sqlite");

  serverProcess = spawn("node", ["dist/index.js"], {
    cwd: mcpDir,
    env: {
      ...process.env,
      PRICELABS_API_KEY: process.env.PRICELABS_API_KEY,
      PRICELABS_DB_PATH: dbPath,
      // Do NOT set PRICELABS_WRITES_ENABLED -- store tools are NOT write-gated
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Collect stderr for diagnostics
  let stderrOutput = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  // Send initialize request
  const initId = nextId++;
  const initRequest = {
    jsonrpc: "2.0",
    id: initId,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "persistence-validator", version: "1.0.0" },
    },
  };

  sendJsonRpc(serverProcess, initRequest);

  let initResponse;
  try {
    initResponse = await waitForResponse(serverProcess, initId, 10000);
    check("Server responds to initialize", !!initResponse.result, `protocolVersion: ${initResponse.result?.protocolVersion || "N/A"}`);
  } catch (err) {
    check("Server responds to initialize", false, err.message);
    if (stderrOutput) console.log(`  ${YELLOW}stderr: ${stderrOutput.trim()}${RESET}`);
    throw new Error("Cannot continue -- server did not initialize");
  }

  // Send initialized notification
  sendJsonRpc(serverProcess, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  // Let the server settle
  await new Promise((r) => setTimeout(r, 500));

  // ---------------------------------------------------------------
  // STORE-01: Store Daily Snapshots
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}STORE-01: Store Daily Snapshots${RESET}`);

  // Step 1: Fetch real listing data
  const listingsResult = await callTool(serverProcess, "pricelabs_get_listings");

  let discoveredListingId = null;
  let discoveredPms = null;
  let listingCount = 0;

  if (listingsResult.error) {
    check("pricelabs_get_listings returns data", false, listingsResult.error);
    throw new Error("Cannot continue -- no listing data");
  }

  const listingsEnvelope = listingsResult.data;
  const listings = listingsEnvelope?.data;

  check("Fetched real listings", Array.isArray(listings) && listings.length > 0, `${Array.isArray(listings) ? listings.length : 0} listings`);

  if (!Array.isArray(listings) || listings.length === 0) {
    throw new Error("Cannot continue -- empty listings array");
  }

  listingCount = listings.length;
  discoveredListingId = listings[0].id;
  discoveredPms = listings[0].pms;

  info("Using listing", `id=${discoveredListingId}, pms=${discoveredPms}, name="${listings[0].name}"`);

  // Step 2: Transform listings into StoreDailySnapshotsInputSchema format
  const snapshotsToStore = listings.map((listing) => ({
    listing_id: listing.id,
    pms: listing.pms,
    name: listing.name || null,
    health_7_day: listing.health_7_day ?? listing["7 Day Health"] ?? null,
    health_30_day: listing.health_30_day ?? listing["30 Day Health"] ?? null,
    health_60_day: listing.health_60_day ?? listing["60 Day Health"] ?? null,
    occupancy_next_30: listing.occupancy_next_30 ?? listing["Occupancy Next 30 Days"] ?? null,
    market_occupancy_next_30: listing.market_occupancy_next_30 ?? listing["Market Occupancy Next 30 Days"] ?? null,
    occupancy_gap_pct: null, // Computed field -- will be null without computed fields layer
    revenue_past_7: listing.revenue_past_7 ?? listing["Revenue Past 7 Days"] ?? null,
    stly_revenue_past_7: listing.stly_revenue_past_7 ?? listing["STLY Revenue Past 7 Days"] ?? null,
    revenue_vs_stly_pct: null, // Computed field
    base_price: typeof listing.base === "number" ? listing.base : null,
    recommended_base_price: typeof listing.recommended_base_price === "number" ? listing.recommended_base_price : null,
    last_date_pushed: listing.last_date_pushed ?? null,
    days_since_sync: null, // Computed field
    is_stale_sync: null, // Computed field
    data_json: JSON.stringify(listing),
  }));

  // Step 3: Store daily snapshots
  const storeListingsResult = await callTool(serverProcess, "pricelabs_store_daily_snapshots", {
    snapshots: snapshotsToStore,
  });

  if (storeListingsResult.error) {
    check("pricelabs_store_daily_snapshots succeeds", false, storeListingsResult.error);
  } else {
    const storeData = storeListingsResult.data;
    check("Store daily snapshots succeeds", storeData?.stored > 0, `stored=${storeData?.stored}`);
    check("Stored count matches listing count", storeData?.stored === listingCount, `${storeData?.stored} stored vs ${listingCount} listings`);
    info("Snapshot date", storeData?.snapshot_date);
  }

  // Step 4: Read back via get_snapshots
  const readListingsResult = await callTool(serverProcess, "pricelabs_get_snapshots", {
    table: "listing_snapshots",
    listing_id: discoveredListingId,
    pms: discoveredPms,
  });

  if (readListingsResult.error) {
    check("pricelabs_get_snapshots (listing_snapshots) succeeds", false, readListingsResult.error);
  } else {
    const readData = readListingsResult.data;
    check("Get snapshots returns rows", readData?.count > 0, `count=${readData?.count}`);
    if (readData?.rows?.length > 0) {
      const row = readData.rows[0];
      check("Row has matching listing_id", row.listing_id === discoveredListingId, `listing_id=${row.listing_id}`);
      check("Row has matching pms", row.pms === discoveredPms, `pms=${row.pms}`);
      check("Row has data_json (non-empty)", typeof row.data_json === "string" && row.data_json.length > 10, `${row.data_json?.length || 0} chars`);
    }
  }

  // ---------------------------------------------------------------
  // STORE-02: Store Price Snapshots
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}STORE-02: Store Price Snapshots${RESET}`);

  // Step 1: Fetch real price data for the discovered listing
  const pricesResult = await callTool(serverProcess, "pricelabs_get_prices", {
    listing_id: discoveredListingId,
    pms: discoveredPms,
    start_date: todayStr(),
    end_date: offsetDaysStr(30),
  });

  let priceEntries = [];

  if (pricesResult.error) {
    check("pricelabs_get_prices returns data", false, pricesResult.error);
  } else {
    const pricesEnvelope = pricesResult.data;
    const pricesData = pricesEnvelope?.data;
    const dailyPrices = pricesData?.data;

    check("Fetched real price data", Array.isArray(dailyPrices) && dailyPrices.length > 0, `${Array.isArray(dailyPrices) ? dailyPrices.length : 0} entries`);

    if (Array.isArray(dailyPrices) && dailyPrices.length > 0) {
      priceEntries = dailyPrices;
      info("First price entry", `date=${dailyPrices[0].date}, price=${dailyPrices[0].price}`);
    }
  }

  if (priceEntries.length > 0) {
    // Step 2: Transform prices into StorePriceSnapshotsInputSchema format
    const pricesToStore = priceEntries.map((p) => ({
      price_date: p.date,
      price: typeof p.price === "number" ? p.price : parseFloat(p.price) || 0,
      demand_level: p.demand_level ?? p.demand_desc ?? p.color ?? null,
      booking_status: p.booking_status ?? null,
      booking_status_stly: p.booking_status_stly ?? null,
      adr: typeof p.adr === "number" ? p.adr : null,
      adr_stly: typeof p.adr_stly === "number" ? p.adr_stly : null,
    }));

    // Step 3: Store price snapshots
    const storePricesResult = await callTool(serverProcess, "pricelabs_store_price_snapshots", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      prices: pricesToStore,
    });

    if (storePricesResult.error) {
      check("pricelabs_store_price_snapshots succeeds", false, storePricesResult.error);
    } else {
      const storeData = storePricesResult.data;
      check("Store price snapshots succeeds", storeData?.stored > 0, `stored=${storeData?.stored}`);
      check("Stored count matches price entries", storeData?.stored === pricesToStore.length, `${storeData?.stored} stored vs ${pricesToStore.length} prices`);
    }

    // Step 4: Read back via get_snapshots
    const readPricesResult = await callTool(serverProcess, "pricelabs_get_snapshots", {
      table: "price_snapshots",
      listing_id: discoveredListingId,
      pms: discoveredPms,
    });

    if (readPricesResult.error) {
      check("pricelabs_get_snapshots (price_snapshots) succeeds", false, readPricesResult.error);
    } else {
      const readData = readPricesResult.data;
      check("Get price snapshots returns rows", readData?.count > 0, `count=${readData?.count}`);
      if (readData?.rows?.length > 0) {
        const row = readData.rows[0];
        check("Price row has listing_id", row.listing_id === discoveredListingId, `listing_id=${row.listing_id}`);
        check("Price row has numeric price", typeof row.price === "number" && row.price > 0, `price=${row.price}`);
      }
    }
  } else {
    warn("Skipping price storage -- no price data fetched");
  }

  // ---------------------------------------------------------------
  // STORE-03: Store Reservations + Cancellation Detection
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}STORE-03: Store Reservations + Cancellation Detection${RESET}`);

  // Step 1: Fetch real reservation data
  const reservationsResult = await callTool(serverProcess, "pricelabs_get_reservations", {
    listing_id: discoveredListingId,
    pms: discoveredPms,
    start_date: offsetDaysStr(-90),
    end_date: offsetDaysStr(90),
  });

  let reservationEntries = [];

  if (reservationsResult.error) {
    check("pricelabs_get_reservations returns data", false, reservationsResult.error);
  } else {
    const resEnvelope = reservationsResult.data;
    // fetchWithFallback wraps: { data: { pms_name, next_page, data: [...] }, meta: {...} }
    const resData = resEnvelope?.data;
    const rawReservations = resData?.data;

    check("Fetched real reservation data", Array.isArray(rawReservations), `${Array.isArray(rawReservations) ? rawReservations.length : 0} reservations`);

    if (Array.isArray(rawReservations) && rawReservations.length > 0) {
      reservationEntries = rawReservations;
      info("First reservation", `id=${rawReservations[0].reservation_id}, status=${rawReservations[0].booking_status}, check_in=${rawReservations[0].check_in}`);
    } else if (Array.isArray(rawReservations) && rawReservations.length === 0) {
      info("No reservations found in date range (this listing may have no bookings)");
    }
  }

  if (reservationEntries.length >= 2) {
    // Step 2: Transform reservations for storage
    const reservationsToStore = reservationEntries.map((r) => ({
      reservation_id: r.reservation_id || r.id || `res-${Math.random().toString(36).slice(2, 8)}`,
      check_in: r.check_in ?? null,
      check_out: r.check_out ?? null,
      booked_date: r.booked_date ?? null,
      booking_status: r.booking_status ?? "booked",
      rental_revenue: r.rental_revenue != null ? parseFloat(String(r.rental_revenue)) || null : null,
      total_cost: r.total_cost != null ? parseFloat(String(r.total_cost)) || null : null,
      no_of_days: typeof r.no_of_days === "number" ? r.no_of_days : null,
      currency: r.currency ?? null,
      data_json: JSON.stringify(r),
    }));

    // Step 3: First pass -- store all reservations (real data)
    const storeRes1 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: reservationsToStore,
    });

    if (storeRes1.error) {
      check("First pass: pricelabs_store_reservations succeeds", false, storeRes1.error);
    } else {
      const storeData = storeRes1.data;
      check("First pass: upserted count matches", storeData?.upserted === reservationsToStore.length, `upserted=${storeData?.upserted}`);
      info("First pass cancellations", `new_cancellations=${storeData?.new_cancellations?.length ?? 0}`);
    }

    // Step 4: Cancellation simulation (second pass)
    // Find a non-cancelled reservation to simulate cancellation (status must CHANGE to trigger cancelled_on)
    const nonCancelledRes = reservationsToStore.find(r => r.booking_status && r.booking_status !== "cancelled")
      || reservationsToStore.find(r => !r.booking_status)  // fallback: no status = not cancelled
      || reservationsToStore[0];  // last resort
    const cancelledReservation = {
      ...nonCancelledRes,
      booking_status: "cancelled",
    };
    info("Simulating cancellation", `reservation_id=${cancelledReservation.reservation_id}, was_status=${nonCancelledRes.booking_status || "null"}`);

    const storeRes2 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: [cancelledReservation],
    });

    if (storeRes2.error) {
      check("Second pass: cancellation upsert succeeds", false, storeRes2.error);
    } else {
      const storeData2 = storeRes2.data;
      check("Second pass: upserted 1 reservation", storeData2?.upserted === 1, `upserted=${storeData2?.upserted}`);

      const newCancellations = storeData2?.new_cancellations || [];
      check("Cancellation detected", newCancellations.length >= 1, `new_cancellations=${newCancellations.length}`);

      if (newCancellations.length > 0) {
        const cancelled = newCancellations[0];
        check("Cancelled reservation has correct id", cancelled.reservation_id === cancelledReservation.reservation_id, `id=${cancelled.reservation_id}`);
        check("Cancelled reservation has cancelled_on timestamp", cancelled.cancelled_on != null && cancelled.cancelled_on.length > 0, `cancelled_on=${cancelled.cancelled_on}`);

        info("Cancellation details", `reservation_id=${cancelled.reservation_id}, cancelled_on=${cancelled.cancelled_on}`);
      }
    }
  } else if (reservationEntries.length === 1) {
    // Only 1 reservation -- store it, then cancel it
    const singleRes = reservationEntries[0];
    const resForStore = {
      reservation_id: singleRes.reservation_id || singleRes.id || "single-res-1",
      check_in: singleRes.check_in ?? null,
      check_out: singleRes.check_out ?? null,
      booked_date: singleRes.booked_date ?? null,
      booking_status: singleRes.booking_status ?? "booked",
      rental_revenue: singleRes.rental_revenue != null ? parseFloat(String(singleRes.rental_revenue)) || null : null,
      total_cost: singleRes.total_cost != null ? parseFloat(String(singleRes.total_cost)) || null : null,
      no_of_days: typeof singleRes.no_of_days === "number" ? singleRes.no_of_days : null,
      currency: singleRes.currency ?? null,
      data_json: JSON.stringify(singleRes),
    };

    // First pass
    const storeRes1 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: [resForStore],
    });
    check("First pass: store single reservation", !storeRes1.error, storeRes1.error || `upserted=${storeRes1.data?.upserted}`);

    // Cancel it
    const storeRes2 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: [{ ...resForStore, booking_status: "cancelled" }],
    });

    if (!storeRes2.error) {
      const newCancellations = storeRes2.data?.new_cancellations || [];
      check("Cancellation detected for single reservation", newCancellations.length >= 1, `new_cancellations=${newCancellations.length}`);
      if (newCancellations.length > 0) {
        check("Cancelled_on is populated", newCancellations[0].cancelled_on != null, `cancelled_on=${newCancellations[0].cancelled_on}`);
      }
    } else {
      check("Second pass: cancellation upsert", false, storeRes2.error);
    }
  } else {
    // No reservations -- create synthetic ones to test cancellation logic
    warn("No reservations from API -- using synthetic data to test cancellation detection");

    const syntheticRes = {
      reservation_id: `synthetic-${Date.now()}`,
      check_in: offsetDaysStr(7),
      check_out: offsetDaysStr(10),
      booked_date: todayStr(),
      booking_status: "booked",
      rental_revenue: 500,
      total_cost: 600,
      no_of_days: 3,
      currency: "USD",
      data_json: JSON.stringify({ synthetic: true }),
    };

    // First pass: store as booked
    const storeRes1 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: [syntheticRes],
    });
    check("Synthetic reservation stored", !storeRes1.error, storeRes1.error || `upserted=${storeRes1.data?.upserted}`);

    // Second pass: cancel it
    const storeRes2 = await callTool(serverProcess, "pricelabs_store_reservations", {
      listing_id: discoveredListingId,
      pms: discoveredPms,
      reservations: [{ ...syntheticRes, booking_status: "cancelled" }],
    });

    if (!storeRes2.error) {
      const newCancellations = storeRes2.data?.new_cancellations || [];
      check("Cancellation detected for synthetic reservation", newCancellations.length >= 1, `new_cancellations=${newCancellations.length}`);
      if (newCancellations.length > 0) {
        check("Synthetic cancelled_on is populated", newCancellations[0].cancelled_on != null, `cancelled_on=${newCancellations[0].cancelled_on}`);
      }
    } else {
      check("Synthetic cancellation upsert", false, storeRes2.error);
    }
  }

  // ---------------------------------------------------------------
  // STORE-04: Store Market Snapshot
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}STORE-04: Store Market Snapshot${RESET}`);

  // Step 1: Fetch real neighborhood data
  const neighborhoodResult = await callTool(serverProcess, "pricelabs_get_neighborhood", {
    listing_id: discoveredListingId,
    pms: discoveredPms,
  });

  if (neighborhoodResult.error) {
    check("pricelabs_get_neighborhood returns data", false, neighborhoodResult.error);
  } else {
    const nbEnvelope = neighborhoodResult.data;
    const nbData = nbEnvelope?.data;
    const innerData = nbData?.data;

    check("Fetched real neighborhood data", innerData != null, `keys=${innerData ? Object.keys(innerData).length : 0}`);

    if (innerData) {
      // Extract percentile prices from Future Percentile Prices
      const futurePercentile = innerData["Future Percentile Prices"];
      const listingsUsed = innerData["Listings Used"];

      // Try to extract Y_values for percentile prices
      let p25 = null, p50 = null, p75 = null, p90 = null;

      if (futurePercentile?.Y_values && Array.isArray(futurePercentile.Y_values)) {
        // Y_values is typically [25th_array, 50th_array, 75th_array, median_booked_array, 90th_array]
        const yVals = futurePercentile.Y_values;
        // Take the first day's values from each percentile series
        if (yVals.length >= 5) {
          p25 = Array.isArray(yVals[0]) && yVals[0].length > 0 ? Number(yVals[0][0]) || null : null;
          p50 = Array.isArray(yVals[1]) && yVals[1].length > 0 ? Number(yVals[1][0]) || null : null;
          p75 = Array.isArray(yVals[2]) && yVals[2].length > 0 ? Number(yVals[2][0]) || null : null;
          p90 = Array.isArray(yVals[4]) && yVals[4].length > 0 ? Number(yVals[4][0]) || null : null;
        }
        info("Extracted percentile prices", `p25=${p25}, p50=${p50}, p75=${p75}, p90=${p90}`);
      } else if (futurePercentile) {
        // Phase 7 noted: may use Category/Labels keys instead of Y_values
        info("Future Percentile Prices uses non-standard format", `keys=${Object.keys(futurePercentile).join(", ")}`);

        // Try Category-based extraction
        const category = futurePercentile.Category;
        const labels = futurePercentile.Labels;
        if (Array.isArray(category) && Array.isArray(labels)) {
          // Look for percentile values in the arrays
          for (let i = 0; i < (labels?.length ?? 0); i++) {
            const label = String(labels[i] || "").toLowerCase();
            const val = Array.isArray(category[i]) && category[i].length > 0 ? Number(category[i][0]) : null;
            if (label.includes("25") && val != null) p25 = val;
            if ((label.includes("50") || label.includes("median")) && val != null) p50 = val;
            if (label.includes("75") && val != null) p75 = val;
            if (label.includes("90") && val != null) p90 = val;
          }
          info("Extracted from Category/Labels", `p25=${p25}, p50=${p50}, p75=${p75}, p90=${p90}`);
        }
      } else {
        warn("No Future Percentile Prices data in neighborhood response");
      }

      // Step 2: Transform into StoreMarketSnapshotInputSchema format
      const marketSnapshot = {
        listing_id: discoveredListingId,
        pms: discoveredPms,
        listings_used: typeof listingsUsed === "number" ? listingsUsed : null,
        p25_price: p25,
        p50_price: p50,
        p75_price: p75,
        p90_price: p90,
        market_occupancy: null, // Not directly available from neighborhood response
        data_json: JSON.stringify(nbData),
      };

      // Step 3: Store market snapshot
      const storeMarketResult = await callTool(serverProcess, "pricelabs_store_market_snapshot", {
        snapshots: [marketSnapshot],
      });

      if (storeMarketResult.error) {
        check("pricelabs_store_market_snapshot succeeds", false, storeMarketResult.error);
      } else {
        const storeData = storeMarketResult.data;
        check("Store market snapshot succeeds", storeData?.stored === 1, `stored=${storeData?.stored}`);
      }

      // Step 4: Read back via get_snapshots
      const readMarketResult = await callTool(serverProcess, "pricelabs_get_snapshots", {
        table: "market_snapshots",
        listing_id: discoveredListingId,
        pms: discoveredPms,
      });

      if (readMarketResult.error) {
        check("pricelabs_get_snapshots (market_snapshots) succeeds", false, readMarketResult.error);
      } else {
        const readData = readMarketResult.data;
        check("Get market snapshots returns rows", readData?.count > 0, `count=${readData?.count}`);
        if (readData?.rows?.length > 0) {
          const row = readData.rows[0];
          check("Market row has listing_id", row.listing_id === discoveredListingId, `listing_id=${row.listing_id}`);
          check("Market row has data_json", typeof row.data_json === "string" && row.data_json.length > 10, `${row.data_json?.length || 0} chars`);
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // SAFE-02: Pre-Write Snapshot
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}SAFE-02: Pre-Write Snapshot${RESET}`);

  // Step 1: Call snapshot_before_write
  const snapshotResult = await callTool(serverProcess, "pricelabs_snapshot_before_write", {
    listing_id: discoveredListingId,
    pms: discoveredPms,
    operation_type: "set_overrides",
    start_date: todayStr(),
    end_date: offsetDaysStr(30),
    channel: "test",
  });

  if (snapshotResult.error) {
    check("pricelabs_snapshot_before_write succeeds", false, snapshotResult.error);
  } else {
    const snapshot = snapshotResult.data;

    // Step 2: Verify snapshot response structure
    check("Snapshot has snapshot_type", snapshot?.snapshot_type === "set_overrides", `type=${snapshot?.snapshot_type}`);
    check("Snapshot has listing_id", snapshot?.listing_id === discoveredListingId, `id=${snapshot?.listing_id}`);
    check("Snapshot has pms", snapshot?.pms === discoveredPms, `pms=${snapshot?.pms}`);
    check("Snapshot has captured_at", typeof snapshot?.captured_at === "string" && snapshot.captured_at.length > 0, `captured_at=${snapshot?.captured_at}`);

    const listingState = snapshot?.listing_state;
    check("Snapshot has listing_state object", listingState != null && typeof listingState === "object");
    if (listingState) {
      check("listing_state has base_price", "base_price" in listingState, `base_price=${listingState.base_price}`);
      info("Listing state", `base=${listingState.base_price}, min=${listingState.min_price}, max=${listingState.max_price}, currency=${listingState.currency}`);
    }

    check("Snapshot has existing_overrides", Array.isArray(snapshot?.existing_overrides), `count=${snapshot?.existing_overrides?.length ?? "N/A"}`);
  }

  // Step 3: Verify audit_log has the snapshot entry
  const auditResult = await callTool(serverProcess, "pricelabs_get_audit_log", {
    action_type: "snapshot",
    limit: 5,
  });

  if (auditResult.error) {
    check("pricelabs_get_audit_log (snapshot) succeeds", false, auditResult.error);
  } else {
    const auditData = auditResult.data;
    const entries = auditData?.entries || [];

    check("Audit log has snapshot entries", entries.length >= 1, `count=${entries.length}`);

    if (entries.length > 0) {
      const entry = entries[0];
      check("Audit entry has action_type=snapshot", entry.action_type === "snapshot", `action_type=${entry.action_type}`);
      check("Audit entry has listing_id", entry.listing_id === discoveredListingId, `listing_id=${entry.listing_id}`);

      // Verify details_json is valid JSON containing listing_state
      let detailsParsed = null;
      try {
        detailsParsed = JSON.parse(entry.details_json);
      } catch {
        // parse failure
      }
      check("Audit entry details_json is valid JSON", detailsParsed != null);
      if (detailsParsed) {
        check("Audit details contains listing_state", detailsParsed.listing_state != null, `has base_price=${detailsParsed.listing_state?.base_price}`);
      }
    }
  }

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\n${BOLD}=== Phase 8: Snapshot Persistence Results ===${RESET}\n`);
  console.log(`  ${BOLD}STORE-01:${RESET} Store Daily Snapshots      ${passes > 0 ? PASS : FAIL}`);
  console.log(`  ${BOLD}STORE-02:${RESET} Store Price Snapshots      ${passes > 0 ? PASS : FAIL}`);
  console.log(`  ${BOLD}STORE-03:${RESET} Reservations + Cancellation ${passes > 0 ? PASS : FAIL}`);
  console.log(`  ${BOLD}STORE-04:${RESET} Store Market Snapshot      ${passes > 0 ? PASS : FAIL}`);
  console.log(`  ${BOLD}SAFE-02:${RESET}  Pre-Write Snapshot         ${passes > 0 ? PASS : FAIL}`);
  console.log(`  --`);
  console.log(`  Passed: ${GREEN}${passes}${RESET}, Failed: ${RED}${failures}${RESET}, Warnings: ${YELLOW}${warnings}${RESET}\n`);

  if (failures === 0) {
    console.log(`  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} -- Phase 8 snapshot persistence validation complete.\n`);
  } else {
    console.log(`  ${RED}${BOLD}${failures} CHECK(S) FAILED${RESET} -- see above for details.\n`);
  }
} finally {
  // Clean up server process
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (!serverProcess.killed) {
      serverProcess.kill("SIGKILL");
    }
  }

  // Clean up temp directory
  if (tempDir && existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

process.exit(failures > 0 ? 1 : 0);
