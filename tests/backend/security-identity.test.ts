import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnderlyingId,
  canonicalizeExchange,
  normalizeSecuritySymbol,
  resolveCanonicalSecurityIdentity,
} from "@/lib/market-data/security-identity";

test("canonicalizes equivalent exchange labels into one listing identity", async () => {
  const first = await resolveCanonicalSecurityIdentity({
    symbol: "XBB.TO",
    exchange: "TOR",
    currency: "CAD",
    name: "iShares Core Canadian Universe Bond Index ETF",
    provider: "yahoo-finance",
    providerSymbol: "XBB.TO",
  });
  const second = await resolveCanonicalSecurityIdentity({
    symbol: "XBB",
    exchange: "TSX",
    micCode: "XTSE",
    currency: "CAD",
    name: "iShares Core Canadian Universe Bond Index ETF",
    provider: "twelve-data",
  });

  assert.equal(first.id, second.id);
  assert.equal(first.symbol, "XBB");
  assert.equal(first.canonicalExchange, "TSX");
  assert.equal(first.micCode, "XTSE");
  assert.equal(first.currency, "CAD");
});

test("keeps same ticker in different currencies as separate listing identities", async () => {
  const cad = await resolveCanonicalSecurityIdentity({
    symbol: "AMZN",
    exchange: "NEO Exchange",
    currency: "CAD",
    name: "Amazon CDR",
  });
  const usd = await resolveCanonicalSecurityIdentity({
    symbol: "AMZN",
    exchange: "NASDAQ",
    currency: "USD",
    name: "Amazon.com Inc.",
  });

  assert.notEqual(cad.id, usd.id);
  assert.equal(cad.canonicalExchange, "NEO");
  assert.equal(usd.canonicalExchange, "NASDAQ");
});

test("persists project-registry metadata on resolved security identity", async () => {
  const security = await resolveCanonicalSecurityIdentity({
    symbol: "CGL.C",
    exchange: "TSX",
    currency: "CAD",
    name: "iShares Gold Bullion ETF",
    securityType: "Commodity ETF",
  });

  assert.equal(security.economicAssetClass, "Commodity");
  assert.equal(security.economicSector, "Precious Metals");
  assert.equal(security.metadataSource, "project-registry");
  assert.ok(security.metadataConfidence >= 80);
});

test("normalization helpers preserve canonical lookup keys", () => {
  assert.equal(normalizeSecuritySymbol("XBB.TO"), "XBB");
  assert.equal(normalizeSecuritySymbol("BRK-B"), "BRK.B");
  assert.deepEqual(canonicalizeExchange({ exchange: "XTSE", currency: "CAD" }), {
    canonicalExchange: "TSX",
    micCode: "XTSE",
    country: "Canada",
  });
  assert.equal(
    buildUnderlyingId({ symbol: "AMZN", name: "Amazon CDR CAD" }),
    "AMAZON",
  );
});
