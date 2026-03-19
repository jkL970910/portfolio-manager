
"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  FolderInput,
  PencilLine,
  Save,
  ShieldAlert
} from "lucide-react";
import { ImportJobPanel } from "@/components/import/import-job-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractCsvHeaders, previewCsvContent, type ImportFieldMapping } from "@/lib/backend/csv-import";

type ImportMode = "guided" | "direct";
type GuidedMethod = "single-account-csv" | "manual-entry" | "continue-later";
type GuidedAccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable";

type GuidedImportResult = {
  account: {
    id: string;
    institution: string;
    type: GuidedAccountType;
    nickname: string;
    marketValueCad: number;
    contributionRoomCad: number | null;
  };
  importJob: {
    id: string;
    status: string;
    fileName: string;
    createdAt: string;
  } | null;
  createdHoldingSymbol: string | null;
  autoRecommendationRun: {
    id: string;
    contributionAmountCad: number;
    itemCount: number;
  } | null;
};

type GuidedCsvReviewState = {
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

type GuidedCsvImportResult = {
  job: {
    id: string;
    fileName: string;
    status: string;
    createdAt: string;
  };
  summary: {
    accountsImported: number;
    holdingsImported: number;
    transactionsImported: number;
  };
  autoRecommendationRun: {
    id: string;
    contributionAmountCad: number;
    itemCount: number;
  } | null;
};

type PresetRecord = {
  id: string;
  name: string;
  sourceType: "csv";
  mapping: Record<string, string>;
};

const ACCOUNT_OPTIONS: Array<{
  type: GuidedAccountType;
  caption: string;
  detail: string;
}> = [
  { type: "TFSA", caption: "Tax-free growth sleeve", detail: "Good default for most first-time users." },
  { type: "RRSP", caption: "Retirement-focused sheltered account", detail: "Useful when long-horizon retirement savings dominate." },
  { type: "FHSA", caption: "Home purchase sleeve", detail: "Use when the near-term housing goal matters." },
  { type: "Taxable", caption: "Flexible capital account", detail: "Use when sheltered room is already consumed." }
];

const METHOD_OPTIONS: Array<{
  value: GuidedMethod;
  title: string;
  detail: string;
}> = [
  {
    value: "single-account-csv",
    title: "Upload one account CSV",
    detail: "Best when you want to onboard one account at a time and inspect each step."
  },
  {
    value: "manual-entry",
    title: "Enter holdings manually",
    detail: "Useful for a small starter portfolio or when the broker export is messy."
  },
  {
    value: "continue-later",
    title: "Skip for now",
    detail: "Capture the account type now and finish the data import later."
  }
];

const ASSET_CLASS_OPTIONS = [
  "Canadian Equity",
  "US Equity",
  "International Equity",
  "Fixed Income",
  "Cash"
] as const;

const GUIDED_MAPPING_GROUPS = [
  { title: "Core", fields: ["record_type", "account_key"] },
  { title: "Account rows", fields: ["account_type", "institution", "account_nickname", "market_value_cad", "contribution_room_cad"] },
  { title: "Holding rows", fields: ["symbol", "name", "asset_class", "sector", "weight_pct", "gain_loss_pct"] },
  { title: "Transaction rows", fields: ["booked_at", "merchant", "category", "amount_cad", "direction"] }
] as const;

const GUIDED_REQUIRED_FIELDS = ["record_type", "account_key"] as const;

const GUIDED_BUILT_IN_PRESETS = [
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

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildDefaultMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  const normalizedIndex = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const group of GUIDED_MAPPING_GROUPS) {
    for (const field of group.fields) {
      mapping[field] = normalizedIndex.get(field) ?? "";
    }
  }
  return mapping;
}

function formatCad(value: number) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  });
}

export function ImportExperience({
  latestJob,
  steps,
  successStates
}: {
  latestJob: { status: string; fileName: string; createdAt: string } | null;
  steps: { title: string; description: string }[];
  successStates: string[];
}) {
  const [mode, setMode] = useState<ImportMode>("guided");
  const [currentStep, setCurrentStep] = useState(1);
  const [accountType, setAccountType] = useState<GuidedAccountType | null>(null);
  const [method, setMethod] = useState<GuidedMethod | null>(null);
  const [institution, setInstitution] = useState("");
  const [nickname, setNickname] = useState("");
  const [contributionRoomCad, setContributionRoomCad] = useState("0");
  const [initialMarketValueCad, setInitialMarketValueCad] = useState("0");
  const [symbol, setSymbol] = useState("");
  const [holdingName, setHoldingName] = useState("");
  const [assetClass, setAssetClass] = useState<(typeof ASSET_CLASS_OPTIONS)[number]>("Canadian Equity");
  const [sector, setSector] = useState("Multi-sector");
  const [gainLossPct, setGainLossPct] = useState("0");
  const [guidedResult, setGuidedResult] = useState<GuidedImportResult | null>(null);
  const [guidedCsvFileName, setGuidedCsvFileName] = useState("single-account.csv");
  const [guidedCsvContent, setGuidedCsvContent] = useState("");
  const [guidedCsvHeaders, setGuidedCsvHeaders] = useState<string[]>([]);
  const [guidedCsvFieldMapping, setGuidedCsvFieldMapping] = useState<Record<string, string>>({});
  const [guidedCsvSelectedPresetKey, setGuidedCsvSelectedPresetKey] = useState("canonical");
  const [guidedCsvServerPresets, setGuidedCsvServerPresets] = useState<PresetRecord[]>([]);
  const [guidedCsvReviewState, setGuidedCsvReviewState] = useState<GuidedCsvReviewState | null>(null);
  const [guidedCsvImportResult, setGuidedCsvImportResult] = useState<GuidedCsvImportResult | null>(null);
  const [guidedStatus, setGuidedStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [isPending, startTransition] = useTransition();

  const parsedContributionRoom = Number(contributionRoomCad) || 0;
  const parsedInitialMarketValue = Number(initialMarketValueCad) || 0;
  const parsedGainLossPct = Number(gainLossPct) || 0;
  const guidedCsvPreview = useMemo(() => previewCsvContent(guidedCsvContent, 10), [guidedCsvContent]);
  const guidedCsvPresetOptions = useMemo(
    () => [
      ...GUIDED_BUILT_IN_PRESETS.map((preset) => ({ key: preset.key, label: preset.label, mapping: preset.mapping })),
      ...guidedCsvServerPresets.map((preset) => ({ key: preset.id, label: preset.name, mapping: preset.mapping }))
    ],
    [guidedCsvServerPresets]
  );
  const guidedCsvMissingRequiredMappings = useMemo(
    () => GUIDED_REQUIRED_FIELDS.filter((field) => !guidedCsvFieldMapping[field]),
    [guidedCsvFieldMapping]
  );

  useEffect(() => {
    fetch("/api/import/presets")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load presets.")))
      .then((payload) => setGuidedCsvServerPresets(payload.data ?? []))
      .catch(() => setGuidedCsvServerPresets([]));
  }, []);

  const canAdvance = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(accountType);
    }

    if (currentStep === 2) {
      return Boolean(method);
    }

    if (currentStep === 3) {
      const hasBaseFields = institution.trim().length > 1 && nickname.trim().length > 1;
      if (!hasBaseFields || !method) {
        return false;
      }

      if (method === "single-account-csv") {
        return guidedCsvContent.length > 0 && guidedCsvMissingRequiredMappings.length === 0;
      }

      if (method === "manual-entry") {
        return symbol.trim().length > 0 && assetClass.length > 0 && parsedInitialMarketValue > 0;
      }

      return true;
    }

    if (currentStep === 4) {
      if (method === "single-account-csv") {
        const reviewState = guidedCsvReviewState;
        return !isPending && reviewState !== null && reviewState.validationErrors.length === 0;
      }
      return !isPending;
    }

    return false;
  }, [
    accountType,
    assetClass,
    currentStep,
    institution,
    isPending,
    method,
    nickname,
    guidedCsvContent,
    guidedCsvMissingRequiredMappings.length,
    guidedCsvReviewState,
    parsedInitialMarketValue,
    symbol
  ]);

  const reviewActions = useMemo(() => {
    if (!accountType || !method) {
      return [];
    }

    const actions = [`Create ${accountType} account at ${institution || "selected institution"}`];
    if (method === "manual-entry") {
      actions.push(`Write starter holding ${symbol.toUpperCase() || "manual holding"} into the account`);
    } else {
      actions.push("Create a draft import job for later CSV completion");
    }
    if (parsedInitialMarketValue > 0 || method === "manual-entry") {
      actions.push("Recompute a baseline recommendation run after the account write");
    }
    return actions;
  }, [accountType, institution, method, parsedInitialMarketValue, symbol]);

  function resetGuidedState(nextMode?: ImportMode) {
    if (nextMode) {
      setMode(nextMode);
    }
    setCurrentStep(1);
    setAccountType(null);
    setMethod(null);
    setInstitution("");
    setNickname("");
    setContributionRoomCad("0");
    setInitialMarketValueCad("0");
    setSymbol("");
    setHoldingName("");
    setAssetClass("Canadian Equity");
    setSector("Multi-sector");
    setGainLossPct("0");
    setGuidedCsvFileName("single-account.csv");
    setGuidedCsvContent("");
    setGuidedCsvHeaders([]);
    setGuidedCsvFieldMapping({});
    setGuidedCsvSelectedPresetKey("canonical");
    setGuidedCsvReviewState(null);
    setGuidedCsvImportResult(null);
    setGuidedResult(null);
    setGuidedStatus({ type: "idle", message: "" });
  }

  function goToPreviousStep() {
    if (currentStep > 1 && !isPending) {
      setCurrentStep((value) => value - 1);
    }
  }

  async function handleGuidedCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setGuidedCsvContent("");
      setGuidedCsvHeaders([]);
      setGuidedCsvFieldMapping({});
      setGuidedCsvReviewState(null);
      return;
    }

    try {
      const text = await selectedFile.text();
      const nextHeaders = extractCsvHeaders(text);
      setGuidedCsvFileName(selectedFile.name);
      setGuidedCsvContent(text);
      setGuidedCsvHeaders(nextHeaders);
      applyGuidedPreset(guidedCsvSelectedPresetKey === "canonical" ? "auto-detect" : guidedCsvSelectedPresetKey, nextHeaders);
      setGuidedCsvReviewState(null);
      setGuidedStatus({ type: "idle", message: "" });
    } catch {
      setGuidedStatus({ type: "error", message: "Failed to read the selected guided CSV file." });
    }
  }

  function applyGuidedPreset(presetKey: string, detectedHeaders = guidedCsvHeaders) {
    setGuidedCsvSelectedPresetKey(presetKey);
    if (presetKey === "auto-detect") {
      setGuidedCsvFieldMapping(buildDefaultMapping(detectedHeaders));
      return;
    }

    const preset = guidedCsvPresetOptions.find((item) => item.key === presetKey);
    if (!preset) {
      return;
    }

    const next = { ...buildDefaultMapping(detectedHeaders) };
    for (const group of GUIDED_MAPPING_GROUPS) {
      for (const field of group.fields) {
        const mappedHeader = preset.mapping[field];
        if (!mappedHeader) {
          continue;
        }
        next[field] = detectedHeaders.find((header) => normalizeHeader(header) === normalizeHeader(mappedHeader)) ?? mappedHeader;
      }
    }
    setGuidedCsvFieldMapping(next);
  }

  async function saveCurrentGuidedPreset() {
    const label = window.prompt("Preset name");
    if (!label?.trim()) {
      return;
    }

    const mapping = Object.fromEntries(Object.entries(guidedCsvFieldMapping).filter(([, value]) => value));
    const response = await fetch("/api/import/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: label.trim(), sourceType: "csv", mapping })
    });
    const payload = await response.json();
    if (!response.ok) {
      setGuidedStatus({ type: "error", message: payload.error ?? "Failed to save guided preset." });
      return;
    }

    setGuidedCsvServerPresets((current) => {
      const next = [...current.filter((preset) => preset.id !== payload.data.id), payload.data];
      return next;
    });
    setGuidedCsvSelectedPresetKey(payload.data.id);
    setGuidedStatus({ type: "success", message: `Saved guided preset "${payload.data.name}".` });
  }

  function updateGuidedCsvFieldMapping(field: string, value: string) {
    setGuidedCsvFieldMapping((current) => ({ ...current, [field]: value }));
    setGuidedCsvReviewState(null);
  }

  function getSanitizedGuidedCsvMapping(): ImportFieldMapping {
    return Object.fromEntries(Object.entries(guidedCsvFieldMapping).filter(([, value]) => value)) as ImportFieldMapping;
  }

  function validateGuidedCsv() {
    if (!guidedCsvContent) {
      return;
    }

    setGuidedStatus({ type: "idle", message: "" });
    setGuidedCsvReviewState(null);

    startTransition(async () => {
      const response = await fetch("/api/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: guidedCsvFileName,
          sourceType: "csv",
          csvContent: guidedCsvContent,
          fieldMapping: getSanitizedGuidedCsvMapping(),
          importMode: "merge",
          dryRun: true
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setGuidedStatus({ type: "error", message: payload.error ?? "Guided CSV validation failed." });
        return;
      }

      const result = payload.data as GuidedCsvReviewState;
      setGuidedCsvReviewState(result);
      setCurrentStep(4);
      setGuidedStatus({
        type: result.validationErrors.length > 0 ? "error" : "success",
        message: result.validationErrors.length > 0
          ? `Guided CSV validation found ${result.validationErrors.length} row issues.`
          : "Guided CSV validation passed. Review and confirm the import."
      });
    });
  }

  function submitGuidedImport() {
    if (!accountType || !method) {
      return;
    }

    if (method === "single-account-csv") {
      if (!guidedCsvContent) {
        return;
      }

      setGuidedStatus({ type: "idle", message: "" });

      startTransition(async () => {
        const response = await fetch("/api/import/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: guidedCsvFileName,
            sourceType: "csv",
            csvContent: guidedCsvContent,
            fieldMapping: getSanitizedGuidedCsvMapping(),
            importMode: "merge",
            dryRun: false
          })
        });

        const payload = await response.json();
        if (!response.ok) {
          setGuidedStatus({
            type: "error",
            message: payload.error ?? "Failed to import the guided CSV file."
          });
          return;
        }

        const result = payload.data as GuidedCsvImportResult;
        setGuidedCsvImportResult(result);
        setGuidedStatus({
          type: "success",
          message: `Imported ${result.summary.accountsImported} accounts, ${result.summary.holdingsImported} holdings, and ${result.summary.transactionsImported} transactions from ${result.job.fileName}.`
        });
        setCurrentStep(5);
      });
      return;
    }

    setGuidedStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/import/guided", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          method,
          institution: institution.trim(),
          nickname: nickname.trim(),
          contributionRoomCad: parsedContributionRoom,
          initialMarketValueCad: parsedInitialMarketValue,
          symbol: symbol.trim() || undefined,
          holdingName: holdingName.trim() || undefined,
          assetClass: method === "manual-entry" ? assetClass : undefined,
          sector: sector.trim() || undefined,
          gainLossPct: parsedGainLossPct
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setGuidedStatus({
          type: "error",
          message: payload.error ?? "Failed to save the guided import path."
        });
        return;
      }

      const result = payload.data as GuidedImportResult;
      setGuidedResult(result);
      setGuidedStatus({
        type: "success",
        message: result.importJob
          ? `Created ${result.account.type} account and draft import job ${result.importJob.fileName}.`
          : `Created ${result.account.type} account${result.createdHoldingSymbol ? ` with holding ${result.createdHoldingSymbol}` : ""}.`
      });
      setCurrentStep(5);
    });
  }

  function goToNextStep() {
    if (!canAdvance) {
      return;
    }

    if (currentStep === 3 && method === "single-account-csv") {
      validateGuidedCsv();
      return;
    }

    if (currentStep === 4) {
      submitGuidedImport();
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((value) => value + 1);
    }
  }

  const continueButtonLabel = currentStep === 4
    ? (isPending ? "Saving..." : "Confirm guided setup")
    : currentStep === 5
      ? "Completed"
      : "Continue";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => resetGuidedState("guided")}
              className={`rounded-[24px] border p-5 text-left transition-colors ${mode === "guided" ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-[color:var(--border)] bg-white"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">Guided setup</p>
                <Badge variant={mode === "guided" ? "primary" : "neutral"}>Recommended</Badge>
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                Walk through account type, data source choice, validation, and handoff one step at a time.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={`rounded-[24px] border p-5 text-left transition-colors ${mode === "direct" ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-[color:var(--border)] bg-white"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">Direct CSV import</p>
                <Badge variant={mode === "direct" ? "primary" : "neutral"}>Bulk</Badge>
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                Best when you already have one CSV containing multiple accounts, holdings, and transactions.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {mode === "guided" ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-5">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = currentStep === stepNumber;
              const isComplete = currentStep > stepNumber;
              return (
                <button
                  type="button"
                  key={step.title}
                  onClick={() => !isPending && setCurrentStep(stepNumber)}
                  className={`rounded-[24px] border bg-white px-5 py-5 text-left transition-colors ${isActive ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-[color:var(--border)]"} ${isComplete ? "shadow-[var(--shadow-card)]" : ""}`}
                >
                  <div className="space-y-3">
                    <Badge variant={isActive ? "primary" : isComplete ? "success" : "neutral"}>
                      Step {stepNumber}
                    </Badge>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>{steps[currentStep - 1]?.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {currentStep === 1 ? (
                  <StepChooseAccountType
                    accountType={accountType}
                    onSelect={(value) => {
                      setAccountType(value);
                      setCurrentStep(2);
                    }}
                  />
                ) : null}

                {currentStep === 2 ? (
                  <StepChooseMethod
                    method={method}
                    onSelect={(value) => {
                      setMethod(value);
                      setCurrentStep(3);
                    }}
                  />
                ) : null}

                {currentStep === 3 ? (
                  <StepProvideSource
                    method={method}
                    accountType={accountType}
                    institution={institution}
                    nickname={nickname}
                    contributionRoomCad={contributionRoomCad}
                    initialMarketValueCad={initialMarketValueCad}
                    symbol={symbol}
                    holdingName={holdingName}
                    assetClass={assetClass}
                    sector={sector}
                    gainLossPct={gainLossPct}
                    onInstitutionChange={setInstitution}
                    onNicknameChange={setNickname}
                    onContributionRoomChange={setContributionRoomCad}
                    onInitialMarketValueChange={setInitialMarketValueCad}
                    onSymbolChange={setSymbol}
                    onHoldingNameChange={setHoldingName}
                    onAssetClassChange={(value) => setAssetClass(value as (typeof ASSET_CLASS_OPTIONS)[number])}
                    onSectorChange={setSector}
                    onGainLossPctChange={setGainLossPct}
                    guidedCsvFileName={guidedCsvFileName}
                    guidedCsvHeaders={guidedCsvHeaders}
                    guidedCsvFieldMapping={guidedCsvFieldMapping}
                    guidedCsvSelectedPresetKey={guidedCsvSelectedPresetKey}
                    guidedCsvPresetOptions={guidedCsvPresetOptions}
                    guidedCsvPreview={guidedCsvPreview}
                    guidedCsvMissingRequiredMappings={guidedCsvMissingRequiredMappings}
                    onGuidedCsvFileChange={handleGuidedCsvFileChange}
                    onGuidedCsvFieldMappingChange={updateGuidedCsvFieldMapping}
                    onGuidedCsvPresetChange={applyGuidedPreset}
                    onSaveGuidedPreset={saveCurrentGuidedPreset}
                  />
                ) : null}

                {currentStep === 4 ? (
                  <StepReviewAndConfirm
                    accountType={accountType}
                    method={method}
                    institution={institution}
                    nickname={nickname}
                    contributionRoomCad={parsedContributionRoom}
                    initialMarketValueCad={parsedInitialMarketValue}
                    symbol={symbol}
                    assetClass={assetClass}
                    latestJob={latestJob}
                    reviewActions={reviewActions}
                    guidedCsvReviewState={guidedCsvReviewState}
                  />
                ) : null}

                {currentStep === 5 ? (
                  <StepCompleteSetup
                    accountType={accountType}
                    method={method}
                    institution={institution}
                    nickname={nickname}
                    guidedResult={guidedResult}
                    guidedCsvImportResult={guidedCsvImportResult}
                  />
                ) : null}

                {guidedStatus.type !== "idle" ? (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${guidedStatus.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
                    {guidedStatus.message}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-between gap-3 border-t border-[color:var(--border)] pt-4">
                  <Button type="button" variant="secondary" onClick={goToPreviousStep} disabled={currentStep === 1 || isPending}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!canAdvance || currentStep === 5 || isPending}
                    trailingIcon={currentStep < 5 ? <ArrowRight className="h-4 w-4" /> : undefined}
                  >
                    {continueButtonLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guided setup notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  icon={<FolderInput className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
                  text="Guided setup is account-first. It helps the user think in account sleeves before thinking in CSV structure."
                />
                <InfoRow
                  icon={<Database className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
                  text="Direct CSV import remains available for one-file broker exports. Guided setup now writes account-level onboarding data to the backend."
                />
                <InfoRow
                  icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />}
                  text={successStates[0]}
                />
                <InfoRow
                  icon={<ShieldAlert className="mt-0.5 h-4 w-4 text-[color:var(--warning)]" />}
                  text="Step 4 is now a real review and confirm state. Step 5 reflects what was actually written for the signed-in user."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Direct CSV import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">When to use this</p>
                <p className="mt-2 text-lg font-semibold">One file, many accounts</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  Use this path when your broker export already contains multiple accounts and you want to validate, preview, map, and import everything in one pass.
                </p>
              </div>
              <ImportJobPanel latestJob={latestJob} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Direct import notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {successStates.map((item) => (
                <InfoRow key={item} icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />} text={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StepChooseAccountType({
  accountType,
  onSelect
}: {
  accountType: GuidedAccountType | null;
  onSelect: (value: GuidedAccountType) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--muted-foreground)]">
        Start by selecting the first account sleeve you want to onboard. This keeps the guided flow narrow and easier for new users.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {ACCOUNT_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type)}
            className={`rounded-[24px] border p-5 text-left transition-colors ${accountType === option.type ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-[color:var(--border)] bg-white"}`}
          >
            <p className="text-lg font-semibold">{option.type}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{option.caption}</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{option.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepChooseMethod({
  method,
  onSelect
}: {
  method: GuidedMethod | null;
  onSelect: (value: GuidedMethod) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--muted-foreground)]">
        Decide whether this account should come from a single-account CSV, be entered manually, or be skipped and completed later.
      </p>
      <div className="grid gap-3">
        {METHOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`rounded-[24px] border p-5 text-left transition-colors ${method === option.value ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-[color:var(--border)] bg-white"}`}
          >
            <p className="text-lg font-semibold">{option.title}</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{option.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepProvideSource(props: {
  method: GuidedMethod | null;
  accountType: GuidedAccountType | null;
  institution: string;
  nickname: string;
  contributionRoomCad: string;
  initialMarketValueCad: string;
  symbol: string;
  holdingName: string;
  assetClass: string;
  sector: string;
  gainLossPct: string;
  onInstitutionChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onContributionRoomChange: (value: string) => void;
  onInitialMarketValueChange: (value: string) => void;
  onSymbolChange: (value: string) => void;
  onHoldingNameChange: (value: string) => void;
  onAssetClassChange: (value: string) => void;
  onSectorChange: (value: string) => void;
  onGainLossPctChange: (value: string) => void;
  guidedCsvFileName: string;
  guidedCsvHeaders: string[];
  guidedCsvFieldMapping: Record<string, string>;
  guidedCsvSelectedPresetKey: string;
  guidedCsvPresetOptions: Array<{ key: string; label: string; mapping: Record<string, string> }>;
  guidedCsvPreview: { headers: string[]; rows: string[][] };
  guidedCsvMissingRequiredMappings: readonly string[];
  onGuidedCsvFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGuidedCsvFieldMappingChange: (field: string, value: string) => void;
  onGuidedCsvPresetChange: (presetKey: string) => void;
  onSaveGuidedPreset: () => void;
}) {
  const {
    method,
    accountType,
    institution,
    nickname,
    contributionRoomCad,
    initialMarketValueCad,
    symbol,
    holdingName,
    assetClass,
    sector,
    gainLossPct,
    onInstitutionChange,
    onNicknameChange,
    onContributionRoomChange,
    onInitialMarketValueChange,
    onSymbolChange,
    onHoldingNameChange,
    onAssetClassChange,
    onSectorChange,
    onGainLossPctChange,
    guidedCsvFileName,
    guidedCsvHeaders,
    guidedCsvFieldMapping,
    guidedCsvSelectedPresetKey,
    guidedCsvPresetOptions,
    guidedCsvPreview,
    guidedCsvMissingRequiredMappings,
    onGuidedCsvFileChange,
    onGuidedCsvFieldMappingChange,
    onGuidedCsvPresetChange,
    onSaveGuidedPreset
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Current setup</p>
        <p className="mt-2 font-semibold">{accountType ?? "No account selected"} / {method ?? "No method selected"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Institution</span>
          <input
            value={institution}
            onChange={(event) => onInstitutionChange(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="Questrade, Wealthsimple, RBC Direct Investing..."
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Account nickname</span>
          <input
            value={nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="Main TFSA, Retirement RRSP..."
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Contribution room (CAD)</span>
          <input
            type="number"
            min="0"
            value={contributionRoomCad}
            onChange={(event) => onContributionRoomChange(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="0"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Current market value (CAD)</span>
          <input
            type="number"
            min="0"
            value={initialMarketValueCad}
            onChange={(event) => onInitialMarketValueChange(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="0"
          />
        </label>
      </div>

      {method === "single-account-csv" ? (
        <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white p-5">
          <div>
            <p className="font-semibold">Single-account CSV path</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              Upload one account-specific CSV, review the parsed rows, then the wizard will run a merge-mode import on confirm.
            </p>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium">CSV upload</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onGuidedCsvFileChange}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-[color:var(--primary)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Selected file: {guidedCsvFileName}
          </p>

          {guidedCsvHeaders.length > 0 ? (
            <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Field mapping</p>
                <Button type="button" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} onClick={onSaveGuidedPreset}>
                  Save current preset
                </Button>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium">Mapping preset</span>
                <select
                  value={guidedCsvSelectedPresetKey}
                  onChange={(event) => onGuidedCsvPresetChange(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="auto-detect">Auto-detect from headers</option>
                  {guidedCsvPresetOptions.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              {GUIDED_MAPPING_GROUPS.map((group) => (
                <div key={group.title} className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{group.title}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.fields.map((field) => (
                      <label key={field} className="space-y-2">
                        <span className="text-sm font-medium">{field}</span>
                        <select
                          value={guidedCsvFieldMapping[field] ?? ""}
                          onChange={(event) => onGuidedCsvFieldMappingChange(field, event.target.value)}
                          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                        >
                          <option value="">Not mapped</option>
                          {guidedCsvHeaders.map((header) => (
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

              {guidedCsvMissingRequiredMappings.length > 0 ? (
                <div className="rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-sm text-[#8e2433]">
                  Required mappings missing: {guidedCsvMissingRequiredMappings.join(", ")}
                </div>
              ) : null}

              {guidedCsvPreview.headers.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-[color:var(--primary)]" />
                    <p className="font-medium">Preview</p>
                    <Badge variant="neutral">First {guidedCsvPreview.rows.length} rows</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[color:var(--card-muted)]">
                        <tr>
                          {guidedCsvPreview.headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-3 py-2 font-medium text-[color:var(--foreground)]">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {guidedCsvPreview.rows.map((row, index) => (
                          <tr key={`guided-preview-${index}`} className="border-t border-[color:var(--border)]">
                            {guidedCsvPreview.headers.map((_, cellIndex) => (
                              <td key={`guided-cell-${index}-${cellIndex}`} className="whitespace-nowrap px-3 py-2 text-[color:var(--muted-foreground)]">
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
            </div>
          ) : null}
        </div>
      ) : null}

      {method === "manual-entry" ? (
        <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white p-5">
          <div>
            <p className="font-semibold">Manual entry path</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              Use this when you want to seed a simple account directly into the database without waiting on a broker export.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Ticker symbol</span>
              <input
                value={symbol}
                onChange={(event) => onSymbolChange(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="VFV"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Holding name</span>
              <input
                value={holdingName}
                onChange={(event) => onHoldingNameChange(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="Vanguard S&P 500 Index ETF"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Asset class</span>
              <select
                value={assetClass}
                onChange={(event) => onAssetClassChange(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              >
                {ASSET_CLASS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Sector</span>
              <input
                value={sector}
                onChange={(event) => onSectorChange(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="Multi-sector"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Gain / loss %</span>
              <input
                type="number"
                value={gainLossPct}
                onChange={(event) => onGainLossPctChange(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="0"
              />
            </label>
          </div>
        </div>
      ) : null}

      {method === "continue-later" ? (
        <div className="rounded-[24px] border border-[color:var(--border)] bg-white p-5">
          <p className="font-semibold">Continue later</p>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            Confirming this path creates the account sleeve and a draft import job so the user can return later without losing context.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StepReviewAndConfirm({
  accountType,
  method,
  institution,
  nickname,
  contributionRoomCad,
  initialMarketValueCad,
  symbol,
  assetClass,
  latestJob,
  reviewActions,
  guidedCsvReviewState
}: {
  accountType: GuidedAccountType | null;
  method: GuidedMethod | null;
  institution: string;
  nickname: string;
  contributionRoomCad: number;
  initialMarketValueCad: number;
  symbol: string;
  assetClass: string;
  latestJob: { status: string; fileName: string; createdAt: string } | null;
  reviewActions: string[];
  guidedCsvReviewState: GuidedCsvReviewState | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Review and confirm</p>
        <p className="mt-2 text-lg font-semibold">{accountType ?? "Unspecified account"} via {method ?? "unspecified method"}</p>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Institution: {institution || "Not set"}. Nickname: {nickname || "Not set"}. Contribution room: {formatCad(contributionRoomCad)}.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InfoRow
          icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />}
          text={`Current market value on create: ${formatCad(initialMarketValueCad)}`}
        />
        <InfoRow
          icon={<PencilLine className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
          text={method === "manual-entry"
            ? `Manual holding will be seeded as ${symbol.toUpperCase() || "ticker"} in ${assetClass}.`
            : "CSV-specific data entry can continue after the account shell is created."}
        />
      </div>

      {method === "single-account-csv" ? (
        <div className="space-y-3 rounded-[24px] border border-[color:var(--border)] bg-white p-5">
          <p className="font-semibold">Guided CSV review</p>
          {guidedCsvReviewState ? (
            <>
              <div className="grid gap-3 md:grid-cols-4 text-sm text-[color:var(--muted-foreground)]">
                <div>Accounts: {guidedCsvReviewState.summary.accountsImported}</div>
                <div>Holdings: {guidedCsvReviewState.summary.holdingsImported}</div>
                <div>Transactions: {guidedCsvReviewState.summary.transactionsImported}</div>
                <div>Rows parsed: {guidedCsvReviewState.review.rowCount}</div>
              </div>
              {guidedCsvReviewState.validationErrors.length > 0 ? (
                <div className="space-y-2">
                  {guidedCsvReviewState.validationErrors.slice(0, 8).map((error) => (
                    <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl border border-[#f0c9d0] bg-[#fff8f9] px-3 py-2 text-sm text-[#8e2433]">
                      Row {error.rowNumber}{error.recordType ? ` (${error.recordType})` : ""}: {error.message}
                    </div>
                  ))}
                </div>
              ) : (
                <InfoRow
                  icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />}
                  text="Validation passed. Confirm will merge this account CSV into the signed-in user's database records."
                />
              )}
            </>
          ) : (
            <InfoRow
              icon={<ShieldAlert className="mt-0.5 h-4 w-4 text-[color:var(--warning)]" />}
              text="No CSV review is available yet. Go back and validate the file first."
            />
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-[24px] border border-[color:var(--border)] bg-white p-5">
          <p className="font-semibold">What will happen on confirm</p>
          <div className="space-y-2">
            {reviewActions.map((action) => (
              <InfoRow key={action} icon={<Database className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />} text={action} />
            ))}
          </div>
        </div>
      )}

      <InfoRow
        icon={<ShieldAlert className="mt-0.5 h-4 w-4 text-[color:var(--warning)]" />}
        text={latestJob ? `Latest recorded import job: ${latestJob.fileName} (${latestJob.status}).` : "No prior import job exists yet for this signed-in user."}
      />
    </div>
  );
}

function StepCompleteSetup({
  accountType,
  method,
  institution,
  nickname,
  guidedResult,
  guidedCsvImportResult
}: {
  accountType: GuidedAccountType | null;
  method: GuidedMethod | null;
  institution: string;
  nickname: string;
  guidedResult: GuidedImportResult | null;
  guidedCsvImportResult: GuidedCsvImportResult | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Wizard summary</p>
        <p className="mt-2 text-lg font-semibold">{accountType ?? "Unspecified account"} via {method ?? "unspecified method"}</p>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {institution ? `Institution: ${institution}. ` : ""}{nickname ? `Nickname: ${nickname}.` : "No nickname set yet."}
        </p>
      </div>

      {guidedResult ? (
        <div className="space-y-3 rounded-[24px] border border-[#b6d7c7] bg-[#eef8f1] p-5 text-sm text-[#21613f]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Guided setup saved
          </div>
          <p>
            Account created: {guidedResult.account.type} at {guidedResult.account.institution} ({guidedResult.account.nickname}).
          </p>
          {guidedResult.createdHoldingSymbol ? (
            <p>Starter holding written: {guidedResult.createdHoldingSymbol}.</p>
          ) : null}
          {guidedResult.importJob ? (
            <p>Draft import job opened: {guidedResult.importJob.fileName}.</p>
          ) : null}
          {guidedResult.autoRecommendationRun ? (
            <p>
              Recommendation baseline refreshed for {formatCad(guidedResult.autoRecommendationRun.contributionAmountCad)} across {guidedResult.autoRecommendationRun.itemCount} items.
            </p>
          ) : null}
        </div>
      ) : null}

      {guidedCsvImportResult ? (
        <div className="space-y-3 rounded-[24px] border border-[#b6d7c7] bg-[#eef8f1] p-5 text-sm text-[#21613f]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Guided CSV import saved
          </div>
          <p>Import job completed: {guidedCsvImportResult.job.fileName}.</p>
          <p>
            Imported {guidedCsvImportResult.summary.accountsImported} accounts, {guidedCsvImportResult.summary.holdingsImported} holdings, and {guidedCsvImportResult.summary.transactionsImported} transactions.
          </p>
          {guidedCsvImportResult.autoRecommendationRun ? (
            <p>
              Recommendation baseline refreshed for {formatCad(guidedCsvImportResult.autoRecommendationRun.contributionAmountCad)} across {guidedCsvImportResult.autoRecommendationRun.itemCount} items.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Button href="/settings" variant="secondary">
          Continue to Investment Preferences
        </Button>
        <Button href="/dashboard" variant="secondary">
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
      {icon}
      {text}
    </div>
  );
}
