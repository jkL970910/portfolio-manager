import type { AccountType, CurrencyCode } from "@/lib/backend/models";
import {
  ImportCanonicalField,
  ImportFieldMapping,
  normalizeCsvHeader,
  splitCsvLine,
} from "@/lib/import/csv-client";

export {
  extractCsvHeaders,
  previewCsvContent,
  type CsvPreview,
  type ImportCanonicalField,
  type ImportFieldMapping,
} from "@/lib/import/csv-client";

export interface ParsedAccountSeed {
  accountKey: string;
  institution: string;
  type: AccountType;
  nickname: string;
  currency: CurrencyCode;
  marketValueAmount: number | null;
  marketValueCad: number | null;
  contributionRoomCad: number | null;
}

export interface ParsedHoldingSeed {
  accountKey: string;
  symbol: string;
  name: string;
  exchange: string | null;
  assetClass: string;
  sector: string;
  currency: CurrencyCode;
  quantity: number | null;
  avgCostPerShareAmount: number | null;
  costBasisAmount: number | null;
  lastPriceAmount: number | null;
  marketValueAmount: number;
  avgCostPerShareCad: number | null;
  costBasisCad: number | null;
  lastPriceCad: number | null;
  marketValueCad: number;
  weightPct: number | null;
  gainLossPct: number;
}

export interface ParsedTransactionSeed {
  accountKey: string | null;
  bookedAt: string;
  merchant: string;
  category: string;
  amountCad: number;
  direction: "inflow" | "outflow";
}

export interface ImportValidationError {
  rowNumber: number;
  recordType: string | null;
  message: string;
}

export interface ParsedCsvImport {
  accounts: ParsedAccountSeed[];
  holdings: ParsedHoldingSeed[];
  transactions: ParsedTransactionSeed[];
  validationErrors: ImportValidationError[];
  detectedHeaders: string[];
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return parsed;
}

function parseAccountType(value: string): AccountType {
  const normalized = value.trim();
  if (normalized === "TFSA" || normalized === "RRSP" || normalized === "FHSA" || normalized === "Taxable") {
    return normalized;
  }
  throw new Error(`Unsupported account_type: ${value}`);
}

function parseCurrency(value: string, fallback: CurrencyCode = "CAD"): CurrencyCode {
  const normalized = value.trim().toUpperCase();
  return normalized === "USD" ? "USD" : fallback;
}

function parseDirection(value: string): "inflow" | "outflow" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "inflow" || normalized === "outflow") {
    return normalized;
  }
  throw new Error(`Unsupported direction: ${value}`);
}

function parseDate(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Invalid booked_at date: ${value}`);
  }
  return normalized;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function resolveMappedHeader(canonicalField: ImportCanonicalField, fieldMapping: ImportFieldMapping) {
  return normalizeCsvHeader(fieldMapping[canonicalField] ?? canonicalField);
}

function getMappedValue(
  row: Record<string, string>,
  canonicalField: ImportCanonicalField,
  fieldMapping: ImportFieldMapping
) {
  const resolvedHeader = resolveMappedHeader(canonicalField, fieldMapping);
  return row[resolvedHeader] ?? "";
}

async function convertAmountToCad(amount: number | null, currency: CurrencyCode) {
  if (amount == null) {
    return null;
  }
  if (currency === "CAD") {
    return round(amount);
  }
  const { convertCurrencyAmount } = await import("@/lib/market-data/fx");
  return round(await convertCurrencyAmount(amount, currency, "CAD"));
}

export async function parseImportCsv(csvContent: string, fieldMapping: ImportFieldMapping = {}): Promise<ParsedCsvImport> {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const rawHeaders = splitCsvLine(lines[0]).map((header) => header.trim());
  const normalizedHeaders = rawHeaders.map(normalizeCsvHeader);
  const rows = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    normalizedHeaders.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] ?? "";
    });
    return { rowNumber: index + 2, record };
  });

  const missingMappedHeaders = Object.entries(fieldMapping)
    .filter(([, selectedHeader]) => selectedHeader && !normalizedHeaders.includes(normalizeCsvHeader(selectedHeader)))
    .map(([canonicalField, selectedHeader]) => `${canonicalField} -> ${selectedHeader}`);

  const validationErrors: ImportValidationError[] = missingMappedHeaders.map((message) => ({
    rowNumber: 1,
    recordType: null,
    message: `Mapped header not found in CSV: ${message}`
  }));

  const accountMap = new Map<string, ParsedAccountSeed>();
  const holdings: ParsedHoldingSeed[] = [];
  const transactions: ParsedTransactionSeed[] = [];

  for (const rowEntry of rows) {
    const { rowNumber, record } = rowEntry;
    const recordTypeRaw = getMappedValue(record, "record_type", fieldMapping).trim().toLowerCase();
    const accountKey = getMappedValue(record, "account_key", fieldMapping).trim() || null;

    if (!recordTypeRaw) {
      validationErrors.push({ rowNumber, recordType: null, message: "Each row must include record_type." });
      continue;
    }

    try {
      if (recordTypeRaw === "account") {
        if (!accountKey) {
          throw new Error("Account rows must include account_key.");
        }
        const currency = parseCurrency(getMappedValue(record, "account_currency", fieldMapping) || "CAD");
        const explicitMarketValueAmount = parseNumber(getMappedValue(record, "market_value", fieldMapping))
          ?? parseNumber(getMappedValue(record, "market_value_cad", fieldMapping));
        accountMap.set(accountKey, {
          accountKey,
          institution: getMappedValue(record, "institution", fieldMapping).trim() || "Imported Broker",
          type: parseAccountType(getMappedValue(record, "account_type", fieldMapping)),
          nickname: getMappedValue(record, "account_nickname", fieldMapping).trim() || accountKey,
          currency,
          marketValueAmount: explicitMarketValueAmount,
          marketValueCad: await convertAmountToCad(explicitMarketValueAmount, currency),
          contributionRoomCad: parseNumber(getMappedValue(record, "contribution_room_cad", fieldMapping))
        });
        continue;
      }

      if (recordTypeRaw === "holding") {
        if (!accountKey) {
          throw new Error("Holding rows must include account_key.");
        }
        const currency = parseCurrency(
          getMappedValue(record, "holding_currency", fieldMapping)
          || getMappedValue(record, "account_currency", fieldMapping)
          || "CAD"
        );
        const quantity = parseNumber(getMappedValue(record, "quantity", fieldMapping));
        const avgCostPerShareAmount = parseNumber(getMappedValue(record, "avg_cost_per_share", fieldMapping))
          ?? parseNumber(getMappedValue(record, "avg_cost_per_share_cad", fieldMapping));
        const explicitCostBasisAmount = parseNumber(getMappedValue(record, "cost_basis", fieldMapping))
          ?? parseNumber(getMappedValue(record, "cost_basis_cad", fieldMapping));
        const lastPriceAmount = parseNumber(getMappedValue(record, "last_price", fieldMapping))
          ?? parseNumber(getMappedValue(record, "last_price_cad", fieldMapping));
        const explicitMarketValueAmount = parseNumber(getMappedValue(record, "market_value", fieldMapping))
          ?? parseNumber(getMappedValue(record, "market_value_cad", fieldMapping));
        const computedCostBasisAmount = explicitCostBasisAmount ?? (
          quantity != null && avgCostPerShareAmount != null ? round(quantity * avgCostPerShareAmount) : null
        );
        const marketValueAmount = explicitMarketValueAmount ?? (
          quantity != null && lastPriceAmount != null ? round(quantity * lastPriceAmount) : null
        );

        if (marketValueAmount == null) {
          throw new Error("Holding rows must include market_value or quantity plus last_price.");
        }
        const avgCostPerShareCad = await convertAmountToCad(avgCostPerShareAmount, currency);
        const computedCostBasisCad = await convertAmountToCad(computedCostBasisAmount, currency);
        const lastPriceCad = await convertAmountToCad(lastPriceAmount, currency);
        const marketValueCad = (await convertAmountToCad(marketValueAmount, currency)) ?? 0;

        const explicitGainLossPct = parseNumber(getMappedValue(record, "gain_loss_pct", fieldMapping));
        const computedGainLossPct = explicitGainLossPct ?? (
          computedCostBasisCad != null && computedCostBasisCad > 0
            ? round(((marketValueCad - computedCostBasisCad) / computedCostBasisCad) * 100, 2)
            : 0
        );

        holdings.push({
          accountKey,
          symbol: getMappedValue(record, "symbol", fieldMapping).trim() || "UNKNOWN",
          name: getMappedValue(record, "name", fieldMapping).trim() || getMappedValue(record, "symbol", fieldMapping).trim() || "Imported Holding",
          exchange: getMappedValue(record, "exchange", fieldMapping).trim() || null,
          assetClass: getMappedValue(record, "asset_class", fieldMapping).trim() || "Unknown",
          sector: getMappedValue(record, "sector", fieldMapping).trim() || "Multi-sector",
          currency,
          quantity,
          avgCostPerShareAmount,
          costBasisAmount: computedCostBasisAmount,
          lastPriceAmount,
          marketValueAmount,
          avgCostPerShareCad,
          costBasisCad: computedCostBasisCad,
          lastPriceCad,
          marketValueCad,
          weightPct: parseNumber(getMappedValue(record, "weight_pct", fieldMapping)),
          gainLossPct: computedGainLossPct
        });

        if (!accountMap.has(accountKey)) {
          accountMap.set(accountKey, {
            accountKey,
            institution: getMappedValue(record, "institution", fieldMapping).trim() || "Imported Broker",
            type: parseAccountType(getMappedValue(record, "account_type", fieldMapping) || "TFSA"),
            nickname: getMappedValue(record, "account_nickname", fieldMapping).trim() || accountKey,
            currency,
            marketValueAmount: null,
            marketValueCad: null,
            contributionRoomCad: parseNumber(getMappedValue(record, "contribution_room_cad", fieldMapping))
          });
        }
        continue;
      }

      if (recordTypeRaw === "transaction") {
        const amountCad = parseNumber(getMappedValue(record, "amount_cad", fieldMapping));
        if (amountCad == null) {
          throw new Error("Transaction rows must include amount_cad.");
        }
        transactions.push({
          accountKey,
          bookedAt: parseDate(getMappedValue(record, "booked_at", fieldMapping)),
          merchant: getMappedValue(record, "merchant", fieldMapping).trim() || "Imported Transaction",
          category: getMappedValue(record, "category", fieldMapping).trim() || "Uncategorized",
          amountCad,
          direction: parseDirection(getMappedValue(record, "direction", fieldMapping))
        });
        continue;
      }

      throw new Error(`Unsupported record_type: ${recordTypeRaw}`);
    } catch (error) {
      validationErrors.push({
        rowNumber,
        recordType: recordTypeRaw,
        message: error instanceof Error ? error.message : "Unable to parse row."
      });
    }
  }

  const accounts = [...accountMap.values()].map((account) => {
    const holdingTotal = holdings
      .filter((holding) => holding.accountKey === account.accountKey)
      .reduce((sum, holding) => sum + (holding.marketValueCad ?? 0), 0);

    return {
      ...account,
      marketValueAmount: account.marketValueAmount ?? holdingTotal,
      marketValueCad: account.marketValueCad ?? holdingTotal
    };
  });

  return {
    accounts,
    holdings: holdings.map((holding) => {
      const accountTotal = accounts.find((account) => account.accountKey === holding.accountKey)?.marketValueCad ?? 0;
      return {
        ...holding,
        weightPct: holding.weightPct ?? (accountTotal > 0 ? Number(((holding.marketValueCad / accountTotal) * 100).toFixed(2)) : 0)
      };
    }),
    transactions,
    validationErrors,
    detectedHeaders: rawHeaders
  };
}
