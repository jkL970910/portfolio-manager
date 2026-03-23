"use client";

import { ChangeEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractCsvHeaders, previewCsvContent } from "@/lib/backend/csv-import";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { getImportMappingGroupTitle } from "@/lib/i18n/import";
import { DisplayLanguage, pick } from "@/lib/i18n/ui";

const MAPPING_GROUPS = [
  { title: "Core", fields: ["record_type", "account_key"] },
  { title: "Transaction rows", fields: ["booked_at", "merchant", "category", "amount_cad", "direction"] }
] as const;

const REQUIRED_FIELDS = ["record_type"] as const;

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

export function SpendingImportPanel({
  latestJob,
  language = "zh"
}: {
  latestJob: { status: string; fileName: string; createdAt: string } | null;
  language?: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("spending-transactions.csv");
  const [csvContent, setCsvContent] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  const preview = useMemo(() => previewCsvContent(csvContent, 20), [csvContent]);
  const missingRequiredMappings = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !fieldMapping[field]),
    [fieldMapping]
  );
  const mappingGroups = MAPPING_GROUPS.map((group) => ({
    ...group,
    title: getImportMappingGroupTitle(group.title, language)
  }));

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
      const nextHeaders = extractCsvHeaders(text);
      setCsvContent(text);
      setFileName(selectedFile.name);
      setHeaders(nextHeaders);
      setFieldMapping(buildDefaultMapping(nextHeaders));
      setReviewState(null);
      setStatus({ type: "idle", message: "" });
    } catch {
      setStatus({ type: "error", message: pick(language, "è¯»å–æ¶ˆè´¹ CSV æ–‡ä»¶å¤±è´¥ã€‚", "Failed to read the selected spending CSV file.") });
    }
  }

  async function runValidation() {
    setStatus({ type: "idle", message: "" });
    setReviewState(null);

    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));

    const response = await fetch("/api/import/spending/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        sourceType: "csv",
        workflow: "spending",
        csvContent: csvContent || undefined,
        fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
        importMode,
        dryRun: true
      })
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "æ¶ˆè´¹å¯¼å…¥æ ¡éªŒå¤±è´¥ã€‚", "Spending validation failed.")) });
      return;
    }

    let result: ReviewState;
    try {
      result = assertApiData<ReviewState>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "review" in candidate && "validationErrors" in candidate,
        pick(language, "æ ¡éªŒè¯·æ±‚æˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„æ¶ˆè´¹å¯¼å…¥é¢„è§ˆæ•°æ®ã€‚", "Validation succeeded but returned no usable spending review payload.")
      );
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : pick(language, "æ¶ˆè´¹å¯¼å…¥æ ¡éªŒå¤±è´¥ã€‚", "Spending validation failed.") });
      return;
    }
    setReviewState(result);
    if ((result.validationErrors ?? []).length > 0) {
      setStatus({
        type: "error",
        message: pick(
          language,
          `æ ¡éªŒæœªé€šè¿‡ï¼Œå‘çŽ° ${result.validationErrors.length} æ¡äº¤æ˜“æµæ°´é—®é¢˜ã€‚`,
          `Validation failed. ${result.validationErrors.length} transaction-row issues were found.`
        )
      });
      return;
    }
    setStatus({ type: "success", message: pick(language, "æ ¡éªŒé€šè¿‡ï¼Œè¯·å…ˆç¡®è®¤äº¤æ˜“æ•°é‡å’Œé¢„è§ˆç»“æžœï¼Œå†æ‰§è¡Œå†™å…¥ã€‚", "Validation passed. Review transaction counts and confirm the write.") });
  }

  function confirmImport() {
    const sanitizedFieldMapping = Object.fromEntries(Object.entries(fieldMapping).filter(([, value]) => value));
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/import/spending/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          workflow: "spending",
          sourceType: "csv",
          csvContent: csvContent || undefined,
          fieldMapping: csvContent ? sanitizedFieldMapping : undefined,
          importMode,
          dryRun: false
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "å¯¼å…¥æ¶ˆè´¹ CSV å¤±è´¥ã€‚", "Failed to import spending CSV.")) });
        return;
      }

      let result: { summary: ReviewState["summary"]; job: { fileName: string } };
      try {
        result = assertApiData(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "job" in candidate,
          pick(language, "å¯¼å…¥æˆåŠŸï¼Œä½†æ²¡æœ‰è¿”å›žå¯ç”¨çš„æ¶ˆè´¹å¯¼å…¥ç»“æžœã€‚", "Import succeeded but returned no usable spending import result.")
        );
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : pick(language, "å¯¼å…¥æ¶ˆè´¹ CSV å¤±è´¥ã€‚", "Failed to import spending CSV.") });
        return;
      }
      const modeLabel = importMode === "replace"
        ? pick(language, "å·²æ›¿æ¢", "replaced")
        : pick(language, "å·²åˆå¹¶", "merged");
      setStatus({
        type: "success",
        message: pick(
          language,
          `${modeLabel} ${result.job.fileName} ä¸­çš„ ${result.summary.transactionsImported} æ¡äº¤æ˜“æµæ°´ã€‚æŠ•èµ„è´¦æˆ·å’ŒæŒä»“ä¸ä¼šè¢«ä¿®æ”¹ã€‚`,
          `${modeLabel} ${result.summary.transactionsImported} transactions from ${result.job.fileName}. Portfolio holdings were left unchanged.`
        )
      });
      setReviewState(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{pick(language, "æ¶ˆè´¹æµæ°´ CSV å¯¼å…¥", "Transaction CSV import")}</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {pick(language, "è¿™æ¡å·¥ä½œæµåªå¯¼å…¥æ¶ˆè´¹æµæ°´ã€‚å®ƒä¸ä¼šåˆ›å»ºæŒä»“ï¼Œä¹Ÿä¸ä¼šè¦†ç›–æŠ•èµ„è´¦æˆ·ã€‚", "This workflow imports spending records only. It does not create holdings and it does not overwrite portfolio accounts.")}
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
            <option value="merge">{pick(language, "åˆå¹¶åˆ°çŽ°æœ‰æµæ°´", "Merge into existing transactions")}</option>
            <option value="replace">{pick(language, "æ›¿æ¢å…¨éƒ¨å·²å¯¼å…¥æµæ°´", "Replace all imported transactions")}</option>
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
          {pick(language, "æ¶ˆè´¹æµæ°´æ¨¡æ¿", "Spending CSV template")}
        </div>
        <p className="mt-2">
          {pick(language, "å¯ä»Žè¿™é‡Œä¸‹è½½èµ·å§‹æ¨¡æ¿ï¼š", "Download the starter template at")}{" "}
          <a href="/templates/spending-import-template.csv" className="font-medium text-[color:var(--primary)] underline">
            /templates/spending-import-template.csv
          </a>.
        </p>
      </div>

      {headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="font-medium">{pick(language, "å­—æ®µæ˜ å°„", "Field mapping")}</p>
            <Badge variant="neutral">{pick(language, `æ£€æµ‹åˆ° ${headers.length} ä¸ªè¡¨å¤´`, `${headers.length} headers detected`)}</Badge>
          </div>
          {mappingGroups.map((group) => (
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
                      <option value="">{pick(language, "æœªæ˜ å°„", "Not mapped")}</option>
                      {headers.map((header) => (
                        <option key={`${field}-${header}`} value={header}>{header}</option>
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
                    <th key={header} className="whitespace-nowrap px-3 py-2 font-medium text-[color:var(--foreground)]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={`spending-preview-${index}`} className="border-t border-[color:var(--border)]">
                    {preview.headers.map((_, cellIndex) => (
                      <td key={`spending-cell-${index}-${cellIndex}`} className="whitespace-nowrap px-3 py-2 text-[color:var(--muted-foreground)]">{row[cellIndex] ?? ""}</td>
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
            {pick(language, "å¯¼å…¥å‰å¤æ ¸", "Review before import")}
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm text-[#21613f]">
            <div>{pick(language, "äº¤æ˜“æµæ°´ï¼š", "Transactions: ")}{reviewState.summary.transactionsImported}</div>
            <div>{pick(language, "è§£æžè¡Œæ•°ï¼š", "Rows parsed: ")}{reviewState.review.rowCount}</div>
            <div>{pick(language, "æ¨¡å¼ï¼š", "Mode: ")}{reviewState.review.importMode}</div>
            <div>{pick(language, "æŒä»“å½±å“ï¼š0", "Holdings touched: 0")}</div>
          </div>
          <p className="text-sm text-[#21613f]">
            {pick(language, "æ ¡éªŒé€šè¿‡ã€‚ç¡®è®¤åŽä¼šæŠŠè¿™äº›æ¶ˆè´¹æµæ°´å†™å…¥å½“å‰ç™»å½•ç”¨æˆ·çš„æ•°æ®åº“è®°å½•ã€‚", "Validation passed. Confirm to write these spending transactions into the current signed-in user's database records.")}
          </p>
          <Button type="button" onClick={confirmImport} disabled={isPending} leadingIcon={<Upload className="h-4 w-4" />}>
            {isPending ? pick(language, "å¯¼å…¥ä¸­...", "Importing...") : pick(language, "ç¡®è®¤å¯¼å…¥æ¶ˆè´¹æµæ°´", "Confirm spending import")}
          </Button>
        </div>
      ) : null}

      {reviewState && reviewState.validationErrors.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#e7b0b8] bg-[#fff8f9] p-4">
          <div className="flex items-center gap-2 font-medium text-[#8e2433]">
            <AlertTriangle className="h-4 w-4" />
            {pick(language, "æ¶ˆè´¹å¯¼å…¥æ ¡éªŒé—®é¢˜", "Spending import validation issues")}
          </div>
          <div className="space-y-2">
            {reviewState.validationErrors.slice(0, 12).map((error) => (
              <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl border border-[#f0c9d0] bg-white px-3 py-2 text-sm text-[#8e2433]">
                {pick(language, "ç¬¬ ", "Row ")}{error.rowNumber}{error.recordType ? ` (${error.recordType})` : ""}: {error.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {latestJob ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "æœ€è¿‘ä¸€æ¬¡æ¶ˆè´¹å¯¼å…¥ï¼š", "Latest spending job: ")}{latestJob.fileName}</p>
      ) : null}

      {status.type !== "idle" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          {status.message}
        </div>
      ) : null}

      <Button
        type="button"
        onClick={runValidation}
        disabled={isPending || !csvContent || missingRequiredMappings.length > 0}
        leadingIcon={<Upload className="h-4 w-4" />}
      >
        {pick(language, "æ ¡éªŒå¹¶å¤æ ¸æ¶ˆè´¹å¯¼å…¥", "Validate and review spending import")}
      </Button>
    </div>
  );
}

