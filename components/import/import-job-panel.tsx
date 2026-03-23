"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Eye, FileText, Pencil, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MascotAsset } from "@/components/brand/mascot-asset";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { getImportMappingGroupTitle, getImportPresetLabel } from "@/lib/i18n/import";
import { DisplayLanguage, pick } from "@/lib/i18n/ui";

const MAPPING_GROUPS = [
  { title: "Core", fields: ["record_type", "account_key"] },
  { title: "Account rows", fields: ["account_type", "institution", "account_nickname", "account_currency", "market_value", "contribution_room_cad"] },
  { title: "Holding rows", fields: ["symbol", "name", "asset_class", "sector", "holding_currency", "quantity", "avg_cost_per_share", "cost_basis", "last_price", "market_value", "weight_pct", "gain_loss_pct"] },
  { title: "Transaction rows", fields: ["booked_at", "merchant", "category", "amount_cad", "direction"] }
] as const;

const REQUIRED_FIELDS = ["record_type", "account_key"] as const;

const BUILT_IN_PRESETS = [
  { key: "canonical", label: "Canonical CSV", mapping: {} as Record<string, string> },
  {
    key: "wealthsimple-generic",
    label: "Wealthsimple Generic",
    mapping: {
      record_type: "row_type",
      account_key: "acct_ref",
      account_type: "acct_kind",
      institution: "broker",
      account_nickname: "acct_label",
      account_currency: "acct_currency",
      market_value: "value_native",
      contribution_room_cad: "room_left",
      symbol: "ticker",
      name: "security_name",
      asset_class: "asset_bucket",
      sector: "bucket_sector",
      holding_currency: "trade_currency",
      quantity: "units",
      avg_cost_per_share: "avg_cost",
      cost_basis: "book_cost",
      last_price: "last_price",
      gain_loss_pct: "pnl_pct",
      booked_at: "trade_date",
      merchant: "payee",
      category: "spend_category",
      amount_cad: "cash_amount",
      direction: "flow_direction"
    }
  },
  {
    key: "questrade-generic",
    label: "Questrade Generic",
    mapping: {
      account_key: "account_id",
      account_type: "account_type",
      institution: "broker_name",
      account_nickname: "account_name",
      account_currency: "account_currency",
      market_value: "market_value",
      contribution_room_cad: "remaining_room",
      symbol: "symbol",
      name: "security_name",
      asset_class: "asset_class",
      sector: "sector_name",
      holding_currency: "currency",
      quantity: "quantity",
      avg_cost_per_share: "avg_cost",
      cost_basis: "cost_basis",
      last_price: "last_price",
      gain_loss_pct: "gain_loss_pct",
      booked_at: "transaction_date",
      merchant: "description",
      category: "category",
      amount_cad: "amount",
      direction: "cash_flow"
    }
  }
];

type PresetRecord = {
  id: string;
  name: string;
  sourceType: "csv";
  mapping: Record<string, string>;
};

type ReviewState = {
  summary: {
    accountsImported: number;
    holdingsImported: number;
    transactionsImported: number;
  };
  review: {
    importMode: "replace" | "merge";
    detectedHeaders: string[];
    rowCount: number;
  };
  validationErrors: Array<{ rowNumber: number; recordType: string | null; message: string }>;
};

type SymbolAuditRecord = {
  requestedSymbol: string;
  normalizedSymbol: string;
  name: string;
  provider: string;
  quotePrice: number | null;
  delayed: boolean;
  hasWarning: boolean;
  warningMessage: string | null;
};

type SymbolCorrectionDraft = {
  symbol: string;
  name: string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

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

function extractHeaders(csvContent: string) {
  const firstLine = csvContent.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim());
  return firstLine ? splitCsvLine(firstLine).map((header) => header.trim()).filter(Boolean) : [];
}

function previewCsvRows(csvContent: string, limit = 20) {
  const lines = csvContent.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  return {
    headers: splitCsvLine(lines[0]).map((header) => header.trim()),
    rows: lines.slice(1, limit + 1).map((line) => splitCsvLine(line))
  };
}

function buildDefaultMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  const normalizedIndex = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const group of MAPPING_GROUPS) {
    for (const field of group.fields) {
      mapping[field] = normalizedIndex.get(field) ?? "";
    }
  }
  return mapping;
}

function extractHoldingSymbolsForAudit(csvContent: string, mapping: Record<string, string>) {
  const lines = csvContent.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const recordTypeHeader = mapping.record_type;
  const symbolHeader = mapping.symbol;

  if (!recordTypeHeader || !symbolHeader) {
    return [];
  }

  const recordTypeIndex = headerIndex.get(recordTypeHeader);
  const symbolIndex = headerIndex.get(symbolHeader);
  if (recordTypeIndex == null || symbolIndex == null) {
    return [];
  }

  return [...new Set(lines
    .slice(1)
    .map((line) => splitCsvLine(line))
    .filter((row) => (row[recordTypeIndex] ?? "").trim().toLowerCase() === "holding")
    .map((row) => (row[symbolIndex] ?? "").trim().toUpperCase())
    .filter(Boolean))];
}

export function ImportJobPanel({
  latestJob,
  workflow = "portfolio",
  language = "zh"
}: {
  latestJob: { status: string; fileName: string; createdAt: string } | null;
  workflow?: "portfolio" | "spending";
  language?: DisplayLanguage;
}) {
  const router = useRouter();
  const endpoint = workflow === "portfolio" ? "/api/import/portfolio/jobs" : "/api/import/spending/jobs";
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("broker-export.csv");
  const [csvContent, setCsvContent] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [selectedPresetKey, setSelectedPresetKey] = useState("canonical");
  const [serverPresets, setServerPresets] = useState<PresetRecord[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ rowNumber: number; recordType: string | null; message: string }>>([]);
  const [symbolAudit, setSymbolAudit] = useState<{ records: SymbolAuditRecord[]; sampled: number; total: number } | null>(null);
  const [symbolCorrections, setSymbolCorrections] = useState<Record<string, SymbolCorrectionDraft>>({});
  const [symbolAuditStatus, setSymbolAuditStatus] = useState<{ loading: boolean; message: string; error: string }>({
    loading: false,
    message: "",
    error: ""
  });
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  useEffect(() => {
    fetch("/api/import/presets")
      .then(async (response) => {
        const payload = await safeJson(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Failed to load presets."));
        }
        return assertApiData<PresetRecord[]>(payload, Array.isArray, "Preset load succeeded but returned no usable preset list.");
      })
      .then((presets) => setServerPresets(presets))
      .catch(() => setServerPresets([]));
  }, []);

  const preview = useMemo(() => previewCsvRows(csvContent, 20), [csvContent]);
  const presetOptions = [
    ...BUILT_IN_PRESETS.map((preset) => ({ key: preset.key, label: preset.label, mapping: preset.mapping })),
    ...serverPresets.map((preset) => ({ key: preset.id, label: preset.name, mapping: preset.mapping }))
  ];
  const selectedServerPreset = serverPresets.find((preset) => preset.id === selectedPresetKey) ?? null;
  const missingRequiredMappings = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !fieldMapping[field]),
    [fieldMapping]
  );

  function applyPreset(presetKey: string, detectedHeaders = headers) {
    setSelectedPresetKey(presetKey);
    if (presetKey === "auto-detect") {
      setFieldMapping(buildDefaultMapping(detectedHeaders));
      return;
    }

    const preset = presetOptions.find((item) => item.key === presetKey);
    if (!preset) {
      return;
    }

    const next = { ...buildDefaultMapping(detectedHeaders) };
    for (const group of MAPPING_GROUPS) {
      for (const field of group.fields) {
        const mappedHeader = preset.mapping[field];
        if (!mappedHeader) {
          continue;
        }
        next[field] = detectedHeaders.find((header) => normalizeHeader(header) === normalizeHeader(mappedHeader)) ?? mappedHeader;
      }
    }
    setFieldMapping(next);
  }

  async function saveCurrentPreset() {
    const label = window.prompt(pick(language, "é¢„è®¾åç§°", "Preset name"));
    if (!label?.trim()) {
      return;
    }

    const mapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));
    const response = await fetch("/api/import/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: label.trim(), sourceType: "csv", mapping })
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "ä¿å­˜æ˜ å°„é¢„è®¾å¤±è´¥ã€‚", "Failed to save preset.")) });
      return;
    }
    let savedPreset: PresetRecord;
    try {
      savedPreset = assertApiData<PresetRecord>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "id" in candidate && "name" in candidate,
        pick(language, "é¢„è®¾ä¿å­˜æˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„é¢„è®¾æ•°æ®ã€‚", "Preset save succeeded but returned no usable preset payload.")
      );
    } catch {
      setStatus({ type: "error", message: pick(language, "é¢„è®¾ä¿å­˜æˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„é¢„è®¾æ•°æ®ã€‚", "Preset save succeeded but returned no usable preset payload.") });
      return;
    }

    setServerPresets((current) => {
      const next = [...current.filter((preset) => preset.id !== savedPreset.id), savedPreset];
      return next;
    });
    setSelectedPresetKey(savedPreset.id);
    setStatus({ type: "success", message: pick(language, `å·²ä¿å­˜æ˜ å°„é¢„è®¾â€œ${savedPreset.name}â€ã€‚`, `Saved mapping preset "${savedPreset.name}".`) });
  }

  async function renameSelectedPreset() {
    if (!selectedServerPreset) {
      return;
    }

    const nextName = window.prompt(pick(language, "é‡å‘½åé¢„è®¾", "Rename preset"), selectedServerPreset.name);
    if (!nextName?.trim() || nextName.trim() === selectedServerPreset.name) {
      return;
    }

    const response = await fetch(`/api/import/presets/${selectedServerPreset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName.trim() })
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "é‡å‘½åé¢„è®¾å¤±è´¥ã€‚", "Failed to rename preset.")) });
      return;
    }

    let renamedPreset: PresetRecord;
    try {
      renamedPreset = assertApiData<PresetRecord>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "id" in candidate && "name" in candidate,
        pick(language, "é¢„è®¾é‡å‘½åæˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„é¢„è®¾æ•°æ®ã€‚", "Preset rename succeeded but returned no usable preset payload.")
      );
    } catch {
      setStatus({ type: "error", message: pick(language, "é¢„è®¾é‡å‘½åæˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„é¢„è®¾æ•°æ®ã€‚", "Preset rename succeeded but returned no usable preset payload.") });
      return;
    }

    setServerPresets((current) => current.map((preset) => preset.id === selectedServerPreset.id ? renamedPreset : preset));
    setStatus({ type: "success", message: pick(language, `é¢„è®¾å·²é‡å‘½åä¸ºâ€œ${renamedPreset.name}â€ã€‚`, `Renamed preset to "${renamedPreset.name}".`) });
  }

  async function deleteSelectedPreset() {
    if (!selectedServerPreset) {
      return;
    }

    const confirmed = window.confirm(pick(language, `åˆ é™¤é¢„è®¾â€œ${selectedServerPreset.name}â€ï¼Ÿ`, `Delete preset "${selectedServerPreset.name}"?`));
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/import/presets/${selectedServerPreset.id}`, {
      method: "DELETE"
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "åˆ é™¤é¢„è®¾å¤±è´¥ã€‚", "Failed to delete preset.")) });
      return;
    }

    setServerPresets((current) => current.filter((preset) => preset.id !== selectedServerPreset.id));
    setSelectedPresetKey("auto-detect");
    applyPreset("auto-detect");
    setStatus({ type: "success", message: pick(language, `å·²åˆ é™¤é¢„è®¾â€œ${selectedServerPreset.name}â€ã€‚`, `Deleted preset "${selectedServerPreset.name}".`) });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setCsvContent("");
      setHeaders([]);
      setFieldMapping({});
      setReviewState(null);
      return;
    }

    try {
      const text = await selectedFile.text();
      const nextHeaders = extractHeaders(text);
      setCsvContent(text);
      setFileName(selectedFile.name);
      setHeaders(nextHeaders);
      setReviewState(null);
      setValidationErrors([]);
      setSymbolAudit(null);
      setSymbolCorrections({});
      setSymbolAuditStatus({ loading: false, message: "", error: "" });
      setStatus({ type: "idle", message: "" });
      applyPreset(selectedPresetKey === "canonical" ? "auto-detect" : selectedPresetKey, nextHeaders);
    } catch {
      setStatus({ type: "error", message: pick(language, "è¯»å–é€‰ä¸­çš„ CSV æ–‡ä»¶å¤±è´¥ã€‚", "Failed to read the selected CSV file.") });
    }
  }

  async function runValidation() {
    setStatus({ type: "idle", message: "" });
    setValidationErrors([]);
    setReviewState(null);
    setSymbolAudit(null);
    setSymbolCorrections({});
    setSymbolAuditStatus({ loading: false, message: "", error: "" });

    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        workflow,
        sourceType: "csv",
        csvContent: csvContent || undefined,
        fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
        importMode,
        dryRun: true
      })
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "æ ¡éªŒå¤±è´¥ã€‚", "Validation failed.")) });
      return;
    }

    let result: ReviewState;
    try {
      result = assertApiData<ReviewState>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "review" in candidate && "validationErrors" in candidate,
        pick(language, "æ ¡éªŒæˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„å¯¼å…¥å¤æ ¸æ•°æ®ã€‚", "Validation succeeded but returned no usable review payload.")
      );
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : pick(language, "æ ¡éªŒå¤±è´¥ã€‚", "Validation failed.") });
      return;
    }
    setValidationErrors(result.validationErrors ?? []);
    setReviewState(result);
    if ((result.validationErrors ?? []).length > 0) {
      setStatus({ type: "error", message: pick(language, `æ ¡éªŒæœªé€šè¿‡ï¼Œå‘çŽ° ${result.validationErrors.length} è¡Œé—®é¢˜ã€‚`, `Validation failed. ${result.validationErrors.length} row issues were found.`) });
      return;
    }
    void runSymbolAudit(sanitizedFieldMapping);
    setStatus({ type: "success", message: pick(language, "æ ¡éªŒé€šè¿‡ï¼Œè¯·å…ˆæŸ¥çœ‹å¯¼å…¥æ‘˜è¦ï¼Œå†ç¡®è®¤å†™å…¥ã€‚", "Validation passed. Review the import summary below, then confirm.") });
  }

  async function runSymbolAudit(sanitizedFieldMapping: Record<string, string>) {
    const allSymbols = extractHoldingSymbolsForAudit(csvContent, sanitizedFieldMapping);
    if (allSymbols.length === 0) {
      setSymbolAudit(null);
      setSymbolAuditStatus({ loading: false, message: "No holding symbols were found for symbol audit.", error: "" });
      return;
    }

    const sampledSymbols = allSymbols.slice(0, 20);
    setSymbolAuditStatus({ loading: true, message: "", error: "" });

    try {
      const [quotesResponse, ...resolveResponses] = await Promise.all([
        fetch(`/api/market-data/quotes?symbols=${encodeURIComponent(sampledSymbols.join(","))}`),
        ...sampledSymbols.map((symbol) => fetch(`/api/market-data/resolve?symbol=${encodeURIComponent(symbol)}`))
      ]);

      const quotesPayload = await safeJson(quotesResponse);
      if (!quotesResponse.ok) {
        throw new Error(getApiErrorMessage(quotesPayload, "Batch quote audit failed."));
      }

      const quoteMap = new Map<string, { price: number; delayed: boolean }>(
        ((assertApiData<{ results?: Array<{ symbol: string; price: number; delayed: boolean }> }>(
          quotesPayload,
          (candidate) => typeof candidate === "object" && candidate !== null,
          "Batch quote audit succeeded but returned no usable quote payload."
        ).results ?? []) as Array<{ symbol: string; price: number; delayed: boolean }>)
          .map((quote) => [quote.symbol.toUpperCase(), { price: Number(quote.price), delayed: Boolean(quote.delayed) }])
      );

      const resolvedRecords = await Promise.all(resolveResponses.map(async (response, index) => {
        const payload = await safeJson(response);
        if (!response.ok) {
          return {
            requestedSymbol: sampledSymbols[index],
            normalizedSymbol: sampledSymbols[index],
            name: sampledSymbols[index],
            provider: "fallback",
            quotePrice: quoteMap.get(sampledSymbols[index])?.price ?? null,
            delayed: quoteMap.get(sampledSymbols[index])?.delayed ?? true,
            hasWarning: true,
            warningMessage: getApiErrorMessage(payload, "Normalization failed.")
          } satisfies SymbolAuditRecord;
        }

        const data = assertApiData<{ result?: { symbol?: string; name?: string; provider?: string } }>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null,
          "Normalization audit succeeded but returned no usable normalization payload."
        );
        const result = data.result;
        const normalizedSymbol = typeof result?.symbol === "string" && result.symbol.trim().length > 0
          ? result.symbol.toUpperCase()
          : sampledSymbols[index];
        const quote = quoteMap.get(normalizedSymbol) ?? quoteMap.get(sampledSymbols[index]);
        const warningMessage = normalizedSymbol !== sampledSymbols[index]
          ? `Normalized from ${sampledSymbols[index]} to ${normalizedSymbol}.`
          : quote == null || !Number.isFinite(quote.price) || quote.price <= 0
            ? "No usable quote was returned for this symbol."
            : null;

        return {
          requestedSymbol: sampledSymbols[index],
          normalizedSymbol,
          name: typeof result?.name === "string" && result.name.trim().length > 0 ? result.name : normalizedSymbol,
          provider: typeof result?.provider === "string" && result.provider.trim().length > 0 ? result.provider : "fallback",
          quotePrice: quote?.price ?? null,
          delayed: quote?.delayed ?? true,
          hasWarning: Boolean(warningMessage),
          warningMessage
        } satisfies SymbolAuditRecord;
      }));

      setSymbolAudit({
        records: resolvedRecords,
        sampled: sampledSymbols.length,
        total: allSymbols.length
      });
      setSymbolCorrections(
        Object.fromEntries(
          resolvedRecords.map((record) => [
            record.requestedSymbol,
            { symbol: record.normalizedSymbol, name: record.name }
          ])
        )
      );
      setSymbolAuditStatus({
        loading: false,
        message: `Symbol audit checked ${sampledSymbols.length} of ${allSymbols.length} unique holding symbols.`,
        error: ""
      });
    } catch (error) {
      setSymbolAudit(null);
      setSymbolAuditStatus({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Symbol audit failed."
      });
    }
  }

  function confirmImport() {
    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));
    const sanitizedCorrections = Object.fromEntries(
      Object.entries(symbolCorrections)
        .filter(([, value]) => value.symbol.trim())
        .map(([requestedSymbol, value]) => [
          requestedSymbol,
          {
            symbol: value.symbol.trim().toUpperCase(),
            name: value.name.trim() || undefined
          }
        ])
    );
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          workflow,
          sourceType: "csv",
          csvContent: csvContent || undefined,
          fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
          symbolCorrections: Object.keys(sanitizedCorrections).length > 0 ? sanitizedCorrections : undefined,
          importMode,
          dryRun: false
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, "Failed to import CSV.") });
        return;
      }

      let result: { summary: ReviewState["summary"]; job: { fileName: string }; autoRecommendationRun?: { contributionAmountCad: number } | null };
      try {
        result = assertApiData(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "job" in candidate,
          "Import succeeded but returned no usable import result."
        );
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to import CSV." });
        return;
      }
        const recommendationMessage = result.autoRecommendationRun
          ? ` Auto-refreshed recommendation run for ${Number(result.autoRecommendationRun.contributionAmountCad).toLocaleString("en-CA")} CAD in the planning base currency.`
          : "";
      const modeLabel = importMode === "replace" ? "replaced" : "merged";
      setStatus({
        type: "success",
        message: `${modeLabel} ${result.summary.accountsImported} accounts, ${result.summary.holdingsImported} holdings, and ${result.summary.transactionsImported} transactions from ${result.job.fileName}.${recommendationMessage}`
      });
      setReviewState(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{pick(language, "ç›´æŽ¥ CSV å¯¼å…¥", "Direct CSV import")}</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {pick(language, "æ‰¹é‡å¯¼å…¥åˆ†ä¸¤æ­¥ï¼šå…ˆæ ¡éªŒå¹¶å¤æ ¸ï¼Œå†ç¡®è®¤å†™å…¥æ•°æ®åº“ã€‚", "Bulk import is a two-step flow: validate and review first, then confirm the database write.")}
          </p>
        </div>
        {latestJob
          ? <Badge variant="neutral">{pick(language, "æœ€è¿‘ä¸€æ¬¡ï¼š", "Latest: ")}{latestJob.status}</Badge>
          : <Badge variant="warning">{pick(language, "è¿˜æ²¡æœ‰å¯¼å…¥ä»»åŠ¡", "No job yet")}</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "CSV æ–‡ä»¶å", "CSV file name")}</span>
          <input
            type="text"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "å¯¼å…¥æ¨¡å¼", "Import mode")}</span>
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as "replace" | "merge")}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="replace">{pick(language, "æ›¿æ¢å½“å‰å…¨éƒ¨å·²å¯¼å…¥æ•°æ®", "Replace all current imported data")}</option>
            <option value="merge">{pick(language, "åˆå¹¶åˆ°çŽ°æœ‰è´¦æˆ·ã€æŒä»“å’Œäº¤æ˜“", "Merge into existing accounts, holdings, and transactions")}</option>
          </select>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "ä¸Šä¼  CSV", "CSV upload")}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-[color:var(--primary)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </label>

      <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
        <div className="flex items-center gap-2 font-medium text-[color:var(--foreground)]">
          <FileText className="h-4 w-4" />
          {pick(language, "æœ¬åœ° CSV æ¨¡æ¿", "Local CSV template")}
        </div>
        <p className="mt-2">
          {pick(language, "è¯·ä½¿ç”¨ ", "Use ")}<code>record_type</code>{pick(language, " åŒºåˆ† ", " rows for ")}<code>account</code>ã€<code>holding</code>{pick(language, " å’Œ ", ", and ")}<code>transaction</code>{pick(language, " ä¸‰ç±»è®°å½•ã€‚æ¨¡æ¿ä¸‹è½½åœ°å€ï¼š", ". Download the starter template at ")}{" "}
          <a href="/templates/portfolio-import-template.csv" className="font-medium text-[color:var(--primary)] underline">
            /templates/portfolio-import-template.csv
          </a>.
        </p>
      </div>

      {headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-[color:var(--primary)]" />
              <p className="font-medium">{pick(language, "å­—æ®µæ˜ å°„é¢„è®¾", "Field mapping presets")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedServerPreset ? (
                <>
                  <Button type="button" variant="secondary" leadingIcon={<Pencil className="h-4 w-4" />} onClick={renameSelectedPreset}>
                    {pick(language, "é‡å‘½åé¢„è®¾", "Rename preset")}
                  </Button>
                  <Button type="button" variant="secondary" leadingIcon={<Trash2 className="h-4 w-4" />} onClick={deleteSelectedPreset}>
                    {pick(language, "åˆ é™¤é¢„è®¾", "Delete preset")}
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} onClick={saveCurrentPreset}>
                {pick(language, "ä¿å­˜å½“å‰é¢„è®¾", "Save current preset")}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "é¢„è®¾", "Preset")}</span>
              <select
                value={selectedPresetKey}
                onChange={(event) => applyPreset(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="auto-detect">{getImportPresetLabel("auto-detect", "Auto-detect from headers", language)}</option>
                {presetOptions.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {getImportPresetLabel(preset.key, preset.label, language)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Badge variant="neutral">{pick(language, `æ£€æµ‹åˆ° ${headers.length} ä¸ªè¡¨å¤´`, `${headers.length} headers detected`)}</Badge>
            </div>
          </div>

          {MAPPING_GROUPS.map((group) => (
            <div key={getImportMappingGroupTitle(group.title, language)} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{getImportMappingGroupTitle(group.title, language)}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.fields.map((field) => (
                  <label key={field} className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">{field}</span>
                    <select
                      value={fieldMapping[field] ?? ""}
                      onChange={(event) => setFieldMapping((current) => ({ ...current, [field]: event.target.value }))}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="">{pick(language, "æœªæ˜ å°„", "Not mapped")}</option>
                      {headers.map((header) => (
                        <option key={`${field}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {missingRequiredMappings.length > 0 ? (
            <div className="rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-sm text-[#8e2433]">
              {pick(language, "ç¼ºå°‘å¿…å¡«æ˜ å°„ï¼š", "Required mappings missing: ")}{missingRequiredMappings.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview.headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="font-medium">{pick(language, "CSV é¢„è§ˆ", "CSV preview")}</p>
            <Badge variant="neutral">{pick(language, `å‰ ${preview.rows.length} è¡Œ`, `First ${preview.rows.length} rows`)}</Badge>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--card-muted)]">
                <tr>
                  {preview.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap px-3 py-2 font-medium text-[color:var(--foreground)]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={`preview-row-${index}`} className="border-t border-[color:var(--border)]">
                    {preview.headers.map((_, cellIndex) => (
                      <td key={`cell-${index}-${cellIndex}`} className="whitespace-nowrap px-3 py-2 text-[color:var(--muted-foreground)]">
                        {row[cellIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {reviewState && reviewState.validationErrors.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#b6d7c7] bg-[#eef8f1] p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_140px] md:items-start">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[#21613f]">
                <CheckCircle2 className="h-4 w-4" />
                {pick(language, "å¯¼å…¥å‰å¤æ ¸", "Review before import")}
              </div>
              <div className="grid gap-3 md:grid-cols-4 text-sm text-[#21613f]">
                <div>{pick(language, "è´¦æˆ·ï¼š", "Accounts: ")}{reviewState.summary.accountsImported}</div>
                <div>{pick(language, "æŒä»“ï¼š", "Holdings: ")}{reviewState.summary.holdingsImported}</div>
                <div>{pick(language, "äº¤æ˜“ï¼š", "Transactions: ")}{reviewState.summary.transactionsImported}</div>
                <div>{pick(language, "è§£æžè¡Œæ•°ï¼š", "Rows parsed: ")}{reviewState.review.rowCount}</div>
              </div>
              <p className="text-sm text-[#21613f]">
                {pick(language, "æ¨¡å¼ï¼š", "Mode: ")}{reviewState.review.importMode}. {pick(language, "æ ¡éªŒé€šè¿‡ã€‚ç¡®è®¤åŽä¼šæŠŠè¿™äº›ä¿®æ”¹å†™å…¥å½“å‰ç™»å½•ç”¨æˆ·çš„æ•°æ®åº“è®°å½•ã€‚", "Validation passed. Confirm to write these changes into the current signed-in user's database records.")}
              </p>
              <p className="text-sm text-[#21613f]">
                {pick(language, "ä¼°å€¼è§„åˆ™ï¼šå¦‚æžœæŒä»“è¡ŒåŒ…å« ", "Valuation rule: if a holding row includes ")}<code>market_value</code>{pick(language, "ï¼Œç³»ç»Ÿä¼šä¼˜å…ˆå†™å…¥è¿™ä»½æ˜¾å¼æ€»å€¼ï¼Œè€Œä¸æ˜¯ä½¿ç”¨ ", ", that explicit total value is written and takes priority over any derived value from ")}<code>quantity x last_price</code>{pick(language, " æŽ¨å¯¼å€¼ã€‚", ".")}
              </p>
            </div>
            <div className="justify-self-start md:justify-self-end">
              <MascotAsset name="reviewPointing" className="h-[132px] w-[132px]" sizes="132px" />
            </div>
          </div>
          {symbolAudit?.records?.length ? (
            <div className="rounded-2xl border border-[#b6d7c7] bg-white px-4 py-3 text-sm text-[#21613f]">
              <p className="font-medium">{pick(language, "æœ€ç»ˆå°†å†™å…¥çš„æŒä»“", "Final holdings that will be written")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {symbolAudit.records.slice(0, 8).map((record) => (
                  <Badge key={`final-write-${record.requestedSymbol}`} variant="success">
                    {(symbolCorrections[record.requestedSymbol]?.symbol ?? record.normalizedSymbol).toUpperCase()} - {(symbolCorrections[record.requestedSymbol]?.name ?? record.name)}
                  </Badge>
                ))}
                {symbolAudit.records.length > 8 ? (
                  <Badge variant="neutral">+{symbolAudit.records.length - 8} {pick(language, "ä¸ª", "more")}</Badge>
                ) : null}
              </div>
            </div>
          ) : null}
          <Button type="button" onClick={confirmImport} disabled={isPending} leadingIcon={<Upload className="h-4 w-4" />}>
            {isPending ? pick(language, "å¯¼å…¥ä¸­...", "Importing...") : pick(language, "ç¡®è®¤å¯¼å…¥", "Confirm import")}
          </Button>
        </div>
      ) : null}

      {reviewState && reviewState.validationErrors.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_112px] md:items-start">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[color:var(--foreground)]">
                <Eye className="h-4 w-4 text-[color:var(--primary)]" />
                {pick(language, "ä»£ç å®¡è®¡", "Symbol audit")}
                {symbolAuditStatus.loading ? <Badge variant="warning">{pick(language, "æ‰§è¡Œä¸­", "Running")}</Badge> : <Badge variant="neutral">{pick(language, "è¾…åŠ©å¤æ ¸", "Review aid")}</Badge>}
              </div>
              {symbolAuditStatus.message ? (
                <p className="text-sm text-[color:var(--muted-foreground)]">{symbolAuditStatus.message}</p>
              ) : null}
              {symbolAuditStatus.error ? (
                <div className="rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-sm text-[#8e2433]">
                  {symbolAuditStatus.error}
                </div>
              ) : null}
            </div>
            <div className="justify-self-start md:justify-self-end">
              <MascotAsset name="sideEyeReview" className="h-[112px] w-[112px]" sizes="112px" />
            </div>
          </div>
          {symbolAudit ? (
            <div className="space-y-2">
              {symbolAudit.records.map((record) => (
                <div key={`${record.requestedSymbol}-${record.normalizedSymbol}`} className={`rounded-xl border px-4 py-3 text-sm ${record.hasWarning ? "border-[#f0c9d0] bg-[#fff8f9]" : "border-[color:var(--border)] bg-[color:var(--card-muted)]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">
                        {record.requestedSymbol} {"->"} {record.normalizedSymbol} - {record.name}
                            </p>
                            <p className="mt-1 text-[color:var(--muted-foreground)]">
                        {pick(language, "æ¥æºï¼š", "Provider: ")}{record.provider}{record.quotePrice != null ? pick(language, ` Â· è¡Œæƒ… ${record.quotePrice.toFixed(2)}${record.delayed ? "ï¼ˆå»¶è¿Ÿï¼‰" : ""}`, ` - Quote ${record.quotePrice.toFixed(2)}${record.delayed ? " (delayed)" : ""}`) : pick(language, " Â· æ— å¯ç”¨è¡Œæƒ…", " - No quote")}
                            </p>
                          </div>
                          <Badge variant={record.hasWarning ? "warning" : "success"}>
                      {record.hasWarning ? pick(language, "éœ€è¦å¤æ ¸", "Needs review") : pick(language, "çœ‹èµ·æ¥æ­£å¸¸", "Looks good")}
                          </Badge>
                  </div>
                  {record.warningMessage ? (
                    <p className={`mt-2 ${record.hasWarning ? "text-[#8e2433]" : "text-[color:var(--muted-foreground)]"}`}>
                      {record.warningMessage}
                    </p>
                  ) : null}
                  {record.hasWarning ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{pick(language, "è¦†ç›–ä»£ç ", "Override symbol")}</span>
                        <input
                          value={symbolCorrections[record.requestedSymbol]?.symbol ?? record.normalizedSymbol}
                          onChange={(event) => setSymbolCorrections((current) => ({
                            ...current,
                            [record.requestedSymbol]: {
                              symbol: event.target.value.toUpperCase(),
                              name: current[record.requestedSymbol]?.name ?? record.name
                            }
                          }))}
                          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{pick(language, "è¦†ç›–åç§°", "Override name")}</span>
                        <input
                          value={symbolCorrections[record.requestedSymbol]?.name ?? record.name}
                          onChange={(event) => setSymbolCorrections((current) => ({
                            ...current,
                            [record.requestedSymbol]: {
                              symbol: current[record.requestedSymbol]?.symbol ?? record.normalizedSymbol,
                              name: event.target.value
                            }
                          }))}
                          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                    <span className="font-medium text-[color:var(--foreground)]">{pick(language, "æœ€ç»ˆå†™å…¥ï¼š", "Final write:")}</span>{" "}
                    {(symbolCorrections[record.requestedSymbol]?.symbol ?? record.normalizedSymbol).toUpperCase()} - {symbolCorrections[record.requestedSymbol]?.name ?? record.name}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {latestJob ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "æœ€è¿‘ä¸€æ¬¡ä»»åŠ¡ï¼š", "Latest job: ")}{latestJob.fileName}</p>
      ) : null}

      {status.type !== "idle" ? (
        <div className={`grid gap-3 rounded-2xl border px-4 py-3 text-sm md:grid-cols-[1fr_96px] md:items-center ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          <div>{status.message}</div>
          <div className="justify-self-start md:justify-self-end">
            <MascotAsset name={status.type === "success" ? "successSmirk" : "alertRun"} className="h-24 w-24" sizes="96px" />
          </div>
        </div>
      ) : null}

      {validationErrors.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#e7b0b8] bg-[#fff8f9] p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_112px] md:items-start">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[#8e2433]">
                <AlertTriangle className="h-4 w-4" />
                {pick(language, "å¯¼å…¥æ ¡éªŒé—®é¢˜", "Import validation issues")}
              </div>
              <div className="space-y-2">
                {validationErrors.slice(0, 12).map((error) => (
                  <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl border border-[#f0c9d0] bg-white px-3 py-2 text-sm text-[#8e2433]">
                    {pick(language, "ç¬¬ ", "Row ")}{error.rowNumber}{error.recordType ? ` (${error.recordType})` : ""}: {error.message}
                  </div>
                ))}
              </div>
            </div>
            <div className="justify-self-start md:justify-self-end">
              <MascotAsset name="alertRun" className="h-[112px] w-[112px]" sizes="112px" />
            </div>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={runValidation}
        disabled={isPending || !csvContent || missingRequiredMappings.length > 0}
        leadingIcon={<Upload className="h-4 w-4" />}
      >
        {pick(language, "æ ¡éªŒå¹¶å¤æ ¸å¯¼å…¥", "Validate and review import")}
      </Button>
    </div>
  );
}


