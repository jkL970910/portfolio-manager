import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { getDb } from "@/lib/db/client";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

async function countRows(query: ReturnType<typeof sql>) {
  const db = getDb();
  const result = await db.execute(query);
  return Number(result.rows[0]?.count ?? 0);
}

async function listRows(query: ReturnType<typeof sql>) {
  const db = getDb();
  const result = await db.execute(query);
  return result.rows;
}

async function main() {
  const [
    holdingsMissing,
    priceHistoryMissing,
    recommendationsMissing,
    duplicateHistoryRows,
    duplicateAliasRows,
  ] = await Promise.all([
    countRows(sql`SELECT COUNT(*) FROM holding_positions WHERE security_id IS NULL`),
    countRows(sql`SELECT COUNT(*) FROM security_price_history WHERE security_id IS NULL`),
    countRows(sql`SELECT COUNT(*) FROM recommendation_items WHERE security_symbol IS NOT NULL AND security_id IS NULL`),
    listRows(sql`
      SELECT security_id, price_date, COUNT(*)::int AS count
      FROM security_price_history
      WHERE security_id IS NOT NULL
      GROUP BY security_id, price_date
      HAVING COUNT(*) > 1
      ORDER BY count DESC, price_date DESC
      LIMIT 20
    `),
    listRows(sql`
      SELECT alias_type, alias_value, COALESCE(provider, '') AS provider, COUNT(DISTINCT security_id)::int AS security_count
      FROM security_aliases
      WHERE alias_type NOT IN ('exchange-label', 'mic-code', 'provider-exchange')
      GROUP BY alias_type, alias_value, COALESCE(provider, '')
      HAVING COUNT(DISTINCT security_id) > 1
      ORDER BY security_count DESC, alias_type, alias_value
      LIMIT 20
    `),
  ]);

  console.log(
    JSON.stringify(
      {
        missingSecurityId: {
          holdings: holdingsMissing,
          priceHistory: priceHistoryMissing,
          recommendationItems: recommendationsMissing,
        },
        duplicateHistoryRows,
        duplicateAliasRows,
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
