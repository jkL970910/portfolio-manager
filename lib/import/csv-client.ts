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
  | "account_currency"
  | "market_value"
  | "market_value_cad"
  | "contribution_room_cad"
  | "symbol"
  | "name"
  | "exchange"
  | "asset_class"
  | "sector"
  | "holding_currency"
  | "quantity"
  | "avg_cost_per_share"
  | "avg_cost_per_share_cad"
  | "cost_basis"
  | "cost_basis_cad"
  | "last_price"
  | "last_price_cad"
  | "weight_pct"
  | "gain_loss_pct"
  | "booked_at"
  | "merchant"
  | "category"
  | "amount_cad"
  | "direction";

export function splitCsvLine(line: string) {
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

export function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function extractCsvHeaders(csvContent: string) {
  const firstLine = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());
  return firstLine
    ? splitCsvLine(firstLine).map((header) => header.trim()).filter(Boolean)
    : [];
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
