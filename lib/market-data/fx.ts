import { getMarketDataConfig } from "@/lib/market-data/config";
import { getOrSetCached } from "@/lib/market-data/cache";
import { getQuoteFromTwelveData } from "@/lib/market-data/twelve-data";
import type { CurrencyCode } from "@/lib/backend/models";

const FALLBACK_USD_TO_CAD = 1.38;

export async function getFxRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) {
    return 1;
  }

  const { fxCacheTtlSeconds } = getMarketDataConfig();
  return getOrSetCached(`market-data:fx:${from}:${to}`, {
    ttlMs: fxCacheTtlSeconds * 1000,
    staleOnErrorMs: fxCacheTtlSeconds * 1000
  }, async () => {
    const usdCadQuote = await getQuoteFromTwelveData("USD/CAD");
    const usdToCad = usdCadQuote?.price && Number.isFinite(usdCadQuote.price)
      ? usdCadQuote.price
      : FALLBACK_USD_TO_CAD;

    if (from === "USD" && to === "CAD") {
      return usdToCad;
    }

    if (from === "CAD" && to === "USD") {
      return 1 / usdToCad;
    }

    return 1;
  });
}

export async function convertCurrencyAmount(amount: number, from: CurrencyCode, to: CurrencyCode) {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const rate = await getFxRate(from, to);
  return amount * rate;
}
