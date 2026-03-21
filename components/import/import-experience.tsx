
"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  FolderInput,
  LoaderCircle,
  PencilLine,
  Search,
  Save,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import { ImportJobPanel } from "@/components/import/import-job-panel";
import { SpendingImportPanel } from "@/components/import/spending-import-panel";
import { WorkflowOptionCard } from "@/components/import/workflow-option-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoRow } from "@/components/ui/info-row";
import { extractCsvHeaders, previewCsvContent, type ImportFieldMapping } from "@/lib/backend/csv-import";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";

type ImportMode = "guided" | "direct";
type ImportWorkflowView = "portfolio" | "spending";
type GuidedMethod = "single-account-csv" | "manual-entry" | "continue-later";
type GuidedAccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable";
type SupportedCurrency = "CAD" | "USD";

type GuidedImportResult = {
  account: {
    id: string;
    institution: string;
    type: GuidedAccountType;
    nickname: string;
    currency: SupportedCurrency;
    marketValueAmount: number;
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

type ExistingAccountOption = {
  id: string;
  type: string;
  institution: string;
  nickname: string;
  currency: SupportedCurrency;
  contributionRoomCad: number | null;
  marketValueAmount: number;
  marketValueCad: number;
};

type ManualHoldingDraft = {
  id: string;
  searchQuery: string;
  symbol: string;
  holdingName: string;
  assetClass: (typeof ASSET_CLASS_OPTIONS)[number];
  sector: string;
  currency: SupportedCurrency;
  quantity: string;
  avgCostPerShareAmount: string;
  currentPriceAmount: string;
  overrideMarketValueAmount: string;
};

type MarketDataSearchResult = {
  symbol: string;
  name: string;
  exchange?: string | null;
  country?: string | null;
  currency?: string | null;
  type: string;
  provider: string;
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
  { title: "Account rows", fields: ["account_type", "institution", "account_nickname", "account_currency", "market_value", "contribution_room_cad"] },
  { title: "Holding rows", fields: ["symbol", "name", "asset_class", "sector", "holding_currency", "quantity", "avg_cost_per_share", "cost_basis", "last_price", "market_value", "weight_pct", "gain_loss_pct"] },
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
  return formatAmount(value, "CAD");
}

function formatAmount(value: number, currency: SupportedCurrency) {
  return Number(value || 0).toLocaleString(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });
}

function normalizeSupportedCurrency(value?: string | null): SupportedCurrency {
  return value === "USD" ? "USD" : "CAD";
}

function createManualHoldingDraft(): ManualHoldingDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    searchQuery: "",
    symbol: "",
    holdingName: "",
    assetClass: "Canadian Equity",
    sector: "Multi-sector",
    currency: "CAD",
    quantity: "",
    avgCostPerShareAmount: "",
    currentPriceAmount: "",
    overrideMarketValueAmount: ""
  };
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not enough data";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getManualHoldingDerivedMetrics(holding: ManualHoldingDraft) {
  const quantity = Number(holding.quantity) || 0;
  const avgCostPerShareAmount = Number(holding.avgCostPerShareAmount) || 0;
  const currentPriceAmount = Number(holding.currentPriceAmount) || 0;
  const explicitMarketValueAmount = Number(holding.overrideMarketValueAmount) || 0;

  const costBasisAmount = quantity > 0 && avgCostPerShareAmount > 0 ? quantity * avgCostPerShareAmount : 0;
  const computedMarketValueAmount = explicitMarketValueAmount > 0
    ? explicitMarketValueAmount
    : quantity > 0 && currentPriceAmount > 0
      ? quantity * currentPriceAmount
      : 0;

  const gainLossPct = costBasisAmount > 0 && computedMarketValueAmount > 0
    ? ((computedMarketValueAmount - costBasisAmount) / costBasisAmount) * 100
    : null;

  return {
    costBasisAmount,
    computedMarketValueAmount,
    gainLossPct
  };
}

export function ImportExperience({
  latestPortfolioJob,
  latestSpendingJob,
  portfolioSteps,
  portfolioSuccessStates,
  spendingSuccessStates,
  existingAccounts
}: {
  latestPortfolioJob: { status: string; fileName: string; createdAt: string } | null;
  latestSpendingJob: { status: string; fileName: string; createdAt: string } | null;
  portfolioSteps: { title: string; description: string }[];
  portfolioSuccessStates: string[];
  spendingSuccessStates: string[];
  existingAccounts: ExistingAccountOption[];
}) {
  const [workflowView, setWorkflowView] = useState<ImportWorkflowView>("portfolio");
  const [mode, setMode] = useState<ImportMode>("guided");
  const [currentStep, setCurrentStep] = useState(1);
  const [accountType, setAccountType] = useState<GuidedAccountType | null>(null);
  const [method, setMethod] = useState<GuidedMethod | null>(null);
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [selectedExistingAccountId, setSelectedExistingAccountId] = useState("");
  const [accountCurrency, setAccountCurrency] = useState<SupportedCurrency>("CAD");
  const [institution, setInstitution] = useState("");
  const [nickname, setNickname] = useState("");
  const [contributionRoomCad, setContributionRoomCad] = useState("0");
  const [initialMarketValueAmount, setInitialMarketValueAmount] = useState("0");
  const [manualHoldings, setManualHoldings] = useState<ManualHoldingDraft[]>([createManualHoldingDraft()]);
  const [guidedResult, setGuidedResult] = useState<GuidedImportResult | null>(null);
  const [guidedCsvFileName, setGuidedCsvFileName] = useState("single-account.csv");
  const [guidedCsvContent, setGuidedCsvContent] = useState("");
  const [guidedCsvHeaders, setGuidedCsvHeaders] = useState<string[]>([]);
  const [guidedCsvFieldMapping, setGuidedCsvFieldMapping] = useState<Record<string, string>>({});
  const [guidedCsvSelectedPresetKey, setGuidedCsvSelectedPresetKey] = useState("canonical");
  const [guidedCsvServerPresets, setGuidedCsvServerPresets] = useState<PresetRecord[]>([]);
  const [guidedCsvReviewState, setGuidedCsvReviewState] = useState<GuidedCsvReviewState | null>(null);
  const [guidedCsvImportResult, setGuidedCsvImportResult] = useState<GuidedCsvImportResult | null>(null);
  const [manualHoldingSuggestions, setManualHoldingSuggestions] = useState<Record<string, MarketDataSearchResult[]>>({});
  const [manualHoldingStatus, setManualHoldingStatus] = useState<Record<string, { searchLoading?: boolean; quoteLoading?: boolean; message?: string; error?: string }>>({});
  const [guidedStatus, setGuidedStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [isPending, startTransition] = useTransition();

  const parsedContributionRoom = Number(contributionRoomCad) || 0;
  const parsedInitialMarketValue = Number(initialMarketValueAmount) || 0;
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
  const matchingExistingAccounts = useMemo(
    () => existingAccounts.filter((account) => !accountType || account.type === accountType),
    [existingAccounts, accountType]
  );
  const manualHoldingsAreValid = useMemo(() => manualHoldings.every((holding) => {
    const hasIdentity = holding.symbol.trim().length > 0 && holding.assetClass.length > 0;
    const hasUsableValue = getManualHoldingDerivedMetrics(holding).computedMarketValueAmount > 0;
    return hasIdentity && hasUsableValue;
  }), [manualHoldings]);

  useEffect(() => {
    fetch("/api/import/presets")
      .then(async (response) => {
        const payload = await safeJson(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Failed to load presets."));
        }
        return assertApiData<PresetRecord[]>(payload, Array.isArray, "Preset load succeeded but returned no usable preset list.");
      })
      .then((presets) => setGuidedCsvServerPresets(presets))
      .catch(() => setGuidedCsvServerPresets([]));
  }, []);

  useEffect(() => {
    if (accountMode !== "existing" || !selectedExistingAccountId) {
      return;
    }
    const selected = existingAccounts.find((account) => account.id === selectedExistingAccountId);
    if (!selected) {
      return;
    }
    setInstitution(selected.institution);
    setNickname(selected.nickname);
    setAccountCurrency(selected.currency);
    setContributionRoomCad(String(selected.contributionRoomCad ?? 0));
    setInitialMarketValueAmount(String(selected.marketValueAmount ?? selected.marketValueCad ?? 0));
  }, [accountMode, existingAccounts, selectedExistingAccountId]);

  function updateManualHolding(id: string, patch: Partial<ManualHoldingDraft>) {
    setManualHoldings((current) => current.map((holding) => holding.id === id ? { ...holding, ...patch } : holding));
  }

  function addManualHolding() {
    setManualHoldings((current) => [...current, createManualHoldingDraft()]);
  }

  function removeManualHolding(id: string) {
    setManualHoldings((current) => current.length > 1 ? current.filter((holding) => holding.id !== id) : current);
    setManualHoldingSuggestions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setManualHoldingStatus((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function searchManualHolding(id: string) {
    const holding = manualHoldings.find((item) => item.id === id);
    if (!holding) {
      return;
    }

    const query = holding.searchQuery.trim() || holding.symbol.trim() || holding.holdingName.trim();
    if (!query) {
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: { ...current[id], error: "Enter a ticker or security name before searching." }
      }));
      return;
    }

    setManualHoldingStatus((current) => ({
      ...current,
      [id]: { ...current[id], searchLoading: true, error: "", message: "" }
    }));

    try {
      const response = await fetch(`/api/market-data/search?query=${encodeURIComponent(query)}`);
      const payload = await safeJson(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Security search failed."));
      }

      const data = assertApiData<{ results?: MarketDataSearchResult[] }>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null,
        "Security search succeeded but returned no usable search payload."
      );
      const results = Array.isArray(data.results) ? data.results : [];
      setManualHoldingSuggestions((current) => ({ ...current, [id]: results }));
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          searchLoading: false,
          error: results.length === 0 ? "No matching securities found." : "",
          message: results.length > 0 ? `Found ${results.length} candidates.` : ""
        }
      }));
    } catch (error) {
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          searchLoading: false,
          error: error instanceof Error ? error.message : "Security search failed."
        }
      }));
    }
  }

  async function resolveManualHolding(id: string, symbol: string, nextName?: string) {
    setManualHoldingStatus((current) => ({
      ...current,
      [id]: { ...current[id], searchLoading: true, error: "", message: "" }
    }));

    try {
      const response = await fetch(`/api/market-data/resolve?symbol=${encodeURIComponent(symbol)}`);
      const payload = await safeJson(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Security normalization failed."));
      }

      const data = assertApiData<{ result?: { symbol?: string; name?: string; provider?: string; currency?: string | null } }>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null,
        "Security normalization succeeded but returned no usable normalization payload."
      );
      const result = data.result;
      if (!result || typeof result.symbol !== "string" || result.symbol.trim().length === 0) {
        throw new Error("Security normalization returned no usable symbol.");
      }

      const normalizedSymbol = result.symbol.toUpperCase();
      const normalizedCurrency = normalizeSupportedCurrency(result.currency);
      const normalizedName = typeof result.name === "string" && result.name.trim().length > 0
        ? result.name
        : nextName ?? normalizedSymbol;
      const providerLabel = typeof result.provider === "string" && result.provider.trim().length > 0
        ? result.provider
        : "market-data provider";
      updateManualHolding(id, {
        symbol: normalizedSymbol,
        searchQuery: normalizedSymbol,
        holdingName: normalizedName,
        currency: normalizedCurrency
      });
      setManualHoldingSuggestions((current) => ({ ...current, [id]: [] }));
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          searchLoading: false,
          error: "",
          message: `Normalized to ${normalizedSymbol} via ${providerLabel}.`
        }
      }));
    } catch (error) {
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          searchLoading: false,
          error: error instanceof Error ? error.message : "Security normalization failed."
        }
      }));
    }
  }

  async function fetchManualHoldingQuote(id: string) {
    const holding = manualHoldings.find((item) => item.id === id);
    if (!holding?.symbol.trim()) {
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: { ...current[id], error: "Pick or enter a normalized symbol before fetching a quote." }
      }));
      return;
    }

    setManualHoldingStatus((current) => ({
      ...current,
      [id]: { ...current[id], quoteLoading: true, error: "", message: "" }
    }));

    try {
      const response = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(holding.symbol.trim())}`);
      const payload = await safeJson(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Quote lookup failed."));
      }

      const data = assertApiData<{ result?: { price?: number; provider?: string; delayed?: boolean; currency?: string | null } }>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null,
        "Quote lookup succeeded but returned no usable quote payload."
      );
      const quote = data.result;
      if (!quote || typeof quote !== "object") {
        throw new Error("Quote provider returned no quote payload for this symbol.");
      }

      const nextPrice = Number(quote.price);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        throw new Error("Provider returned no usable price for this symbol.");
      }

      const providerLabel = typeof quote.provider === "string" && quote.provider.trim().length > 0
        ? quote.provider
        : "market-data provider";
      const delayedSuffix = quote.delayed === true ? " (delayed)" : "";
      updateManualHolding(id, {
        currentPriceAmount: nextPrice.toFixed(2),
        currency: normalizeSupportedCurrency(quote.currency)
      });
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          quoteLoading: false,
          error: "",
          message: `Fetched ${providerLabel} quote at ${formatAmount(nextPrice, normalizeSupportedCurrency(quote.currency))}${delayedSuffix}.`
        }
      }));
    } catch (error) {
      setManualHoldingStatus((current) => ({
        ...current,
        [id]: {
          ...current[id],
          quoteLoading: false,
          error: error instanceof Error ? error.message : "Quote lookup failed."
        }
      }));
    }
  }

  const canAdvance = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(accountType);
    }

    if (currentStep === 2) {
      return Boolean(method);
    }

    if (currentStep === 3) {
      const hasBaseFields = institution.trim().length > 1 && nickname.trim().length > 1;
      const hasValidAccountSelection = accountMode === "new" || selectedExistingAccountId.length > 0;
      if (!hasBaseFields || !method) {
        return false;
      }
      if (!hasValidAccountSelection) {
        return false;
      }

      if (method === "single-account-csv") {
        return guidedCsvContent.length > 0 && guidedCsvMissingRequiredMappings.length === 0;
      }

      if (method === "manual-entry") {
        return manualHoldings.length > 0 && manualHoldingsAreValid;
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
    currentStep,
    institution,
    isPending,
    method,
    nickname,
    guidedCsvContent,
    guidedCsvMissingRequiredMappings.length,
    guidedCsvReviewState,
    accountMode,
    selectedExistingAccountId,
    manualHoldings,
    manualHoldingsAreValid
  ]);

  const reviewActions = useMemo(() => {
    if (!accountType || !method) {
      return [];
    }

    const actions = [accountMode === "existing"
      ? `Update existing ${accountType} account at ${institution || "selected institution"}`
      : `Create ${accountType} account at ${institution || "selected institution"}`];
    if (method === "manual-entry") {
      actions.push(`Upsert ${manualHoldings.length} holdings into the selected account`);
    } else {
      actions.push("Create a draft import job for later CSV completion");
    }
    if (parsedInitialMarketValue > 0 || method === "manual-entry") {
      actions.push("Recompute a baseline recommendation run after the account write");
    }
    return actions;
  }, [accountMode, accountType, institution, method, parsedInitialMarketValue, manualHoldings.length]);

  function resetGuidedState(nextMode?: ImportMode) {
    if (nextMode) {
      setMode(nextMode);
    }
    setCurrentStep(1);
    setAccountType(null);
    setMethod(null);
    setAccountMode("new");
    setSelectedExistingAccountId("");
    setAccountCurrency("CAD");
    setInstitution("");
    setNickname("");
    setContributionRoomCad("0");
    setInitialMarketValueAmount("0");
    setManualHoldings([createManualHoldingDraft()]);
    setManualHoldingSuggestions({});
    setManualHoldingStatus({});
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
    const payload = await safeJson(response);
    if (!response.ok) {
      setGuidedStatus({ type: "error", message: getApiErrorMessage(payload, "Failed to save guided preset.") });
      return;
    }

    let savedPreset: PresetRecord;
    try {
      savedPreset = assertApiData<PresetRecord>(
        payload,
        (candidate) => typeof candidate === "object" && candidate !== null && "id" in candidate && "name" in candidate,
        "Guided preset save succeeded but returned no usable preset payload."
      );
    } catch (error) {
      setGuidedStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to save guided preset." });
      return;
    }

    setGuidedCsvServerPresets((current) => {
      const next = [...current.filter((preset) => preset.id !== savedPreset.id), savedPreset];
      return next;
    });
    setGuidedCsvSelectedPresetKey(savedPreset.id);
    setGuidedStatus({ type: "success", message: `Saved guided preset "${savedPreset.name}".` });
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

      const payload = await safeJson(response);
      if (!response.ok) {
        setGuidedStatus({ type: "error", message: getApiErrorMessage(payload, "Guided CSV validation failed.") });
        return;
      }

      let result: GuidedCsvReviewState;
      try {
        result = assertApiData<GuidedCsvReviewState>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "review" in candidate && "validationErrors" in candidate,
          "Guided CSV validation succeeded but returned no usable review payload."
        );
      } catch (error) {
        setGuidedStatus({ type: "error", message: error instanceof Error ? error.message : "Guided CSV validation failed." });
        return;
      }
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

        const payload = await safeJson(response);
        if (!response.ok) {
          setGuidedStatus({
            type: "error",
            message: getApiErrorMessage(payload, "Failed to import the guided CSV file.")
          });
          return;
        }

        let result: GuidedCsvImportResult;
        try {
          result = assertApiData<GuidedCsvImportResult>(
            payload,
            (candidate) => typeof candidate === "object" && candidate !== null && "summary" in candidate && "job" in candidate,
            "Guided CSV import succeeded but returned no usable import result."
          );
        } catch (error) {
          setGuidedStatus({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to import the guided CSV file."
          });
          return;
        }
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
          accountMode,
          existingAccountId: accountMode === "existing" ? selectedExistingAccountId : undefined,
          accountType,
          method,
          institution: institution.trim(),
          nickname: nickname.trim(),
          currency: accountCurrency,
          contributionRoomCad: parsedContributionRoom,
          initialMarketValueAmount: parsedInitialMarketValue,
          holdings: method === "manual-entry"
            ? manualHoldings.map((holding) => ({
                symbol: holding.symbol.trim(),
                holdingName: holding.holdingName.trim() || undefined,
                assetClass: holding.assetClass,
                sector: holding.sector.trim() || undefined,
                currency: holding.currency,
                quantity: holding.quantity ? Number(holding.quantity) : null,
                avgCostPerShareAmount: holding.avgCostPerShareAmount ? Number(holding.avgCostPerShareAmount) : null,
                lastPriceAmount: holding.currentPriceAmount ? Number(holding.currentPriceAmount) : null,
                marketValueAmount: getManualHoldingDerivedMetrics(holding).computedMarketValueAmount > 0
                  ? getManualHoldingDerivedMetrics(holding).computedMarketValueAmount
                  : null
              }))
            : []
        })
      });

      const payload = await safeJson(response);
      if (!response.ok) {
        setGuidedStatus({
          type: "error",
          message: getApiErrorMessage(payload, "Failed to save the guided import path.")
        });
        return;
      }

      let result: GuidedImportResult;
      try {
        result = assertApiData<GuidedImportResult>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "account" in candidate,
          "Guided import succeeded but returned no usable account payload."
        );
      } catch (error) {
        setGuidedStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to save the guided import path."
        });
        return;
      }
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
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(246,218,230,0.56),rgba(221,232,255,0.48))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">Loo 的入库向导</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                先决定导入路径，再把宝库整理干净。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                投资标的和消费流水现在是两条独立工作流。这样后续接 broker API、银行流水或聚合器时，不会互相污染。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[color:var(--muted-foreground)]">
              <span className="rounded-full border border-white/60 bg-white/42 px-4 py-2 backdrop-blur-md">Guided onboarding for one-account-at-a-time setup</span>
              <span className="rounded-full border border-white/60 bg-white/42 px-4 py-2 backdrop-blur-md">Bulk CSV import for existing exports</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LooSignal title="Portfolio path" detail="账户、持仓、估值与推荐刷新" />
            <LooSignal title="Spending path" detail="交易流水、分类与现金流" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <WorkflowOptionCard
              title="Portfolio Import"
              badge="Accounts + holdings"
              detail="Use guided onboarding or direct CSV import for investment accounts and holdings. This path is allowed to evolve into broker integrations later."
              active={workflowView === "portfolio"}
              onClick={() => {
                setWorkflowView("portfolio");
                resetGuidedState("guided");
              }}
            />
            <WorkflowOptionCard
              title="Spending Import"
              badge="Transactions"
              detail="Keep spending transactions on their own ingestion path so future bank, card, or aggregator APIs can plug in without changing portfolio import logic."
              active={workflowView === "spending"}
              onClick={() => setWorkflowView("spending")}
            />
          </div>
        </CardContent>
      </Card>

      {workflowView === "portfolio" ? (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio import path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <WorkflowOptionCard
                title="Guided setup"
                badge="Recommended"
                detail="Walk through account type, data source choice, validation, and handoff one step at a time."
                active={mode === "guided"}
                onClick={() => resetGuidedState("guided")}
              />
              <WorkflowOptionCard
                title="Direct CSV import"
                badge="Bulk"
                detail="Best when your broker export already contains account and holding data and you want to validate it in one pass."
                active={mode === "direct"}
                onClick={() => setMode("direct")}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {workflowView === "portfolio" && mode === "guided" ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-5">
            {portfolioSteps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = currentStep === stepNumber;
              const isComplete = currentStep > stepNumber;
              return (
                <button
                  type="button"
                  key={step.title}
                  onClick={() => !isPending && setCurrentStep(stepNumber)}
                  className={`rounded-[24px] border px-5 py-5 text-left transition-colors backdrop-blur-md ${isActive ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]" : "border-white/55 bg-white/36"} ${isComplete ? "shadow-[var(--shadow-card)]" : ""}`}
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
                <CardTitle>{portfolioSteps[currentStep - 1]?.title}</CardTitle>
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
                    accountMode={accountMode}
                    selectedExistingAccountId={selectedExistingAccountId}
                    existingAccounts={matchingExistingAccounts}
                    accountCurrency={accountCurrency}
                    institution={institution}
                    nickname={nickname}
                    contributionRoomCad={contributionRoomCad}
                    initialMarketValueAmount={initialMarketValueAmount}
                    manualHoldings={manualHoldings}
                    manualHoldingSuggestions={manualHoldingSuggestions}
                    manualHoldingStatus={manualHoldingStatus}
                    onAccountModeChange={setAccountMode}
                    onExistingAccountChange={setSelectedExistingAccountId}
                    onAccountCurrencyChange={setAccountCurrency}
                    onInstitutionChange={setInstitution}
                    onNicknameChange={setNickname}
                    onContributionRoomChange={setContributionRoomCad}
                    onInitialMarketValueChange={setInitialMarketValueAmount}
                    onManualHoldingChange={updateManualHolding}
                    onAddManualHolding={addManualHolding}
                    onRemoveManualHolding={removeManualHolding}
                    onManualHoldingSearch={searchManualHolding}
                    onManualHoldingSuggestionSelect={resolveManualHolding}
                    onManualHoldingQuoteFetch={fetchManualHoldingQuote}
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
                    accountCurrency={accountCurrency}
                    contributionRoomCad={parsedContributionRoom}
                    initialMarketValueAmount={parsedInitialMarketValue}
                    accountMode={accountMode}
                    selectedExistingAccount={matchingExistingAccounts.find((account) => account.id === selectedExistingAccountId) ?? null}
                    manualHoldings={manualHoldings}
                    latestJob={latestPortfolioJob}
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
                  text={portfolioSuccessStates[0]}
                />
                <InfoRow
                  icon={<ShieldAlert className="mt-0.5 h-4 w-4 text-[color:var(--warning)]" />}
                  text="Step 4 is now a real review and confirm state. Step 5 reflects what was actually written for the signed-in user."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {workflowView === "portfolio" && mode === "direct" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Direct CSV import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-dashed border-white/60 bg-white/34 p-5 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">When to use this</p>
                <p className="mt-2 text-lg font-semibold">One file, many accounts</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  Use this path when your broker export already contains account and holding data and you want to validate, preview, map, and import everything in one pass.
                </p>
              </div>
              <ImportJobPanel latestJob={latestPortfolioJob} workflow="portfolio" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Direct import notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow
                icon={<Database className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
                text="Holding valuation rule: if a CSV row includes market_value, that explicit total value is used and overrides any derived value from quantity x last_price."
              />
              {portfolioSuccessStates.map((item) => (
                <InfoRow key={item} icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />} text={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {workflowView === "spending" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Spending import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-dashed border-white/60 bg-white/34 p-5 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">When to use this</p>
                <p className="mt-2 text-lg font-semibold">Transaction-first import</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  Use this path for spending and cash-flow records only. It keeps transaction ingestion separate from portfolio ingestion and leaves a clean boundary for future bank or card APIs.
                </p>
              </div>
              <SpendingImportPanel latestJob={latestSpendingJob} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending import notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spendingSuccessStates.map((item) => (
                <InfoRow key={item} icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />} text={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
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
  accountMode: "new" | "existing";
  selectedExistingAccountId: string;
  existingAccounts: ExistingAccountOption[];
  accountCurrency: SupportedCurrency;
  institution: string;
  nickname: string;
  contributionRoomCad: string;
  initialMarketValueAmount: string;
  manualHoldings: ManualHoldingDraft[];
  manualHoldingSuggestions: Record<string, MarketDataSearchResult[]>;
  manualHoldingStatus: Record<string, { searchLoading?: boolean; quoteLoading?: boolean; message?: string; error?: string }>;
  onAccountModeChange: (value: "new" | "existing") => void;
  onExistingAccountChange: (value: string) => void;
  onAccountCurrencyChange: (value: SupportedCurrency) => void;
  onInstitutionChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onContributionRoomChange: (value: string) => void;
  onInitialMarketValueChange: (value: string) => void;
  onManualHoldingChange: (id: string, patch: Partial<ManualHoldingDraft>) => void;
  onAddManualHolding: () => void;
  onRemoveManualHolding: (id: string) => void;
  onManualHoldingSearch: (id: string) => Promise<void>;
  onManualHoldingSuggestionSelect: (id: string, symbol: string, name?: string) => Promise<void>;
  onManualHoldingQuoteFetch: (id: string) => Promise<void>;
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
    accountMode,
    selectedExistingAccountId,
    existingAccounts,
    accountCurrency,
    institution,
    nickname,
    contributionRoomCad,
    initialMarketValueAmount,
    manualHoldings,
    manualHoldingSuggestions,
    manualHoldingStatus,
    onAccountModeChange,
    onExistingAccountChange,
    onAccountCurrencyChange,
    onInstitutionChange,
    onNicknameChange,
    onContributionRoomChange,
    onInitialMarketValueChange,
    onManualHoldingChange,
    onAddManualHolding,
    onRemoveManualHolding,
    onManualHoldingSearch,
    onManualHoldingSuggestionSelect,
    onManualHoldingQuoteFetch,
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

      <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white p-5">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant={accountMode === "new" ? "primary" : "secondary"} onClick={() => onAccountModeChange("new")}>
            Add a new {accountType ?? "account"}
          </Button>
          <Button
            type="button"
            variant={accountMode === "existing" ? "primary" : "secondary"}
            onClick={() => onAccountModeChange("existing")}
            disabled={existingAccounts.length === 0}
          >
            Use existing {accountType ?? "account"}
          </Button>
        </div>

        {accountMode === "existing" ? (
          <label className="space-y-2">
            <span className="text-sm font-medium">Existing account</span>
            <select
              value={selectedExistingAccountId}
              onChange={(event) => onExistingAccountChange(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="">Select an existing {accountType ?? "account"}</option>
              {existingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname} / {account.institution} / {formatAmount(account.marketValueAmount ?? account.marketValueCad, account.currency)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            <span className="text-sm font-medium">Account currency</span>
            <select
              value={accountCurrency}
              onChange={(event) => onAccountCurrencyChange(normalizeSupportedCurrency(event.target.value))}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
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
            <span className="text-sm font-medium">Current market value ({accountCurrency})</span>
            <input
              type="number"
              min="0"
              value={initialMarketValueAmount}
              onChange={(event) => onInitialMarketValueChange(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              placeholder="Auto-calculated after holdings write"
            />
          </label>
        </div>
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
              Use this when you want to add one or more holdings into a new or existing account. Gain/loss is derived from cost basis and the computed market value. Only use an override when you deliberately want to replace the computed total value.
            </p>
          </div>
          <div className="space-y-4">
            {manualHoldings.map((holding, index) => (
              <div key={holding.id} className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Holding {index + 1}</p>
                  <Button type="button" variant="secondary" onClick={() => onRemoveManualHolding(holding.id)} disabled={manualHoldings.length === 1}>
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium">Security search</span>
                    <div className="flex gap-2">
                      <input value={holding.searchQuery} onChange={(event) => onManualHoldingChange(holding.id, { searchQuery: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="Search by ticker or company name" />
                      <Button type="button" variant="secondary" onClick={() => void onManualHoldingSearch(holding.id)} leadingIcon={manualHoldingStatus[holding.id]?.searchLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}>
                        Search
                      </Button>
                    </div>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Ticker symbol</span>
                    <input value={holding.symbol} onChange={(event) => onManualHoldingChange(holding.id, { symbol: event.target.value.toUpperCase() })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="VFV" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Holding name</span>
                    <input value={holding.holdingName} onChange={(event) => onManualHoldingChange(holding.id, { holdingName: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="Auto-filled from normalization when available" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Asset class</span>
                    <select value={holding.assetClass} onChange={(event) => onManualHoldingChange(holding.id, { assetClass: event.target.value as (typeof ASSET_CLASS_OPTIONS)[number] })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none">
                      {ASSET_CLASS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Sector</span>
                    <input value={holding.sector} onChange={(event) => onManualHoldingChange(holding.id, { sector: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="Multi-sector" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Holding currency</span>
                    <select
                      value={holding.currency}
                      onChange={(event) => onManualHoldingChange(holding.id, { currency: normalizeSupportedCurrency(event.target.value) })}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Shares</span>
                    <input type="number" min="0" value={holding.quantity} onChange={(event) => onManualHoldingChange(holding.id, { quantity: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="10" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Avg cost / share ({holding.currency})</span>
                    <input type="number" min="0" value={holding.avgCostPerShareAmount} onChange={(event) => onManualHoldingChange(holding.id, { avgCostPerShareAmount: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="105.25" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Current price ({holding.currency})</span>
                    <div className="flex gap-2">
                      <input type="number" min="0" value={holding.currentPriceAmount} onChange={(event) => onManualHoldingChange(holding.id, { currentPriceAmount: event.target.value })} className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none" placeholder="Fetch delayed quote or enter manually" />
                      <Button type="button" variant="secondary" onClick={() => void onManualHoldingQuoteFetch(holding.id)} leadingIcon={manualHoldingStatus[holding.id]?.quoteLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}>
                        Quote
                      </Button>
                    </div>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      Per-share or per-unit price. Use this when you know the latest quote.
                    </p>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Current market value ({holding.currency})</span>
                    <input type="number" min="0" value={getManualHoldingDerivedMetrics(holding).computedMarketValueAmount > 0 ? getManualHoldingDerivedMetrics(holding).computedMarketValueAmount.toFixed(2) : ""} readOnly className="w-full rounded-2xl border border-[color:var(--border)] bg-slate-50 px-4 py-3 text-sm outline-none" placeholder="Calculated from shares x current price or override value" />
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      Auto-calculated from shares and current price. If you add an override below, that override becomes the total value used for gain/loss.
                    </p>
                  </label>
                </div>
                <details className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-[color:var(--foreground)]">Advanced: Override total value</summary>
                  <div className="mt-3 space-y-2">
                    <input
                      type="number"
                      min="0"
                      value={holding.overrideMarketValueAmount}
                      onChange={(event) => onManualHoldingChange(holding.id, { overrideMarketValueAmount: event.target.value })}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                      placeholder="Optional override total value"
                    />
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      Leave empty in normal use. Only fill this if you want to override the computed total position value.
                    </p>
                  </div>
                </details>
                {manualHoldingSuggestions[holding.id]?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Search results</p>
                    <div className="space-y-2">
                      {manualHoldingSuggestions[holding.id].slice(0, 5).map((result) => (
                        <button
                          key={`${holding.id}-${result.symbol}-${result.exchange ?? ""}`}
                          type="button"
                          onClick={() => void onManualHoldingSuggestionSelect(holding.id, result.symbol, result.name)}
                          className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-left transition-colors hover:border-[color:var(--primary)]"
                        >
                          <div>
                            <p className="font-medium">{result.symbol} · {result.name}</p>
                            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                              {result.exchange ?? "Unknown exchange"}{result.country ? ` · ${result.country}` : ""}{result.currency ? ` · ${result.currency}` : ""}
                            </p>
                          </div>
                          <Badge variant="neutral">{result.type}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {manualHoldingStatus[holding.id]?.message ? (
                  <div className="rounded-2xl border border-[#b6d7c7] bg-[#eef8f1] px-4 py-3 text-sm text-[#21613f]">
                    {manualHoldingStatus[holding.id]?.message}
                  </div>
                ) : null}
                {manualHoldingStatus[holding.id]?.error ? (
                  <div className="rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-sm text-[#8e2433]">
                    {manualHoldingStatus[holding.id]?.error}
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoRow
                    icon={<Database className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
                    text={`Derived cost basis: ${formatAmount(getManualHoldingDerivedMetrics(holding).costBasisAmount, holding.currency)}`}
                  />
                  <InfoRow
                    icon={<TrendingUp className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
                    text={`Derived market value: ${formatAmount(getManualHoldingDerivedMetrics(holding).computedMarketValueAmount, holding.currency)}`}
                  />
                  <InfoRow
                    icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />}
                    text={`Derived gain/loss: ${formatPercent(getManualHoldingDerivedMetrics(holding).gainLossPct)}`}
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={onAddManualHolding}>
              Add another holding
            </Button>
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
  accountCurrency,
  contributionRoomCad,
  initialMarketValueAmount,
  accountMode,
  selectedExistingAccount,
  manualHoldings,
  latestJob,
  reviewActions,
  guidedCsvReviewState
}: {
  accountType: GuidedAccountType | null;
  method: GuidedMethod | null;
  institution: string;
  nickname: string;
  accountCurrency: SupportedCurrency;
  contributionRoomCad: number;
  initialMarketValueAmount: number;
  accountMode: "new" | "existing";
  selectedExistingAccount: ExistingAccountOption | null;
  manualHoldings: ManualHoldingDraft[];
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
          {accountMode === "existing" && selectedExistingAccount
            ? `Updating existing ${selectedExistingAccount.type} account ${selectedExistingAccount.nickname} at ${selectedExistingAccount.institution}. `
            : `Institution: ${institution || "Not set"}. Nickname: ${nickname || "Not set"}. `}
          Contribution room: {formatCad(contributionRoomCad)}.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InfoRow
          icon={<CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />}
          text={`Current market value baseline: ${formatAmount(initialMarketValueAmount, accountCurrency)}`}
        />
        <InfoRow
          icon={<PencilLine className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />}
          text={method === "manual-entry"
            ? `Manual entry will upsert ${manualHoldings.length} holdings into ${accountMode === "existing" ? "the existing account" : "the new account"}.`
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
        text={latestJob ? `Latest recorded portfolio import: ${latestJob.fileName} (${latestJob.status}).` : "No prior portfolio import job exists yet for this signed-in user."}
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
                Recommendation baseline refreshed for {formatCad(guidedResult.autoRecommendationRun.contributionAmountCad)} in the planning base currency across {guidedResult.autoRecommendationRun.itemCount} items.
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
                Recommendation baseline refreshed for {formatCad(guidedCsvImportResult.autoRecommendationRun.contributionAmountCad)} in the planning base currency across {guidedCsvImportResult.autoRecommendationRun.itemCount} items.
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

function LooSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}


