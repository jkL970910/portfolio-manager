import assert from "node:assert/strict";
import test from "node:test";

import {
  getPortfolioSecurityDetailView,
  updateSecurityResearchDossier,
} from "@/lib/backend/services";
import { resolveCanonicalSecurityIdentity } from "@/lib/market-data/security-identity";

test("security research dossier is keyed by canonical security identity", async () => {
  const userId = "user_demo";
  const symbol = `DSR${Date.now()}`;
  const cadSecurity = await resolveCanonicalSecurityIdentity({
    symbol,
    exchange: "TSX",
    currency: "CAD",
    name: "Dossier CAD Listing",
  });
  const usdSecurity = await resolveCanonicalSecurityIdentity({
    symbol,
    exchange: "NASDAQ",
    currency: "USD",
    name: "Dossier USD Listing",
  });

  await updateSecurityResearchDossier(userId, cadSecurity.id, {
    thesisSummary: "作为加拿大账户里的观察仓，等待配置缺口更清楚再决定。",
    role: "watch",
    maxAllocationPct: 8,
    reviewTriggers: ["价格回撤到长期均线附近", "组合里同类资产低于目标"],
    exitTriggers: ["底层 thesis 失效"],
    confidenceLevel: "medium",
    source: "user",
  });

  const cadView = await getPortfolioSecurityDetailView(userId, symbol, {
    securityId: cadSecurity.id,
    exchange: cadSecurity.canonicalExchange,
    currency: cadSecurity.currency,
  });
  const usdView = await getPortfolioSecurityDetailView(userId, symbol, {
    securityId: usdSecurity.id,
    exchange: usdSecurity.canonicalExchange,
    currency: usdSecurity.currency,
  });

  assert.equal(cadView.data.data?.researchDossier?.securityId, cadSecurity.id);
  assert.equal(cadView.data.data?.researchDossier?.role, "watch");
  assert.equal(cadView.data.data?.researchDossier?.roleLabel, "观察仓");
  assert.equal(cadView.data.data?.researchDossier?.maxAllocationPct, 8);
  assert.deepEqual(cadView.data.data?.researchDossier?.reviewTriggers, [
    "价格回撤到长期均线附近",
    "组合里同类资产低于目标",
  ]);

  assert.equal(usdView.data.data?.researchDossier, null);
});
