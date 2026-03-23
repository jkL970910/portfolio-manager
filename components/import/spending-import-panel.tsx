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
      setStatus({ type: "error", message: pick(language, "读取消费 CSV 文件失败。", "Failed to read the selected spending CSV file.") });
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
      setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "消费导入校验失败。", "Spending validation failed.")) });
      return;
    }

    let result: ReviewState;
    try {
      result = assertApiData<ReviewState>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "review" in candidate && "validationErrors" in candidate,
        pick(language, "校验请求成功，但没有返回可用的消费导入预览数据。", "Validation succeeded but returned no usable spending review payload.")
      );
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : pick(language, "消费导入校验失败。", "Spending validation failed.") });
      return;
    }
    setReviewState(result);
    if ((result.validationErrors ?? []).length > 0) {
      setStatus({
        type: "error",
        message: pick(
          language,
          `校验未通过，发现 ${result.validationErrors.length} 条交易流水问题。`,
          `Validation failed. ${result.validationErrors.length} transaction-row issues were found.`
        )
      });
      return;
    }
    setStatus({ type: "success", message: pick(language, "校验通过，请先确认交易数量和预览结果，再执行写入。", "Validation passed. Review transaction counts and confirm the write.") });
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
        setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "导入消费 CSV 失败。", "Failed to import spending CSV.")) });
        return;
      }

      let result: { summary: ReviewState["summary"]; job: { fileName: string } };
      try {
        result = assertApiData(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "job" in candidate,
          pick(language, "导入成功，但没有返回可用的消费导入结果。", "Import succeeded but returned no usable spending import result.")
        );
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : pick(language, "导入消费 CSV 失败。", "Failed to import spending CSV.") });
        return;
      }
      const modeLabel = importMode === "replace"
        ? pick(language, "已替换", "replaced")
        : pick(language, "已合并", "merged");
      setStatus({
        type: "success",
        message: pick(
          language,
          `${modeLabel} ${result.job.fileName} 中的 ${result.summary.transactionsImported} 条交易流水。投资账户和持仓不会被修改。`,
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
          <p className="font-semibold">{pick(language, "消费流水 CSV 导入", "Transaction CSV import")}</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {pick(language, "这条工作流只导入消费流水。它不会创建持仓，也不会覆盖投资账户。", "This workflow imports spending records only. It does not create holdings and it does not overwrite portfolio accounts.")}
          </p>
        </div>
        {latestJob
          ? <Badge variant="neutral">{pick(language, "最近一次：", "Latest: ")}{latestJob.status}</Badge>
          : <Badge variant="warning">{pick(language, "还没有导入任务", "No job yet")}</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "CSV 文件名", "CSV file name")}</span>
          <input
            type="text"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "导入模式", "Import mode")}</span>
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as "replace" | "merge")}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="merge">{pick(language, "合并到现有流水", "Merge into existing transactions")}</option>
            <option value="replace">{pick(language, "替换全部已导入流水", "Replace all imported transactions")}</option>
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
          {pick(language, "消费流水模板", "Spending CSV template")}
        </div>
        <p className="mt-2">
          {pick(language, "可从这里下载起始模板：", "Download the starter template at")}{" "}
          <a href="/templates/spending-import-template.csv" className="font-medium text-[color:var(--primary)] underline">
            /templates/spending-import-template.csv
          </a>.
        </p>
      </div>

      {headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="font-medium">{pick(language, "字段映射", "Field mapping")}</p>
            <Badge variant="neutral">{pick(language, `检测到 ${headers.length} 个表头`, `${headers.length} headers detected`)}</Badge>
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
                      <option value="">{pick(language, "未映射", "Not mapped")}</option>
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
              {pick(language, "缺少必填映射：", "Required mappings missing: ")}{missingRequiredMappings.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview.headers.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[color:var(--primary)]" />
            <p className="font-medium">{pick(language, "CSV 预览", "CSV preview")}</p>
            <Badge variant="neutral">{pick(language, `前 ${preview.rows.length} 行`, `First ${preview.rows.length} rows`)}</Badge>
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
            {pick(language, "导入前复核", "Review before import")}
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm text-[#21613f]">
            <div>{pick(language, "交易流水：", "Transactions: ")}{reviewState.summary.transactionsImported}</div>
            <div>{pick(language, "解析行数：", "Rows parsed: ")}{reviewState.review.rowCount}</div>
            <div>{pick(language, "模式：", "Mode: ")}{reviewState.review.importMode}</div>
            <div>{pick(language, "持仓影响：0", "Holdings touched: 0")}</div>
          </div>
          <p className="text-sm text-[#21613f]">
            {pick(language, "校验通过。确认后会把这些消费流水写入当前登录用户的数据库记录。", "Validation passed. Confirm to write these spending transactions into the current signed-in user's database records.")}
          </p>
          <Button type="button" onClick={confirmImport} disabled={isPending} leadingIcon={<Upload className="h-4 w-4" />}>
            {isPending ? pick(language, "导入中...", "Importing...") : pick(language, "确认导入消费流水", "Confirm spending import")}
          </Button>
        </div>
      ) : null}

      {reviewState && reviewState.validationErrors.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#e7b0b8] bg-[#fff8f9] p-4">
          <div className="flex items-center gap-2 font-medium text-[#8e2433]">
            <AlertTriangle className="h-4 w-4" />
            {pick(language, "消费导入校验问题", "Spending import validation issues")}
          </div>
          <div className="space-y-2">
            {reviewState.validationErrors.slice(0, 12).map((error) => (
              <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl border border-[#f0c9d0] bg-white px-3 py-2 text-sm text-[#8e2433]">
                {pick(language, "第 ", "Row ")}{error.rowNumber}{error.recordType ? ` (${error.recordType})` : ""}: {error.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {latestJob ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "最近一次消费导入：", "Latest spending job: ")}{latestJob.fileName}</p>
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
        {pick(language, "校验并复核消费导入", "Validate and review spending import")}
      </Button>
    </div>
  );
}


