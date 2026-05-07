import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { fxRates } from "@/lib/db/schema";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { getOrSetCached } from "@/lib/market-data/cache";
import { getQuoteFromTwelveData } from "@/lib/market-data/twelve-data";
import type { CurrencyCode } from "@/lib/backend/models";

const FALLBACK_USD_TO_CAD = 1.38;
const STORED_FX_FRESH_MS = 36 * 60 * 60 * 1000;

export type FxRateFreshness = "fresh" | "stale" | "fallback";

export type StoredOrFallbackFxRate = {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  rateDate: string | null;
  source: string;
  freshness: FxRateFreshness;
};

export type RefreshedFxRate = StoredOrFallbackFxRate & {
  refreshed: boolean;
  errorMessage: string | null;
};

function fallbackFxRate(from: CurrencyCode, to: CurrencyCode) {
  if (from === to) {
    return 1;
  }

  if (from === "USD" && to === "CAD") {
    return FALLBACK_USD_TO_CAD;
  }

  if (from === "CAD" && to === "USD") {
    return 1 / FALLBACK_USD_TO_CAD;
  }

  return 1;
}

function classifyFxFreshness(rateDate: string): FxRateFreshness {
  const ageMs = Date.now() - new Date(`${rateDate}T00:00:00.000Z`).getTime();
  return ageMs <= STORED_FX_FRESH_MS ? "fresh" : "stale";
}

async function getLatestStoredFxRate(from: CurrencyCode, to: CurrencyCode) {
  if (from === to) {
    return {
      rate: 1,
      rateDate: new Date().toISOString().slice(0, 10),
      source: "same-currency",
    };
  }

  try {
    const db = getDb();
    const direct = await db.query.fxRates.findFirst({
      where: and(eq(fxRates.baseCurrency, from), eq(fxRates.quoteCurrency, to)),
      orderBy: desc(fxRates.rateDate),
    });

    if (direct) {
      return {
        rate: Number(direct.rate),
        rateDate: direct.rateDate,
        source: direct.source,
      };
    }

    const inverse = await db.query.fxRates.findFirst({
      where: and(eq(fxRates.baseCurrency, to), eq(fxRates.quoteCurrency, from)),
      orderBy: desc(fxRates.rateDate),
    });

    if (inverse && Number(inverse.rate) > 0) {
      return {
        rate: 1 / Number(inverse.rate),
        rateDate: inverse.rateDate,
        source: inverse.source,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function upsertStoredFxRate(input: {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  rateDate: string;
  source: string;
}) {
  if (
    input.from === input.to ||
    !Number.isFinite(input.rate) ||
    input.rate <= 0
  ) {
    return;
  }

  try {
    const db = getDb();
    await db
      .insert(fxRates)
      .values({
        baseCurrency: input.from,
        quoteCurrency: input.to,
        rateDate: input.rateDate,
        rate: input.rate.toFixed(8),
        source: input.source,
      })
      .onConflictDoUpdate({
        target: [fxRates.baseCurrency, fxRates.quoteCurrency, fxRates.rateDate],
        set: {
          rate: sql`excluded.rate`,
          source: sql`excluded.source`,
        },
      });
  } catch {
    return;
  }
}

export async function getStoredOrFallbackFxRate(
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<number> {
  const context = await getStoredOrFallbackFxContext(from, to);
  return context.rate;
}

export async function getStoredOrFallbackFxContext(
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<StoredOrFallbackFxRate> {
  const stored = await getLatestStoredFxRate(from, to);
  if (stored) {
    return {
      from,
      to,
      rate: stored.rate,
      rateDate: stored.rateDate,
      source: stored.source,
      freshness: classifyFxFreshness(stored.rateDate),
    };
  }

  return {
    from,
    to,
    rate: fallbackFxRate(from, to),
    rateDate: null,
    source: "fallback-static",
    freshness: "fallback",
  };
}

export async function getFxRate(
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<number> {
  if (from === to) {
    return 1;
  }

  const { fxCacheTtlSeconds } = getMarketDataConfig();
  try {
    return await getOrSetCached(
      `market-data:fx:${from}:${to}`,
      {
        ttlMs: fxCacheTtlSeconds * 1000,
        staleOnErrorMs: fxCacheTtlSeconds * 1000,
      },
      async () => {
        const stored = await getLatestStoredFxRate(from, to);
        if (stored) {
          const ageMs =
            Date.now() - new Date(`${stored.rateDate}T00:00:00.000Z`).getTime();
          if (ageMs <= STORED_FX_FRESH_MS) {
            return stored.rate;
          }
        }

        const usdCadQuote = await getQuoteFromTwelveData("USD/CAD");
        const usdToCad =
          usdCadQuote?.price && Number.isFinite(usdCadQuote.price)
            ? usdCadQuote.price
            : FALLBACK_USD_TO_CAD;
        const rateDate = new Date().toISOString().slice(0, 10);
        await upsertStoredFxRate({
          from: "USD",
          to: "CAD",
          rate: usdToCad,
          rateDate,
          source:
            usdCadQuote?.provider === "twelve-data"
              ? "twelve-data"
              : "fallback-static",
        });

        if (from === "USD" && to === "CAD") {
          return usdToCad;
        }

        if (from === "CAD" && to === "USD") {
          return 1 / usdToCad;
        }

        return 1;
      },
    );
  } catch {
    return getStoredOrFallbackFxRate(from, to);
  }
}

export function formatFxRateLabel(input: {
  rate: number;
  rateDate: string | null;
  source: string;
  freshness: FxRateFreshness;
}) {
  const freshnessLabel =
    input.freshness === "fresh"
      ? "最新"
      : input.freshness === "stale"
        ? "可能过期"
        : "保守兜底";
  const sourceLabel =
    input.source === "fallback-static" ? "本地保守兜底" : input.source;
  return `USD/CAD ${input.rate.toFixed(4)} · ${freshnessLabel} · 日期 ${input.rateDate ?? "暂无"} · 来源 ${sourceLabel}`;
}

export async function refreshFxRate(
  from: CurrencyCode,
  to: CurrencyCode,
  options: { force?: boolean } = {},
): Promise<RefreshedFxRate> {
  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      rateDate: new Date().toISOString().slice(0, 10),
      source: "same-currency",
      freshness: "fresh",
      refreshed: true,
      errorMessage: null,
    };
  }

  if (!options.force) {
    const stored = await getLatestStoredFxRate(from, to);
    if (stored && classifyFxFreshness(stored.rateDate) === "fresh") {
      return {
        from,
        to,
        rate: stored.rate,
        rateDate: stored.rateDate,
        source: stored.source,
        freshness: "fresh",
        refreshed: false,
        errorMessage: null,
      };
    }
  }

  try {
    const usdCadQuote = await getQuoteFromTwelveData("USD/CAD");
    const usdToCad =
      usdCadQuote?.price && Number.isFinite(usdCadQuote.price)
        ? usdCadQuote.price
        : null;

    if (!usdToCad || usdToCad <= 0) {
      const current = await getStoredOrFallbackFxContext(from, to);
      return {
        ...current,
        refreshed: false,
        errorMessage: "没有拿到新的 USD/CAD 汇率，已沿用最近可用汇率。",
      };
    }

    const source =
      usdCadQuote?.provider === "twelve-data"
        ? "twelve-data"
        : "fallback-static";
    const rateDate = new Date().toISOString().slice(0, 10);
    await upsertStoredFxRate({
      from: "USD",
      to: "CAD",
      rate: usdToCad,
      rateDate,
      source,
    });

    const rate =
      from === "USD" && to === "CAD"
        ? usdToCad
        : from === "CAD" && to === "USD"
          ? 1 / usdToCad
          : 1;

    return {
      from,
      to,
      rate,
      rateDate,
      source,
      freshness: "fresh",
      refreshed: source === "twelve-data",
      errorMessage:
        source === "twelve-data"
          ? null
          : "没有拿到新的 USD/CAD 汇率，已沿用保守兜底汇率。",
    };
  } catch (error) {
    const current = await getStoredOrFallbackFxContext(from, to);
    return {
      ...current,
      refreshed: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : "FX 汇率刷新失败，已沿用最近可用汇率。",
    };
  }
}

export async function convertCurrencyAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
) {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const rate = await getFxRate(from, to);
  return amount * rate;
}
