import { existsSync } from "node:fs";
import { Pool, type PoolClient } from "pg";
import { config } from "dotenv";
import {
  canonicalizeExchange,
  normalizeSecurityCurrency,
} from "@/lib/market-data/security-identity";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

type SecurityRow = {
  id: string;
  symbol: string;
  canonical_exchange: string;
  mic_code: string | null;
  currency: string;
  name: string;
  security_type: string | null;
  market_sector: string | null;
  country: string | null;
  underlying_id: string | null;
  updated_at: Date;
};

type ReferenceCounts = {
  holding_count: string;
  price_count: string;
  recommendation_count: string;
  document_count: string;
};

type MergeReport = {
  key: string;
  canonicalSecurityId: string;
  mergedSecurityIds: string[];
  movedAliases: number;
  deletedAliases: number;
  deletedPriceRows: number;
  updatedRows: {
    holdings: number;
    prices: number;
    recommendations: number;
    documents: number;
    analysisRuns: number;
  };
};

type PriceHistoryNormalizationReport = {
  deletedPriceRows: number;
  updatedPriceRows: number;
};

const dryRun = process.argv.includes("--dry-run");

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return process.env.DATABASE_URL;
}

function groupKey(row: SecurityRow) {
  const currency = normalizeSecurityCurrency(row.currency);
  const exchange = canonicalizeExchange({
    exchange: row.canonical_exchange,
    micCode: row.mic_code,
    currency,
  });
  return [
    row.symbol.trim().toUpperCase(),
    exchange.canonicalExchange,
    currency,
  ].join("|");
}

async function countReferences(client: PoolClient, securityId: string) {
  const result = await client.query<ReferenceCounts>(
    `
      SELECT
        (SELECT COUNT(*) FROM holding_positions WHERE security_id = $1) AS holding_count,
        (SELECT COUNT(*) FROM security_price_history WHERE security_id = $1) AS price_count,
        (SELECT COUNT(*) FROM recommendation_items WHERE security_id = $1) AS recommendation_count,
        (SELECT COUNT(*) FROM external_research_documents WHERE security_id = $1) AS document_count
    `,
    [securityId],
  );
  const row = result.rows[0];
  return {
    holdings: Number(row?.holding_count ?? 0),
    prices: Number(row?.price_count ?? 0),
    recommendations: Number(row?.recommendation_count ?? 0),
    documents: Number(row?.document_count ?? 0),
  };
}

async function chooseCanonical(client: PoolClient, rows: SecurityRow[]) {
  const scored = await Promise.all(
    rows.map(async (row) => {
      const exchange = canonicalizeExchange({
        exchange: row.canonical_exchange,
        micCode: row.mic_code,
        currency: row.currency,
      });
      const refs = await countReferences(client, row.id);
      const referenceScore =
        refs.holdings * 100 + refs.prices + refs.recommendations * 10 + refs.documents * 10;
      const identityScore =
        (row.canonical_exchange === exchange.canonicalExchange ? 1000 : 0) +
        (row.mic_code === exchange.micCode ? 250 : 0);
      const nameScore = row.name.trim().toUpperCase() === row.symbol ? 0 : 25;
      return { row, score: identityScore + referenceScore + nameScore };
    }),
  );
  return scored.sort((left, right) => right.score - left.score)[0].row;
}

async function ensureAlias(
  client: PoolClient,
  input: {
    securityId: string;
    aliasType: string;
    aliasValue: string;
    provider: string | null;
  },
) {
  const existing = await client.query<{ id: string; security_id: string }>(
    `
      SELECT id, security_id
      FROM security_aliases
      WHERE security_id = $1
        AND alias_type = $2
        AND alias_value = $3
        AND COALESCE(provider, '') = COALESCE($4, '')
      LIMIT 1
    `,
    [input.securityId, input.aliasType, input.aliasValue, input.provider],
  );
  if (existing.rows[0]) {
    return;
  }

  await client.query(
    `
      INSERT INTO security_aliases (security_id, alias_type, alias_value, provider)
      VALUES ($1, $2, $3, $4)
    `,
    [input.securityId, input.aliasType, input.aliasValue, input.provider],
  );
}

async function cleanupDuplicateAliases(client: PoolClient) {
  const result = await client.query(
    `
      DELETE FROM security_aliases duplicate
      USING security_aliases kept
      WHERE duplicate.security_id = kept.security_id
        AND duplicate.alias_type = kept.alias_type
        AND duplicate.alias_value = kept.alias_value
        AND COALESCE(duplicate.provider, '') = COALESCE(kept.provider, '')
        AND duplicate.id > kept.id
    `,
  );
  return result.rowCount ?? 0;
}

async function normalizeSecurityPriceHistoryExchanges(
  client: PoolClient,
): Promise<PriceHistoryNormalizationReport> {
  const securities = await client.query<SecurityRow>(
    `
      SELECT id, symbol, canonical_exchange, mic_code, currency, name,
             security_type, market_sector, country, underlying_id, updated_at
      FROM securities
      WHERE id IN (
        SELECT DISTINCT security_id
        FROM security_price_history
        WHERE security_id IS NOT NULL
      )
    `,
  );

  let deletedPriceRows = 0;
  let updatedPriceRows = 0;
  for (const security of securities.rows) {
    const normalized = canonicalizeExchange({
      exchange: security.canonical_exchange,
      micCode: security.mic_code,
      currency: security.currency,
    });

    const deleted = await client.query(
      `
        DELETE FROM security_price_history duplicate
        USING security_price_history kept
        WHERE duplicate.security_id = $1
          AND duplicate.exchange <> $2
          AND kept.id <> duplicate.id
          AND kept.symbol = duplicate.symbol
          AND kept.exchange = $2
          AND kept.currency = duplicate.currency
          AND kept.price_date = duplicate.price_date
      `,
      [security.id, normalized.canonicalExchange],
    );
    deletedPriceRows += deleted.rowCount ?? 0;

    const updated = await client.query(
      `
        UPDATE security_price_history
        SET exchange = $2::varchar
        WHERE security_id = $1
          AND exchange <> $2
      `,
      [security.id, normalized.canonicalExchange],
    );
    updatedPriceRows += updated.rowCount ?? 0;
  }

  return { deletedPriceRows, updatedPriceRows };
}

async function moveAliases(
  client: PoolClient,
  duplicateId: string,
  canonicalId: string,
) {
  let movedAliases = 0;
  let deletedAliases = 0;
  const aliases = await client.query<{
    id: string;
    alias_type: string;
    alias_value: string;
    provider: string | null;
  }>(
    `
      SELECT id, alias_type, alias_value, provider
      FROM security_aliases
      WHERE security_id = $1
    `,
    [duplicateId],
  );

  for (const alias of aliases.rows) {
    const existing = await client.query<{ id: string }>(
      `
        SELECT id
        FROM security_aliases
        WHERE security_id = $1
          AND alias_type = $2
          AND alias_value = $3
          AND COALESCE(provider, '') = COALESCE($4, '')
        LIMIT 1
      `,
      [canonicalId, alias.alias_type, alias.alias_value, alias.provider],
    );
    if (existing.rows[0]) {
      await client.query(`DELETE FROM security_aliases WHERE id = $1`, [alias.id]);
      deletedAliases += 1;
      continue;
    }

    await client.query(`UPDATE security_aliases SET security_id = $1 WHERE id = $2`, [
      canonicalId,
      alias.id,
    ]);
    movedAliases += 1;
  }

  return { movedAliases, deletedAliases };
}

async function mergeDuplicate(
  client: PoolClient,
  canonical: SecurityRow,
  duplicate: SecurityRow,
) {
  const normalized = canonicalizeExchange({
    exchange: canonical.canonical_exchange,
    micCode: canonical.mic_code,
    currency: canonical.currency,
  });
  const currency = normalizeSecurityCurrency(canonical.currency);
  const oldExchange = duplicate.canonical_exchange.trim().toUpperCase();
  const symbol = canonical.symbol.trim().toUpperCase();
  const { movedAliases, deletedAliases } = await moveAliases(
    client,
    duplicate.id,
    canonical.id,
  );

  const deletedPriceRows = await client.query(
    `
      DELETE FROM security_price_history duplicate
      USING security_price_history kept
      WHERE duplicate.security_id = $1
        AND kept.id <> duplicate.id
        AND kept.symbol = duplicate.symbol
        AND kept.exchange = $2
        AND kept.currency = duplicate.currency
        AND kept.price_date = duplicate.price_date
    `,
    [duplicate.id, normalized.canonicalExchange],
  );

  const prices = await client.query(
    `
      UPDATE security_price_history
      SET security_id = $1,
          exchange = $2::varchar
      WHERE security_id = $3
    `,
    [canonical.id, normalized.canonicalExchange, duplicate.id],
  );

  const holdings = await client.query(
    `
      UPDATE holding_positions
      SET security_id = $1,
          exchange_override = $2::varchar,
          quote_exchange = CASE WHEN quote_exchange IS NULL THEN NULL ELSE $2::varchar END,
          updated_at = NOW()
      WHERE security_id = $3
    `,
    [canonical.id, normalized.canonicalExchange, duplicate.id],
  );

  const recommendations = await client.query(
    `
      UPDATE recommendation_items
      SET security_id = $1,
          security_exchange = $2,
          security_mic_code = $3,
          security_currency = $4
      WHERE security_id = $5
    `,
    [
      canonical.id,
      normalized.canonicalExchange,
      normalized.micCode ?? null,
      currency,
      duplicate.id,
    ],
  );

  const documents = await client.query(
    `
      UPDATE external_research_documents
      SET security_id = $1,
          exchange = $2::varchar,
          currency = $3::varchar,
          updated_at = NOW()
      WHERE security_id = $4
    `,
    [canonical.id, normalized.canonicalExchange, currency, duplicate.id],
  );

  const analysisRuns = await client.query(
    `
      UPDATE portfolio_analysis_runs
      SET
        target_key = REPLACE(target_key, ':' || $1 || ':' || $2, ':' || $3 || ':' || $2),
        request_json = CASE
          WHEN request_json #>> '{security,symbol}' = $4
            AND request_json #>> '{security,exchange}' = $1
            AND request_json #>> '{security,currency}' = $2
          THEN jsonb_set(request_json, '{security,exchange}', to_jsonb($3::text), true)
          ELSE request_json
        END,
        result_json = CASE
          WHEN result_json #>> '{identity,symbol}' = $4
            AND result_json #>> '{identity,exchange}' = $1
            AND result_json #>> '{identity,currency}' = $2
          THEN jsonb_set(result_json, '{identity,exchange}', to_jsonb($3::text), true)
          ELSE result_json
        END
      WHERE target_key LIKE '%' || $4 || '%' || $1 || '%' || $2 || '%'
        OR (
          request_json #>> '{security,symbol}' = $4
          AND request_json #>> '{security,exchange}' = $1
          AND request_json #>> '{security,currency}' = $2
        )
        OR (
          result_json #>> '{identity,symbol}' = $4
          AND result_json #>> '{identity,exchange}' = $1
          AND result_json #>> '{identity,currency}' = $2
        )
    `,
    [oldExchange, currency, normalized.canonicalExchange, symbol],
  );

  await ensureAlias(client, {
    securityId: canonical.id,
    aliasType: "exchange-label",
    aliasValue: normalized.canonicalExchange,
    provider: null,
  });
  if (normalized.micCode) {
    await ensureAlias(client, {
      securityId: canonical.id,
      aliasType: "mic-code",
      aliasValue: normalized.micCode,
      provider: null,
    });
  }
  await ensureAlias(client, {
    securityId: canonical.id,
    aliasType: "exchange-label",
    aliasValue: oldExchange,
    provider: null,
  });

  await client.query(
    `
      UPDATE securities
      SET canonical_exchange = $2,
          mic_code = $3,
          country = COALESCE(country, $4),
          name = CASE
            WHEN name = symbol AND $5 <> $6 THEN $5
            ELSE name
          END,
          security_type = COALESCE(security_type, $7),
          market_sector = COALESCE(market_sector, $8),
          underlying_id = COALESCE(underlying_id, $9),
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      canonical.id,
      normalized.canonicalExchange,
      normalized.micCode ?? canonical.mic_code,
      normalized.country ?? canonical.country,
      duplicate.name,
      duplicate.symbol,
      duplicate.security_type,
      duplicate.market_sector,
      duplicate.underlying_id,
    ],
  );

  await client.query(`DELETE FROM securities WHERE id = $1`, [duplicate.id]);

  return {
    movedAliases,
    deletedAliases,
    deletedPriceRows: deletedPriceRows.rowCount ?? 0,
    updatedRows: {
      holdings: holdings.rowCount ?? 0,
      prices: prices.rowCount ?? 0,
      recommendations: recommendations.rowCount ?? 0,
      documents: documents.rowCount ?? 0,
      analysisRuns: analysisRuns.rowCount ?? 0,
    },
  };
}

async function main() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const securities = await client.query<SecurityRow>(
      `
        SELECT id, symbol, canonical_exchange, mic_code, currency, name,
               security_type, market_sector, country, underlying_id, updated_at
        FROM securities
      `,
    );

    const groups = new Map<string, SecurityRow[]>();
    for (const row of securities.rows) {
      const key = groupKey(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const reports: MergeReport[] = [];
    for (const [key, rows] of groups.entries()) {
      if (rows.length < 2) {
        continue;
      }
      const canonical = await chooseCanonical(client, rows);
      const duplicates = rows.filter((row) => row.id !== canonical.id);
      const report: MergeReport = {
        key,
        canonicalSecurityId: canonical.id,
        mergedSecurityIds: duplicates.map((row) => row.id),
        movedAliases: 0,
        deletedAliases: 0,
        deletedPriceRows: 0,
        updatedRows: {
          holdings: 0,
          prices: 0,
          recommendations: 0,
          documents: 0,
          analysisRuns: 0,
        },
      };

      for (const duplicate of duplicates) {
        const result = await mergeDuplicate(client, canonical, duplicate);
        report.movedAliases += result.movedAliases;
        report.deletedAliases += result.deletedAliases;
        report.deletedPriceRows += result.deletedPriceRows;
        report.updatedRows.holdings += result.updatedRows.holdings;
        report.updatedRows.prices += result.updatedRows.prices;
        report.updatedRows.recommendations += result.updatedRows.recommendations;
        report.updatedRows.documents += result.updatedRows.documents;
        report.updatedRows.analysisRuns += result.updatedRows.analysisRuns;
      }

      reports.push(report);
    }

    const deletedDuplicateAliases = await cleanupDuplicateAliases(client);
    const priceHistoryNormalization =
      await normalizeSecurityPriceHistoryExchanges(client);

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          mergedGroups: reports.length,
          deletedDuplicateAliases,
          priceHistoryNormalization,
          reports,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
