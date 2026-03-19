"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, Eye, FileText, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MAPPING_GROUPS = [
  {
    title: "Core",
    fields: ["record_type", "account_key"]
  },
  {
    title: "Account rows",
    fields: ["account_type", "institution", "account_nickname", "market_value_cad", "contribution_room_cad"]
  },
  {
    title: "Holding rows",
    fields: ["symbol", "name", "asset_class", "sector", "weight_pct", "gain_loss_pct"]
  },
  {
    title: "Transaction rows",
    fields: ["booked_at", "merchant", "category", "amount_cad", "direction"]
  }
] as const;

const REQUIRED_FIELDS = ["record_type", "account_key"] as const;
const LOCAL_PRESET_KEY = "portfolio-manager-import-presets";

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
    } satisfies Record<string, string>
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
    } satisfies Record<string, string>
  }
];

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
  if (!firstLine) {
    return [];
  }
  return splitCsvLine(firstLine).map((header) => header.trim()).filter(Boolean);
}

function previewCsvRows(csvContent: string, limit = 20) {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1, limit + 1).map((line) => splitCsvLine(line));
  return { headers, rows };
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

type LocalPreset = {
  key: string;
  label: string;
  mapping: Record<string, string>;
};

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
  const [localPresets, setLocalPresets] = useState<LocalPreset[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ rowNumber: number; recordType: string | null; message: string }>>([]);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_PRESET_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as LocalPreset[];
      setLocalPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLocalPresets([]);
    }
  }, []);

  const preview = useMemo(() => previewCsvRows(csvContent, 20), [csvContent]);
  const presetOptions = [...BUILT_IN_PRESETS, ...localPresets];
  const missingRequiredMappings = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !fieldMapping[field]),
    [fieldMapping]
  );

  function persistLocalPresets(nextPresets: LocalPreset[]) {
    setLocalPresets(nextPresets);
    window.localStorage.setItem(LOCAL_PRESET_KEY, JSON.stringify(nextPresets));
  }

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
    setFieldMapping((current) => {
      const next = { ...current };
      for (const group of MAPPING_GROUPS) {
        for (const field of group.fields) {
          next[field] = preset.mapping[field] ?? "";
        }
      }
      return next;
    });
  }

  function saveCurrentPreset() {
    const label = window.prompt("Preset name");
    if (!label?.trim()) {
      return;
    }
    const preset: LocalPreset = {
      key: `local-${Date.now()}`,
      label: label.trim(),
      mapping: fieldMapping
    };
    const nextPresets = [...localPresets, preset];
    persistLocalPresets(nextPresets);
    setSelectedPresetKey(preset.key);
    setStatus({ type: "success", message: `Saved mapping preset "${preset.label}" to this browser.` });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setCsvContent("");
      setHeaders([]);
      setFieldMapping({});
      return;
    }

    try {
      const text = await selectedFile.text();
      const nextHeaders = extractHeaders(text);
      setCsvContent(text);
      setFileName(selectedFile.name);
      setHeaders(nextHeaders);
      setValidationErrors([]);
      setStatus({ type: "idle", message: "" });

      if (selectedPresetKey && selectedPresetKey !== "canonical") {
        const preset = [...BUILT_IN_PRESETS, ...localPresets].find((item) => item.key === selectedPresetKey);
        if (preset) {
          const nextMapping = { ...buildDefaultMapping(nextHeaders) };
          for (const [field, mappedHeader] of Object.entries(preset.mapping)) {
            nextMapping[field] = nextHeaders.find((header) => normalizeHeader(header) === normalizeHeader(mappedHeader)) ?? mappedHeader;
          }
          setFieldMapping(nextMapping);
          return;
        }
      }

      setFieldMapping(buildDefaultMapping(nextHeaders));
    } catch {
      setStatus({ type: "error", message: "Failed to read the selected CSV file." });
    }
  }

  function createJob() {
    setStatus({ type: "idle", message: "" });
    setValidationErrors([]);

    const sanitizedFieldMapping = Object.fromEntries(
      Object.entries(fieldMapping).filter(([, value]) => value)
    );

    startTransition(async () => {
      const response = await fetch("/api/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          sourceType: "csv",
          csvContent: csvContent || undefined,
          fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
          importMode
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Failed to create import job." });
        return;
      }

      const result = payload.data;
      setValidationErrors(result.validationErrors ?? []);

      if ((result.validationErrors ?? []).length > 0) {
        setStatus({
          type: "error",
          message: `Validation failed. ${result.validationErrors.length} row issues were found. Fix the mapping or CSV values and import again.`
        });
        router.refresh();
        return;
      }

      const summary = result.summary;
      const recommendationMessage = result.autoRecommendationRun
        ? ` Auto-refreshed recommendation run for ${Number(result.autoRecommendationRun.contributionAmountCad).toLocaleString("en-CA")} CAD.`
        : "";
      const modeLabel = importMode === "replace" ? "replaced" : "merged";

      if (summary.accountsImported || summary.holdingsImported || summary.transactionsImported) {
        setStatus({
          type: "success",
          message: `${modeLabel} ${summary.accountsImported} accounts, ${summary.holdingsImported} holdings, and ${summary.transactionsImported} transactions from ${result.job.fileName}.${recommendationMessage}`
        });
      } else {
        setStatus({ type: "success", message: `Import job created for ${result.job.fileName}.` });
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Create import job</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Upload a local CSV, review field mapping, preview the first 20 rows, validate row-level issues, then write user-scoped portfolio data into PostgreSQL.
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

          <p className="text-sm text-[color:var(--muted-foreground)]">
            Map your broker columns to the canonical import fields. Exact-name matches are prefilled when possible.
          </p>
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
            {validationErrors.length > 12 ? (
              <div className="text-sm text-[#8e2433]">Showing first 12 issues out of {validationErrors.length}.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={createJob}
        disabled={isPending || (!!csvContent && missingRequiredMappings.length > 0)}
        leadingIcon={<Upload className="h-4 w-4" />}
      >
        {isPending ? "Importing..." : csvContent ? "Validate, import, and refresh recommendations" : "Create import job"}
      </Button>
    </div>
  );
}
