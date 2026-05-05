import assert from "node:assert/strict";
import test from "node:test";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";
import {
  metadataConfidenceLabel,
  metadataSourceLabel,
} from "@/lib/backend/mobile-worker-status";
import {
  buildAlphaVantageProfileMetadata,
  shouldApplySecurityMetadata,
} from "@/lib/backend/security-metadata-providers";
import { runSecurityMetadataRefreshWorkerOnce } from "@/lib/backend/security-metadata-worker";
import { resolveCanonicalSecurityIdentity } from "@/lib/market-data/security-identity";

test("security metadata worker refreshes stale project-registry metadata", async () => {
  const security = await resolveCanonicalSecurityIdentity({
    symbol: `TSTGLD${Date.now()}`,
    exchange: "TSX",
    currency: "CAD",
    name: "Test Gold Bullion ETF",
    securityType: "Commodity ETF",
  });

  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "test-security-metadata-worker",
    maxSecurities: 50,
    maxAgeDays: 1,
    now: new Date("2026-05-03T12:00:00.000Z"),
  });
  const updated = await mockRepositories.securities.getById(security.id);

  assert.ok(result.updatedCount >= 1);
  assert.equal(updated?.metadataSource, "project-registry");
  assert.equal(updated?.economicAssetClass, "Commodity");
  assert.ok(updated?.metadataAsOf);
});

test("security metadata worker does not override manually confirmed metadata", async () => {
  const security = await resolveCanonicalSecurityIdentity({
    symbol: `MANUAL${Date.now()}`,
    exchange: "NASDAQ",
    currency: "USD",
    name: "Manual Confirmed Test Security",
    securityType: "Common Stock",
  });
  await mockRepositories.securities.updateMetadata(security.id, {
    economicAssetClass: "International Equity",
    economicSector: "Manual Sector",
    exposureRegion: "International",
    metadataSource: "manual",
    metadataConfidence: 100,
    metadataAsOf: "2026-05-03T00:00:00.000Z",
    metadataConfirmedAt: "2026-05-03T00:00:00.000Z",
    metadataNotes: "User confirmed.",
  });

  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "test-security-metadata-worker",
    maxSecurities: 50,
    maxAgeDays: 1,
    now: new Date("2026-05-03T12:00:00.000Z"),
  });
  const updated = await mockRepositories.securities.getById(security.id);

  assert.equal(updated?.metadataSource, "manual");
  assert.equal(updated?.economicAssetClass, "International Equity");
  assert.ok(
    result.items.every((item) => item.securityId !== security.id),
    "manual metadata should not enter the refresh candidate set",
  );
});

test("security metadata worker can restrict QA refresh to an explicit symbol list", async () => {
  const qaSecurity = await resolveCanonicalSecurityIdentity({
    symbol: `QAALW${Date.now()}`,
    exchange: "TSX",
    currency: "CAD",
    name: "QA Allowlist Gold ETF",
    securityType: "Commodity ETF",
  });
  const otherSecurity = await resolveCanonicalSecurityIdentity({
    symbol: `QASKP${Date.now()}`,
    exchange: "TSX",
    currency: "CAD",
    name: "QA Skipped Gold ETF",
    securityType: "Commodity ETF",
  });

  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "test-security-metadata-worker",
    maxSecurities: 50,
    maxAgeDays: 1,
    symbols: [qaSecurity.symbol],
    now: new Date("2026-05-03T12:00:00.000Z"),
  });
  const updated = await mockRepositories.securities.getById(qaSecurity.id);

  assert.equal(result.sampledSecurityCount, 1);
  assert.ok(
    result.items.some((item) => item.securityId === qaSecurity.id),
    "allowlisted security should be sampled",
  );
  assert.ok(
    result.items.every((item) => item.securityId !== otherSecurity.id),
    "non-allowlisted security should not be sampled",
  );
  assert.equal(updated?.metadataSource, "project-registry");
});

test("security metadata worker can restrict QA refresh to an exact listing identity", async () => {
  const symbol = `QAID${Date.now()}`;
  const cadSecurity = await resolveCanonicalSecurityIdentity({
    symbol,
    exchange: "TSX",
    currency: "CAD",
    name: "QA Identity CAD Gold ETF",
    securityType: "Commodity ETF",
  });
  const usdSecurity = await resolveCanonicalSecurityIdentity({
    symbol,
    exchange: "NASDAQ",
    currency: "USD",
    name: "QA Identity USD Gold ETF",
    securityType: "Commodity ETF",
  });

  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "test-security-metadata-worker",
    maxSecurities: 50,
    maxAgeDays: 1,
    symbols: [`${symbol}:TSX:CAD`],
    now: new Date("2026-05-03T12:00:00.000Z"),
  });

  assert.equal(result.sampledSecurityCount, 1);
  assert.ok(
    result.items.some((item) => item.securityId === cadSecurity.id),
    "exact CAD listing should be sampled",
  );
  assert.ok(
    result.items.every((item) => item.securityId !== usdSecurity.id),
    "same ticker on a different listing should not be sampled",
  );
});

test("security metadata worker skips unsupported exchange identities", async () => {
  const security = await resolveCanonicalSecurityIdentity({
    symbol: `RKLB${Date.now()}`,
    exchange: "BCBA",
    micCode: "XBUE",
    currency: "CAD",
    name: "Rocket Lab USA Inc.",
    securityType: "Common Stock",
    country: "Argentina",
  });

  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "test-security-metadata-worker",
    maxSecurities: 50,
    maxAgeDays: 1,
    symbols: [`${security.symbol}:BCBA:CAD`],
    now: new Date("2026-05-03T12:00:00.000Z"),
  });
  const updated = await mockRepositories.securities.getById(security.id);

  assert.equal(result.sampledSecurityCount, 1);
  assert.equal(result.updatedCount, 0);
  assert.equal(updated?.metadataSource, "heuristic");
  assert.equal(updated?.metadataConfidence, 45);
});

test("mobile metadata labels avoid provider/debug terminology", () => {
  assert.equal(metadataSourceLabel("heuristic"), "资料待确认");
  assert.equal(metadataSourceLabel("project-registry"), "系统识别");
  assert.equal(metadataSourceLabel("provider"), "机构资料");
  assert.equal(metadataSourceLabel("manual"), "已人工确认");
  assert.equal(metadataConfidenceLabel(45), "资料待确认");
  assert.equal(metadataConfidenceLabel(55), "资料需复核");
  assert.equal(metadataConfidenceLabel(75), "较可信");
  assert.equal(metadataConfidenceLabel(95), "高可信");
});

test("alpha vantage overview maps company sector and region metadata", () => {
  const metadata = buildAlphaVantageProfileMetadata({
    security: {
      symbol: "RKLB",
      name: "Rocket Lab USA Inc",
      currency: "USD",
      securityType: "Common Stock",
      economicAssetClass: null,
    },
    kind: "company-overview",
    candidateSymbol: "RKLB",
    payload: {
      Symbol: "RKLB",
      Name: "Rocket Lab USA Inc",
      AssetType: "Common Stock",
      Country: "USA",
      Currency: "USD",
      Sector: "Industrials",
      Industry: "Aerospace & Defense",
    },
  });

  assert.equal(metadata.source, "provider");
  assert.equal(metadata.economicAssetClass, "US Equity");
  assert.equal(metadata.economicSector, "Industrials");
  assert.equal(metadata.exposureRegion, "United States");
  assert.ok(metadata.confidence >= 70);
});

test("metadata application guard preserves manual confirmation", () => {
  assert.equal(
    shouldApplySecurityMetadata(
      {
        metadataSource: "manual",
        metadataConfidence: 100,
        metadataConfirmedAt: "2026-05-03T00:00:00.000Z",
      },
      {
        economicAssetClass: "US Equity",
        economicSector: null,
        exposureRegion: "United States",
        source: "provider",
        confidence: 95,
        asOf: "2026-05-03T00:00:00.000Z",
        confirmedAt: null,
        notes: "Provider profile.",
      },
    ),
    false,
  );
});

test("metadata application guard preserves project registry against lower-confidence provider", () => {
  assert.equal(
    shouldApplySecurityMetadata(
      {
        metadataSource: "project-registry",
        metadataConfidence: 82,
        metadataConfirmedAt: null,
      },
      {
        economicAssetClass: "Canadian Equity",
        economicSector: null,
        exposureRegion: "Canada",
        source: "provider",
        confidence: 76,
        asOf: "2026-05-03T00:00:00.000Z",
        confirmedAt: null,
        notes: "Provider profile.",
      },
    ),
    false,
  );
});
