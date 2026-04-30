import { existsSync } from "node:fs";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const result = await db.execute(sql`
      WITH unique_holding_exchange AS (
        SELECT
          upper(trim(symbol)) AS symbol,
          upper(trim(currency)) AS currency,
          min(upper(trim(exchange_override))) AS exchange,
          count(DISTINCT upper(trim(exchange_override))) AS exchange_count
        FROM holding_positions
        WHERE nullif(trim(exchange_override), '') IS NOT NULL
        GROUP BY upper(trim(symbol)), upper(trim(currency))
      ),
      candidates AS (
        SELECT
          ph.symbol,
          ph.currency,
          uhe.exchange
        FROM security_price_history ph
        INNER JOIN unique_holding_exchange uhe
          ON uhe.symbol = upper(trim(ph.symbol))
          AND uhe.currency = upper(trim(ph.currency))
        WHERE ph.exchange = ''
          AND uhe.exchange_count = 1
        GROUP BY ph.symbol, ph.currency, uhe.exchange
      ),
      inserted AS (
        INSERT INTO security_price_history (
          symbol,
          exchange,
          price_date,
          close,
          adjusted_close,
          currency,
          source,
          provider,
          source_mode,
          freshness,
          refresh_run_id,
          is_reference,
          fallback_reason,
          created_at
        )
        SELECT
          ph.symbol,
          candidates.exchange,
          ph.price_date,
          ph.close,
          ph.adjusted_close,
          ph.currency,
          ph.source,
          ph.provider,
          ph.source_mode,
          ph.freshness,
          ph.refresh_run_id,
          ph.is_reference,
          ph.fallback_reason,
          ph.created_at
        FROM security_price_history ph
        INNER JOIN candidates
          ON candidates.symbol = ph.symbol
          AND candidates.currency = ph.currency
        WHERE ph.exchange = ''
        ON CONFLICT (symbol, exchange, currency, price_date) DO NOTHING
        RETURNING symbol, exchange, currency
      )
      SELECT
        count(*)::int AS inserted_count,
        count(DISTINCT symbol || '::' || exchange || '::' || currency)::int
          AS identity_count
      FROM inserted;
    `);

    const row = result.rows[0] as
      | { inserted_count?: number; identity_count?: number }
      | undefined;
    console.log(
      JSON.stringify(
        {
          insertedCount: Number(row?.inserted_count ?? 0),
          identityCount: Number(row?.identity_count ?? 0),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
