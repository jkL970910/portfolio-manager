import { existsSync } from "node:fs";
import { eq, isNull } from "drizzle-orm";
import { config } from "dotenv";
import {
  holdingPositions,
  recommendationItems,
  securityPriceHistory,
} from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { resolveCanonicalSecurityIdentity } from "@/lib/market-data/security-identity";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

function normalizeCurrency(value: string | null | undefined) {
  return value?.trim().toUpperCase() === "USD" ? "USD" : "CAD";
}

async function backfillHoldings() {
  const db = getDb();
  const rows = await db.query.holdingPositions.findMany({
    where: isNull(holdingPositions.securityId),
  });

  let updated = 0;
  for (const row of rows) {
    const security = await resolveCanonicalSecurityIdentity({
      symbol: row.symbol,
      exchange: row.exchangeOverride ?? row.quoteExchange ?? null,
      currency: normalizeCurrency(row.currency),
      name: row.name,
      securityType: row.securityTypeOverride ?? null,
      marketSector: row.marketSectorOverride ?? null,
      provider: row.quoteProvider ?? null,
    });
    await db
      .update(holdingPositions)
      .set({ securityId: security.id, updatedAt: new Date() })
      .where(eq(holdingPositions.id, row.id));
    updated += 1;
  }

  return updated;
}

async function backfillPriceHistory() {
  const db = getDb();
  const rows = await db.query.securityPriceHistory.findMany({
    where: isNull(securityPriceHistory.securityId),
  });

  let updated = 0;
  for (const row of rows) {
    const security = await resolveCanonicalSecurityIdentity({
      symbol: row.symbol,
      exchange: row.exchange,
      currency: normalizeCurrency(row.currency),
      provider: row.provider ?? row.source,
    });
    await db
      .update(securityPriceHistory)
      .set({ securityId: security.id })
      .where(eq(securityPriceHistory.id, row.id));
    updated += 1;
  }

  return updated;
}

async function backfillRecommendationItems() {
  const db = getDb();
  const rows = await db.query.recommendationItems.findMany({
    where: isNull(recommendationItems.securityId),
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.securitySymbol) {
      continue;
    }
    const security = await resolveCanonicalSecurityIdentity({
      symbol: row.securitySymbol,
      exchange: row.securityExchange,
      currency: normalizeCurrency(row.securityCurrency),
      name: row.securityName ?? row.securitySymbol,
      securityType: "ETF",
    });
    await db
      .update(recommendationItems)
      .set({
        securityId: security.id,
        securityExchange: security.canonicalExchange,
        securityMicCode: security.micCode,
        securityCurrency: security.currency,
      })
      .where(eq(recommendationItems.id, row.id));
    updated += 1;
  }

  return updated;
}

async function main() {
  const [holdings, priceHistory, recommendations] = await Promise.all([
    backfillHoldings(),
    backfillPriceHistory(),
    backfillRecommendationItems(),
  ]);

  console.log(
    JSON.stringify(
      {
        holdings,
        priceHistory,
        recommendations,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
