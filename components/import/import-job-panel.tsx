"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Eye, FileText, Pencil, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MAPPING_GROUPS = [
  { title: "Core", fields: ["record_type", "account_key"] },
  { title: "Account rows", fields: ["account_type", "institution", "account_nickname", "market_value_cad", "contribution_room_cad"] },
  { title: "Holding rows", fields: ["symbol", "name", "asset_class", "sector", "weight_pct", "gain_loss_pct"] },
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
      market_value_cad: "value_cad",
      contribution_room_cad: "room_left",
      symbol: "ticker",
      name: "security_name",
      asset_class: "asset_bucket",
      sector: "bucket_sector",
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
      market_value_cad: "market_value",
      contribution_room_cad: "remaining_room",
      symbol: "symbol",
      name: "security_name",
      asset_class: "asset_class",
      sector: "sector_name",
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

export function ImportJobPanel({
  latestJob
}: {
  latestJob: { status: string; fileName: string; createdAt: string } | null;
}) {
  const router = useRouter();
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
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  useEffect(() => {
    fetch("/api/import/presets")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load presets.")))
      .then((payload) => setServerPresets(payload.data ?? []))
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
    const label = window.prompt("Preset name");
    if (!label?.trim()) {
      return;
    }

    const mapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));
    const response = await fetch("/api/import/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: label.trim(), sourceType: "csv", mapping })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Failed to save preset." });
      return;
    }

    setServerPresets((current) => {
      const next = [...current.filter((preset) => preset.id !== payload.data.id), payload.data];
      return next;
    });
    setSelectedPresetKey(payload.data.id);
    setStatus({ type: "success", message: `Saved mapping preset "${payload.data.name}".` });
  }

  async function renameSelectedPreset() {
    if (!selectedServerPreset) {
      return;
    }

    const nextName = window.prompt("Rename preset", selectedServerPreset.name);
    if (!nextName?.trim() || nextName.trim() === selectedServerPreset.name) {
      return;
    }

    const response = await fetch(`/api/import/presets/${selectedServerPreset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName.trim() })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Failed to rename preset." });
      return;
    }

    setServerPresets((current) => current.map((preset) => preset.id === selectedServerPreset.id ? payload.data : preset));
    setStatus({ type: "success", message: `Renamed preset to "${payload.data.name}".` });
  }

  async function deleteSelectedPreset() {
    if (!selectedServerPreset) {
      return;
    }

    const confirmed = window.confirm(`Delete preset "${selectedServerPreset.name}"?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/import/presets/${selectedServerPreset.id}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Failed to delete preset." });
      return;
    }

    setServerPresets((current) => current.filter((preset) => preset.id !== selectedServerPreset.id));
    setSelectedPresetKey("auto-detect");
    applyPreset("auto-detect");
    setStatus({ type: "success", message: `Deleted preset "${selectedServerPreset.name}".` });
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
      setStatus({ type: "idle", message: "" });
      applyPreset(selectedPresetKey === "canonical" ? "auto-detect" : selectedPresetKey, nextHeaders);
    } catch {
      setStatus({ type: "error", message: "Failed to read the selected CSV file." });
    }
  }

  async function runValidation() {
    setStatus({ type: "idle", message: "" });
    setValidationErrors([]);
    setReviewState(null);

    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));

    const response = await fetch("/api/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        sourceType: "csv",
        csvContent: csvContent || undefined,
        fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
        importMode,
        dryRun: true
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Validation failed." });
      return;
    }

    const result = payload.data as ReviewState;
    setValidationErrors(result.validationErrors ?? []);
    setReviewState(result);
    if ((result.validationErrors ?? []).length > 0) {
      setStatus({ type: "error", message: `Validation failed. ${result.validationErrors.length} row issues were found.` });
      return;
    }
    setStatus({ type: "success", message: "Validation passed. Review the import summary below, then confirm." });
  }

  function confirmImport() {
    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          sourceType: "csv",
          csvContent: csvContent || undefined,
          fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
          importMode,
          dryRun: false
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Failed to import CSV." });
        return;
      }

      const result = payload.data;
      const recommendationMessage = result.autoRecommendationRun
        ? ` Auto-refreshed recommendation run for ${Number(result.autoRecommendationRun.contributionAmountCad).toLocaleString("en-CA")} CAD.`
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
          <p className="font-semibold">Direct CSV import</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Bulk import is a two-step flow: validate and review first, then confirm the database write.
          </p>
        </div>
        {latestJob ? <Badge variant="neutral">Latest: {latestJob.status}</Badge> : <Badge variant="warning">No job yet</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">CSV file name</span>
          <input
            type="text"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">Import mode</span>
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as "replace" | "merge")}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="replace">Replace all current imported data</option>
            <option value="merge">Merge into existing accounts, holdings, and transactions</option>
          </select>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">CSV upload</span>
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
          Local CSV template
        </div>
        <p className="mt-2">
          Use <code>record_type</code> rows for <code>account</code>, <code>holding</code>, and <code>transaction</code>. Download the starter template at{" "}
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
              <p className="font-medium">Field mapping presets</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedServerPreset ? (
                <>
                  <Button type="button" variant="secondary" leadingIcon={<Pencil className="h-4 w-4" />} onClick={renameSelectedPreset}>
                    Rename preset
                  </Button>
                  <Button type="button" variant="secondary" leadingIcon={<Trash2 className="h-4 w-4" />} onClick={deleteSelectedPreset}>
                    Delete preset
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} onClick={saveCurrentPreset}>
                Save current preset
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Preset</span>
              <select
                value={selectedPresetKey}
                onChange={(event) => applyPreset(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="auto-detect">Auto-detect from headers</option>
                {presetOptions.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Badge variant="neutral">{headers.length} headers detected</Badge>
            </div>
          </div>

          {MAPPING_GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{group.title}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.fields.map((field) => (
                  <label key={field} className="space-y-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">{field}</span>
                    <select
                      value={fieldMapping[field] ?? ""}
                      onChange={(event) => setFieldMapping((current) => ({ ...current, [field]: event.target.value }))}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Not mapped</option>
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
              Required mappings missing: {missingRequiredMappings.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview.headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="font-medium">CSV preview</p>
            <Badge variant="neutral">First {preview.rows.length} rows</Badge>
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
          <div className="flex items-center gap-2 font-medium text-[#21613f]">
            <CheckCircle2 className="h-4 w-4" />
            Review before import
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm text-[#21613f]">
            <div>Accounts: {reviewState.summary.accountsImported}</div>
            <div>Holdings: {reviewState.summary.holdingsImported}</div>
            <div>Transactions: {reviewState.summary.transactionsImported}</div>
            <div>Rows parsed: {reviewState.review.rowCount}</div>
          </div>
          <p className="text-sm text-[#21613f]">
            Mode: {reviewState.review.importMode}. Validation passed. Confirm to write these changes into the current signed-in user&apos;s database records.
          </p>
          <Button type="button" onClick={confirmImport} disabled={isPending} leadingIcon={<Upload className="h-4 w-4" />}>
            {isPending ? "Importing..." : "Confirm import"}
          </Button>
        </div>
      ) : null}

      {latestJob ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">Latest job: {latestJob.fileName}</p>
      ) : null}

      {status.type !== "idle" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          {status.message}
        </div>
      ) : null}

      {validationErrors.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#e7b0b8] bg-[#fff8f9] p-4">
          <div className="flex items-center gap-2 font-medium text-[#8e2433]">
            <AlertTriangle className="h-4 w-4" />
            Import validation issues
          </div>
          <div className="space-y-2">
            {validationErrors.slice(0, 12).map((error) => (
              <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl border border-[#f0c9d0] bg-white px-3 py-2 text-sm text-[#8e2433]">
                Row {error.rowNumber}{error.recordType ? ` (${error.recordType})` : ""}: {error.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={runValidation}
        disabled={isPending || !csvContent || missingRequiredMappings.length > 0}
        leadingIcon={<Upload className="h-4 w-4" />}
      >
        Validate and review import
      </Button>
    </div>
  );
}
