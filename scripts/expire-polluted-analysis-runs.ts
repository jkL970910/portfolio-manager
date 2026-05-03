import { existsSync } from "node:fs";
import { Pool } from "pg";
import { config } from "dotenv";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return process.env.DATABASE_URL;
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const client = await pool.connect();

  try {
    const result = await client.query<{
      id: string;
      target_key: string;
      generated_at: Date;
      expires_at: Date;
      request_json: unknown;
      result_json: unknown;
    }>(
      `
        SELECT id, target_key, generated_at, expires_at, request_json, result_json
        FROM portfolio_analysis_runs
        WHERE request_json::text LIKE '%"securityId":"%'
          AND request_json::text LIKE '%"currency":"CAD"%'
          AND result_json::text LIKE '%"currency":"CAD"%'
      `,
    );

    const affected = result.rows;
    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            count: affected.length,
            rows: affected.map((row) => ({
              id: row.id,
              targetKey: row.target_key,
              generatedAt: row.generated_at.toISOString(),
              expiresAt: row.expires_at.toISOString(),
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    let updated = 0;
    for (const row of affected) {
      await client.query(
        `
          UPDATE portfolio_analysis_runs
          SET expires_at = $2::timestamptz
          WHERE id = $1
        `,
        [row.id, nowIso()],
      );
      updated += 1;
    }

    console.log(JSON.stringify({ dryRun: false, updated }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
