import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecommendationConstraints } from "@/lib/backend/recommendation-constraints";

test("normalizes symbol constraints and removes preferred/excluded conflicts", () => {
  const constraints = normalizeRecommendationConstraints({
    excludedSymbols: [" vfv ", "VFV", "amzn"],
    preferredSymbols: ["vfv", "xuu", " XUU "],
    excludedSecurities: [
      { symbol: "gold", exchange: "TSX", currency: "CAD", name: "Gold" }
    ],
    preferredSecurities: [
      { symbol: "xef", exchange: "TSX", currency: "CAD", name: "XEF" },
      { symbol: "gold", exchange: "TSX", currency: "CAD", name: "Gold duplicate" }
    ],
    avoidAccountTypes: ["Taxable", "Taxable", "Invalid"],
    preferredAccountTypes: ["TFSA", "RRSP", "Bad"],
    allowedSecurityTypes: ["ETF", " ETF ", "Common Stock"]
  });

  assert.deepEqual(constraints.excludedSymbols, ["VFV", "AMZN", "GOLD"]);
  assert.deepEqual(constraints.preferredSymbols, ["XUU", "XEF"]);
  assert.deepEqual(constraints.avoidAccountTypes, ["Taxable"]);
  assert.deepEqual(constraints.preferredAccountTypes, ["TFSA", "RRSP"]);
  assert.deepEqual(constraints.allowedSecurityTypes, ["ETF", "Common Stock"]);
  assert.equal(constraints.excludedSecurities[0]?.symbol, "GOLD");
  assert.equal(constraints.preferredSecurities[0]?.symbol, "XEF");
});

test("normalizes asset-class bands without accepting invalid rows", () => {
  const constraints = normalizeRecommendationConstraints({
    assetClassBands: [
      { assetClass: "US Equity", minPct: 10, maxPct: 45 },
      { assetClass: "", minPct: 0, maxPct: 10 },
      null
    ]
  });

  assert.deepEqual(constraints.assetClassBands, [
    { assetClass: "US Equity", minPct: 10, maxPct: 45 }
  ]);
});
