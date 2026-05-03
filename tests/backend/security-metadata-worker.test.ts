import assert from "node:assert/strict";
import test from "node:test";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";
import { shouldApplySecurityMetadata } from "@/lib/backend/security-metadata-providers";
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
