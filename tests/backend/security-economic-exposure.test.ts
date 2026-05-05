import assert from "node:assert/strict";
import test from "node:test";
import {
  inferEconomicAssetClass,
  inferSecurityMetadata,
} from "@/lib/backend/security-economic-exposure";

test("verified security metadata overrides currency and heuristic classification", () => {
  const assetClass = inferEconomicAssetClass({
    symbol: "ABC",
    name: "ABC CAD Listed Fund",
    assetClass: "Canadian Equity",
    securityType: "ETF",
    currency: "CAD",
    metadata: {
      economicAssetClass: "International Equity",
      economicSector: "Global",
      exposureRegion: "International",
      source: "provider",
      confidence: 92,
      asOf: "2026-05-03T00:00:00.000Z",
      confirmedAt: null,
      notes: "Provider ETF metadata",
    },
  });

  assert.equal(assetClass, "International Equity");
});

test("low-confidence metadata does not override project exposure registry", () => {
  const assetClass = inferEconomicAssetClass({
    symbol: "CGL.C",
    name: "iShares Gold Bullion ETF",
    assetClass: "Canadian Equity",
    securityType: "Commodity ETF",
    currency: "CAD",
    metadata: {
      economicAssetClass: "Canadian Equity",
      economicSector: "Broad Market",
      exposureRegion: "Canada",
      source: "heuristic",
      confidence: 45,
      asOf: null,
      confirmedAt: null,
      notes: "Weak fallback",
    },
  });

  assert.equal(assetClass, "Commodity");
});

test("project metadata inference separates listing market from economic exposure", () => {
  const metadata = inferSecurityMetadata({
    symbol: "ZQQ",
    name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
    assetClass: "Canadian Equity",
    securityType: "ETF",
    currency: "CAD",
  });

  assert.equal(metadata.economicAssetClass, "US Equity");
  assert.equal(metadata.exposureRegion, "United States");
  assert.equal(metadata.source, "project-registry");
  assert.ok(metadata.confidence >= 80);
});

test("CAD listed US company wrappers do not become Canadian Equity by currency", () => {
  const metadata = inferSecurityMetadata({
    symbol: "GEV",
    name: "GE Vernova Inc. CDR",
    assetClass: null,
    securityType: "Common Stock",
    currency: "CAD",
  });

  assert.equal(metadata.economicAssetClass, "US Equity");
  assert.equal(metadata.exposureRegion, "United States");
  assert.equal(metadata.source, "project-registry");
});
