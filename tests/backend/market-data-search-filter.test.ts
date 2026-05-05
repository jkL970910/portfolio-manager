import assert from "node:assert/strict";
import test from "node:test";
import { filterSupportedSearchResults } from "@/lib/market-data/service";
import type { SecuritySearchResult } from "@/lib/market-data/types";

function candidate(
  symbol: string,
  overrides: Partial<SecuritySearchResult> = {},
): SecuritySearchResult {
  return {
    symbol,
    name: `${symbol} Inc.`,
    exchange: "NASDAQ",
    micCode: "XNAS",
    country: "United States",
    currency: "USD",
    type: "Common Stock",
    provider: "twelve-data",
    ...overrides,
  };
}

test("market data search keeps only CAD and USD results", () => {
  const results = filterSupportedSearchResults([
    candidate("RKLB", { currency: "USD", exchange: "NASDAQ" }),
    candidate("VFV", { currency: "CAD", exchange: "TSX", micCode: "XTSE" }),
    candidate("DEV", { currency: "AUD", exchange: "ASX", micCode: "XASX" }),
    candidate("DEV", { currency: "PLN", exchange: "GPW", micCode: "XWAR" }),
  ]);

  assert.deepEqual(
    results.map((result) => `${result.symbol}:${result.exchange}:${result.currency}`),
    ["RKLB:NASDAQ:USD", "VFV:TSX:CAD"],
  );
});

test("market data search rejects non-North-American USD listings", () => {
  const results = filterSupportedSearchResults([
    candidate("AAPL", {
      currency: "USD",
      exchange: "BVS",
      micCode: "XSGO",
      country: "Chile",
    }),
    candidate("AAPL", {
      currency: "USD",
      exchange: "NASDAQ",
      micCode: "XNGS",
      country: "United States",
    }),
  ]);

  assert.deepEqual(
    results.map((result) => `${result.symbol}:${result.exchange}:${result.currency}`),
    ["AAPL:NASDAQ:USD"],
  );
});

test("market data search infers CAD/USD for identity providers without currency", () => {
  const results = filterSupportedSearchResults([
    candidate("AAPL", {
      currency: null,
      exchange: "NASDAQ",
      micCode: "XNAS",
      provider: "openfigi",
    }),
    candidate("AAPL", {
      currency: null,
      exchange: "NEO",
      micCode: "NEOE",
      provider: "openfigi",
    }),
    candidate("DEV", {
      currency: null,
      exchange: "ASX",
      micCode: "XASX",
      provider: "openfigi",
    }),
  ]);

  assert.deepEqual(
    results.map((result) => `${result.symbol}:${result.exchange}:${result.currency}`),
    ["AAPL:NASDAQ:USD", "AAPL:NEO:CAD"],
  );
});
