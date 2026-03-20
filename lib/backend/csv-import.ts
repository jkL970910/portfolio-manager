import { AccountType } from "@/lib/backend/models";

export interface ParsedAccountSeed {
  accountKey: string;
  institution: string;
  type: AccountType;
  nickname: string;
  marketValueCad: number | null;
  contributionRoomCad: number | null;
}

export interface ParsedHoldingSeed {
  accountKey: string;
  symbol: string;
  name: string;
  assetClass: string;
  sector: string;
  quantity: number | null;
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

export interface CsvPreview {
  headers: string[];
  rows: string[][];
}

export type ImportFieldMapping = Partial<Record<ImportCanonicalField, string>>;

export type ImportCanonicalField =
  | "record_type"
  | "account_key"
  | "account_type"
  | "institution"
  | "account_nickname"
  | "market_value_cad"
  | "contribution_room_cad"
  | "symbol"
  | "name"
  | "asset_class"
  | "sector"
  | "quantity"
  | "avg_cost_per_share_cad"
  | "cost_basis_cad"
  | "last_price_cad"
  | "weight_pct"
  | "gain_loss_pct"
  | "booked_at"
  | "merchant"
  | "category"
  | "amount_cad"
  | "direction";

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function extractCsvHeaders(csvContent: string) {
  const firstLine = csvContent.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim());
  return firstLine ? splitCsvLine(firstLine).map((header) => header.trim()).filter(Boolean) : [];
}

export function previewCsvContent(csvContent: string, limit = 20): CsvPreview {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1, limit + 1).map((line) => splitCsvLine(line));
  return { headers, rows };
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
  return normalizeHeader(fieldMapping[canonicalField] ?? canonicalField);
}

function getMappedValue(
  row: Record<string, string>,
  canonicalField: ImportCanonicalField,
  fieldMapping: ImportFieldMapping
) {
  const resolvedHeader = resolveMappedHeader(canonicalField, fieldMapping);
  return row[resolvedHeader] ?? "";
}

export function parseImportCsv(csvContent: string, fieldMapping: ImportFieldMapping = {}): ParsedCsvImport {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const rawHeaders = splitCsvLine(lines[0]).map((header) => header.trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const rows = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    normalizedHeaders.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] ?? "";
    });
    return { rowNumber: index + 2, record };
  });

  const missingMappedHeaders = Object.entries(fieldMapping)
    .filter(([, selectedHeader]) => selectedHeader && !normalizedHeaders.includes(normalizeHeader(selectedHeader)))
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
        accountMap.set(accountKey, {
          accountKey,
          institution: getMappedValue(record, "institution", fieldMapping).trim() || "Imported Broker",
          type: parseAccountType(getMappedValue(record, "account_type", fieldMapping)),
          nickname: getMappedValue(record, "account_nickname", fieldMapping).trim() || accountKey,
          marketValueCad: parseNumber(getMappedValue(record, "market_value_cad", fieldMapping)),
          contributionRoomCad: parseNumber(getMappedValue(record, "contribution_room_cad", fieldMapping))
        });
        continue;
      }

      if (recordTypeRaw === "holding") {
        if (!accountKey) {
          throw new Error("Holding rows must include account_key.");
        }
        const quantity = parseNumber(getMappedValue(record, "quantity", fieldMapping));
        const avgCostPerShareCad = parseNumber(getMappedValue(record, "avg_cost_per_share_cad", fieldMapping));
        const explicitCostBasisCad = parseNumber(getMappedValue(record, "cost_basis_cad", fieldMapping));
        const lastPriceCad = parseNumber(getMappedValue(record, "last_price_cad", fieldMapping));
        const explicitMarketValueCad = parseNumber(getMappedValue(record, "market_value_cad", fieldMapping));
        const computedCostBasisCad = explicitCostBasisCad ?? (
          quantity != null && avgCostPerShareCad != null ? round(quantity * avgCostPerShareCad) : null
        );
        const marketValueCad = explicitMarketValueCad ?? (
          quantity != null && lastPriceCad != null ? round(quantity * lastPriceCad) : null
        );

        if (marketValueCad == null) {
          throw new Error("Holding rows must include market_value_cad or quantity plus last_price_cad.");
        }

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
          assetClass: getMappedValue(record, "asset_class", fieldMapping).trim() || "Unknown",
          sector: getMappedValue(record, "sector", fieldMapping).trim() || "Multi-sector",
          quantity,
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
      .reduce((sum, holding) => sum + holding.marketValueCad, 0);

    return {
      ...account,
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
