"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Save } from "lucide-react";
import type { AccountType, GuidedAllocationAnswers, GuidedAllocationDraft, PreferenceProfile } from "@/lib/backend/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const FIELD_CLASS_NAME =
  "w-full rounded-[22px] border border-white/55 bg-white/46 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none backdrop-blur-md focus:border-[color:var(--primary)]";

const RISK_PRESETS: Record<PreferenceProfile["riskProfile"], PreferenceProfile["targetAllocation"]> = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 }
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 }
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 }
  ]
};

type FormState = {
  riskProfile: PreferenceProfile["riskProfile"];
  targetAllocation: PreferenceProfile["targetAllocation"];
  accountFundingPriority: PreferenceProfile["accountFundingPriority"];
  taxAwarePlacement: boolean;
  cashBufferTargetCad: number;
  transitionPreference: PreferenceProfile["transitionPreference"];
  recommendationStrategy: PreferenceProfile["recommendationStrategy"];
  rebalancingTolerancePct: number;
  watchlistSymbols: string;
};

type GuidedDraft = Omit<FormState, "watchlistSymbols"> & {
  assumptions: string[];
  rationale: string[];
  targetMixLabel: string;
};

type ManualSectionId = "strategy" | "allocation" | "priority" | "tax" | "watchlist";

type ManualSectionMeta = {
  id: ManualSectionId;
  title: string;
  description: string;
  badge?: string;
};

const GUIDED_STEP_META = [
  { id: 0, title: "Step 1", label: "Goal & horizon" },
  { id: 1, title: "Step 2", label: "Volatility" },
  { id: 2, title: "Step 3", label: "Engine priority" },
  { id: 3, title: "Step 4", label: "Cash reserve" },
  { id: 4, title: "Step 5", label: "Review draft" }
] as const;

function getTargetMixLabel(targetAllocation: PreferenceProfile["targetAllocation"]) {
  const equity = targetAllocation
    .filter((target) => target.assetClass !== "Fixed Income" && target.assetClass !== "Cash")
    .reduce((sum, target) => sum + target.targetPct, 0);
  const fixedIncome = targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const cash = targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;
  return `${equity} / ${fixedIncome} / ${cash}`;
}

function getDefaultGuidedAnswers(profile: PreferenceProfile): GuidedAllocationAnswers {
  return {
    goal: profile.accountFundingPriority.includes("FHSA") ? "home" : profile.riskProfile === "Growth" ? "wealth" : "retirement",
    horizon: profile.riskProfile === "Growth" ? "long" : profile.riskProfile === "Balanced" ? "medium" : "short",
    volatility: profile.riskProfile === "Growth" ? "high" : profile.riskProfile === "Balanced" ? "medium" : "low",
    priority: profile.taxAwarePlacement ? "tax-efficiency" : profile.transitionPreference === "stay-close" ? "stay-close" : "balanced",
    cashNeed: profile.cashBufferTargetCad >= 15000 ? "high" : profile.cashBufferTargetCad >= 7000 ? "medium" : "low"
  };
}

function buildPriority(goal: GuidedAllocationAnswers["goal"], priority: GuidedAllocationAnswers["priority"]): AccountType[] {
  if (goal === "home") {
    return ["FHSA", "TFSA", "RRSP"];
  }
  if (goal === "retirement") {
    return ["RRSP", "TFSA", "Taxable"];
  }
  if (priority === "tax-efficiency") {
    return ["TFSA", "RRSP", "Taxable"];
  }
  return ["TFSA", "Taxable", "RRSP"];
}

function buildGuidedDraft(answers: GuidedAllocationAnswers): GuidedDraft {
  let score = 0;
  if (answers.horizon === "long") score += 1;
  if (answers.volatility === "high") score += 1;
  if (answers.goal === "wealth" || answers.goal === "retirement") score += 1;
  if (answers.cashNeed === "high") score -= 1;
  if (answers.goal === "capital-preservation") score -= 2;
  if (answers.goal === "home" && answers.horizon === "short") score -= 2;

  const riskProfile: PreferenceProfile["riskProfile"] = score >= 2 ? "Growth" : score <= 0 ? "Conservative" : "Balanced";
  const baseAllocation = RISK_PRESETS[riskProfile].map((target) => ({ ...target }));

  if (answers.goal === "home" || answers.cashNeed === "high") {
    const fixedIncome = baseAllocation.find((target) => target.assetClass === "Fixed Income");
    const cash = baseAllocation.find((target) => target.assetClass === "Cash");
    const usEquity = baseAllocation.find((target) => target.assetClass === "US Equity");
    if (fixedIncome && cash && usEquity) {
      fixedIncome.targetPct += 5;
      cash.targetPct += 5;
      usEquity.targetPct -= 10;
    }
  } else if (answers.volatility === "high" && answers.horizon === "long") {
    const international = baseAllocation.find((target) => target.assetClass === "International Equity");
    const fixedIncome = baseAllocation.find((target) => target.assetClass === "Fixed Income");
    const cash = baseAllocation.find((target) => target.assetClass === "Cash");
    if (international && fixedIncome && cash) {
      international.targetPct += 4;
      fixedIncome.targetPct -= 2;
      cash.targetPct -= 2;
    }
  }

  const transitionPreference: PreferenceProfile["transitionPreference"] = answers.priority === "stay-close"
    ? "stay-close"
    : answers.horizon === "short"
      ? "gradual"
      : "direct";
  const recommendationStrategy: PreferenceProfile["recommendationStrategy"] = answers.priority === "tax-efficiency"
    ? "tax-aware"
    : answers.priority === "stay-close"
      ? "balanced"
      : "target-first";
  const taxAwarePlacement = answers.priority === "tax-efficiency";
  const cashBufferTargetCad = answers.cashNeed === "high" ? 15000 : answers.cashNeed === "medium" ? 8000 : 4000;
  const rebalancingTolerancePct = answers.horizon === "short" ? 8 : answers.volatility === "high" ? 14 : 10;
  const accountFundingPriority = buildPriority(answers.goal, answers.priority);

  const assumptions = [
    `Goal focus: ${answers.goal.replace("-", " ")}`,
    `Time horizon: ${answers.horizon}`,
    `Volatility comfort: ${answers.volatility}`,
    `Cash reserve preference: ${answers.cashNeed}`
  ];

  const rationale = [
    `Risk profile moved to ${riskProfile.toLowerCase()} based on time horizon and drawdown tolerance.`,
    `${taxAwarePlacement ? "Tax efficiency is enabled, so sheltered room gets higher priority." : "Recommendation behavior stays simpler and less tax-driven."}`,
    `Transition mode is ${transitionPreference}, which controls how aggressively the engine moves from current holdings to the target.`
  ];

  return {
    riskProfile,
    targetAllocation: baseAllocation,
    accountFundingPriority,
    taxAwarePlacement,
    cashBufferTargetCad,
    transitionPreference,
    recommendationStrategy,
    rebalancingTolerancePct,
    assumptions,
    rationale,
    targetMixLabel: getTargetMixLabel(baseAllocation)
  };
}

function buildPayload(form: FormState) {
  return {
    riskProfile: form.riskProfile,
    targetAllocation: form.targetAllocation.map((target) => ({
      assetClass: target.assetClass,
      targetPct: Number(target.targetPct)
    })),
    accountFundingPriority: form.accountFundingPriority,
    taxAwarePlacement: form.taxAwarePlacement,
    cashBufferTargetCad: Number(form.cashBufferTargetCad),
    transitionPreference: form.transitionPreference,
    recommendationStrategy: form.recommendationStrategy,
    rebalancingTolerancePct: Number(form.rebalancingTolerancePct),
    watchlistSymbols: form.watchlistSymbols
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
  };
}

function formatDraftSavedAt(value: string | null) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getManualSectionSummary(section: ManualSectionId, form: FormState, currentTargetTotal: number) {
  switch (section) {
    case "strategy":
      return `${form.riskProfile} · ${form.transitionPreference} · ${form.recommendationStrategy}`;
    case "allocation":
      return `${currentTargetTotal}% total across ${form.targetAllocation.length} sleeves`;
    case "priority":
      return form.accountFundingPriority.join(" -> ");
    case "tax":
      return form.taxAwarePlacement ? "Tax-aware placement enabled" : "Simple account-fit rules only";
    case "watchlist": {
      const count = form.watchlistSymbols.split(",").map((item) => item.trim()).filter(Boolean).length;
      return count > 0 ? `${count} tracked symbol${count === 1 ? "" : "s"}` : "No watchlist symbols yet";
    }
    default:
      return "";
  }
}

function getManualSectionMeta(manualGroups: Array<{ title: string; description: string; badge?: string }>): ManualSectionMeta[] {
  const [allocationGroup, priorityGroup, behaviorGroup, taxGroup] = manualGroups;
  return [
    {
      id: "strategy",
      title: "Strategy controls",
      description: behaviorGroup?.description ?? "Control risk, transition behavior, recommendation strategy, and planning buffer.",
      badge: behaviorGroup?.badge
    },
    {
      id: "allocation",
      title: allocationGroup?.title ?? "Target allocation",
      description: allocationGroup?.description ?? "Edit the target mix that anchors recommendations and health scoring.",
      badge: allocationGroup?.badge
    },
    {
      id: "priority",
      title: priorityGroup?.title ?? "Account funding priorities",
      description: priorityGroup?.description ?? "Set the contribution ladder used by the recommendation engine.",
      badge: priorityGroup?.badge
    },
    {
      id: "tax",
      title: taxGroup?.title ?? "Tax-aware placement",
      description: taxGroup?.description ?? "Keep higher-friction tax details collapsed until they are needed.",
      badge: taxGroup?.badge
    },
    {
      id: "watchlist",
      title: "Watchlist and target constraints",
      description: "Track symbols that should stay visible while you refine the recommendation engine inputs."
    }
  ];
}
export function PreferencesWorkbench({
  initialProfile,
  initialGuidedDraft,
  guidedQuestions,
  manualGroups
}: {
  initialProfile: PreferenceProfile;
  initialGuidedDraft: GuidedAllocationDraft | null;
  guidedQuestions: string[];
  manualGroups: Array<{ title: string; description: string; badge?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [form, setForm] = useState<FormState>({
    riskProfile: initialProfile.riskProfile,
    targetAllocation: initialProfile.targetAllocation,
    accountFundingPriority: initialProfile.accountFundingPriority,
    taxAwarePlacement: initialProfile.taxAwarePlacement,
    cashBufferTargetCad: initialProfile.cashBufferTargetCad,
    transitionPreference: initialProfile.transitionPreference,
    recommendationStrategy: initialProfile.recommendationStrategy,
    rebalancingTolerancePct: initialProfile.rebalancingTolerancePct,
    watchlistSymbols: initialProfile.watchlistSymbols.join(", ")
  });
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAllocationAnswers>(() => initialGuidedDraft?.answers ?? getDefaultGuidedAnswers(initialProfile));
  const [guidedDraftSavedAt, setGuidedDraftSavedAt] = useState<string | null>(() => initialGuidedDraft?.updatedAt ?? null);
  const [guidedStep, setGuidedStep] = useState(0);
  const [openManualSection, setOpenManualSection] = useState<ManualSectionId>("strategy");

  const currentTargetTotal = useMemo(
    () => form.targetAllocation.reduce((sum, target) => sum + Number(target.targetPct || 0), 0),
    [form.targetAllocation]
  );
  const guidedDraft = useMemo(() => buildGuidedDraft(guidedAnswers), [guidedAnswers]);
  const manualSectionMeta = useMemo(() => getManualSectionMeta(manualGroups), [manualGroups]);

  function updateAllocation(assetClass: string, targetPct: number) {
    setForm((current) => ({
      ...current,
      targetAllocation: current.targetAllocation.map((target) =>
        target.assetClass === assetClass ? { ...target, targetPct } : target
      )
    }));
  }

  function updatePriority(index: number, value: PreferenceProfile["accountFundingPriority"][number]) {
    setForm((current) => {
      const next = [...current.accountFundingPriority];
      next[index] = value;
      return {
        ...current,
        accountFundingPriority: next.filter((item, position) => next.indexOf(item) === position)
      };
    });
  }

  function applyGuidedDraftToForm() {
    setForm((current) => ({
      ...current,
      riskProfile: guidedDraft.riskProfile,
      targetAllocation: guidedDraft.targetAllocation,
      accountFundingPriority: guidedDraft.accountFundingPriority,
      taxAwarePlacement: guidedDraft.taxAwarePlacement,
      cashBufferTargetCad: guidedDraft.cashBufferTargetCad,
      transitionPreference: guidedDraft.transitionPreference,
      recommendationStrategy: guidedDraft.recommendationStrategy,
      rebalancingTolerancePct: guidedDraft.rebalancingTolerancePct
    }));
    setOpenManualSection("strategy");
    setStatus({ type: "success", message: "Guided allocation draft loaded into manual configuration. Review the collapsed sections and save when ready." });
  }

  function persistProfile(nextForm: FormState, successMessage: string) {
    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(nextForm))
      });

      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, "Failed to save preference profile.") });
        return;
      }

      setForm(nextForm);
      setStatus({ type: "success", message: successMessage });
      router.refresh();
    });
  }

  function saveProfile() {
    persistProfile(form, "Preference profile saved to PostgreSQL.");
  }

  function saveGuidedDraft() {
    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/settings/guided-draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: guidedAnswers,
          suggestedProfile: {
            riskProfile: guidedDraft.riskProfile,
            targetAllocation: guidedDraft.targetAllocation,
            accountFundingPriority: guidedDraft.accountFundingPriority,
            taxAwarePlacement: guidedDraft.taxAwarePlacement,
            cashBufferTargetCad: guidedDraft.cashBufferTargetCad,
            transitionPreference: guidedDraft.transitionPreference,
            recommendationStrategy: guidedDraft.recommendationStrategy,
            rebalancingTolerancePct: guidedDraft.rebalancingTolerancePct
          },
          assumptions: guidedDraft.assumptions,
          rationale: guidedDraft.rationale
        })
      });

      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, "Failed to save guided allocation draft.") });
        return;
      }

      try {
        const savedDraft = assertApiData<GuidedAllocationDraft>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null && "updatedAt" in candidate,
          "Guided allocation draft save succeeded but returned no usable draft payload."
        );
        setGuidedDraftSavedAt(savedDraft.updatedAt);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to save guided allocation draft." });
        return;
      }

      setStatus({ type: "success", message: "Guided allocation draft saved separately from the live preference profile." });
      router.refresh();
    });
  }

  function applyAndSaveGuidedDraft() {
    const nextForm: FormState = {
      ...form,
      riskProfile: guidedDraft.riskProfile,
      targetAllocation: guidedDraft.targetAllocation,
      accountFundingPriority: guidedDraft.accountFundingPriority,
      taxAwarePlacement: guidedDraft.taxAwarePlacement,
      cashBufferTargetCad: guidedDraft.cashBufferTargetCad,
      transitionPreference: guidedDraft.transitionPreference,
      recommendationStrategy: guidedDraft.recommendationStrategy,
      rebalancingTolerancePct: guidedDraft.rebalancingTolerancePct
    };
    persistProfile(nextForm, "Guided allocation draft applied and saved to PostgreSQL.");
  }

  function goToNextGuidedStep() {
    setGuidedStep((current) => Math.min(current + 1, GUIDED_STEP_META.length - 1));
  }

  function goToPreviousGuidedStep() {
    setGuidedStep((current) => Math.max(current - 1, 0));
  }

  return (
    <div className="space-y-4">
      {status.type !== "idle" ? (
        <div className={cn(
          "rounded-[22px] border px-4 py-3 text-sm",
          status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"
        )}>
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.46))]">
          <CardHeader>
            <CardTitle>Guided Allocation Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Badge variant="primary">For newer users</Badge>
                  <p className="mt-3 text-lg font-semibold">Step through the setup one answer at a time</p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    This flow behaves like onboarding now. Answer one question, move forward, then review the draft before you apply anything.
                  </p>
                </div>
                <div className="rounded-full border border-white/55 bg-white/64 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  {GUIDED_STEP_META[guidedStep].title}
                </div>
              </div>
              <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">Last saved draft: {formatDraftSavedAt(guidedDraftSavedAt)}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              {GUIDED_STEP_META.map((step, index) => {
                const active = index === guidedStep;
                const completed = index < guidedStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setGuidedStep(index)}
                    className={cn(
                      "rounded-[22px] border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-white/70 bg-white/72 shadow-[var(--shadow-card)]"
                        : completed
                          ? "border-white/50 bg-white/46"
                          : "border-white/40 bg-white/26 hover:bg-white/36"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{step.title}</span>
                      {completed ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" /> : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{step.label}</p>
                  </button>
                );
              })}
            </div>

            <GuidedStepPanel
              step={guidedStep}
              guidedQuestions={guidedQuestions}
              guidedAnswers={guidedAnswers}
              setGuidedAnswers={setGuidedAnswers}
              guidedDraft={guidedDraft}
              onNext={goToNextGuidedStep}
              onPrevious={goToPreviousGuidedStep}
              onApplyToManual={applyGuidedDraftToForm}
              onSaveDraft={saveGuidedDraft}
              onApplyAndSave={applyAndSaveGuidedDraft}
              isPending={isPending}
            />
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.46))]">
          <CardHeader>
            <CardTitle>Manual Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
              <p className="font-semibold">Current profile</p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {form.riskProfile} risk, {form.transitionPreference} transition, {form.recommendationStrategy} recommendation strategy.
              </p>
            </div>

            <div className="space-y-3">
              {manualSectionMeta.map((section) => {
                const isOpen = openManualSection === section.id;
                return (
                  <ManualSection
                    key={section.id}
                    title={section.title}
                    description={section.description}
                    summary={getManualSectionSummary(section.id, form, currentTargetTotal)}
                    badge={section.badge}
                    open={isOpen}
                    onToggle={() => setOpenManualSection(section.id)}
                  >
                    {section.id === "strategy" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Risk profile">
                          <select
                            value={form.riskProfile}
                            onChange={(event) => setForm((current) => ({ ...current, riskProfile: event.target.value as PreferenceProfile["riskProfile"] }))}
                            className={FIELD_CLASS_NAME}
                          >
                            <option value="Conservative">Conservative</option>
                            <option value="Balanced">Balanced</option>
                            <option value="Growth">Growth</option>
                          </select>
                        </Field>
                        <Field label="Transition preference">
                          <select
                            value={form.transitionPreference}
                            onChange={(event) => setForm((current) => ({ ...current, transitionPreference: event.target.value as PreferenceProfile["transitionPreference"] }))}
                            className={FIELD_CLASS_NAME}
                          >
                            <option value="stay-close">Stay close to current holdings</option>
                            <option value="gradual">Gradually transition to target</option>
                            <option value="direct">Move directly toward target</option>
                          </select>
                        </Field>
                        <Field label="Recommendation strategy">
                          <select
                            value={form.recommendationStrategy}
                            onChange={(event) => setForm((current) => ({ ...current, recommendationStrategy: event.target.value as PreferenceProfile["recommendationStrategy"] }))}
                            className={FIELD_CLASS_NAME}
                          >
                            <option value="balanced">Balanced</option>
                            <option value="tax-aware">Tax-aware</option>
                            <option value="target-first">Target-first</option>
                          </select>
                        </Field>
                        <Field label="Rebalancing tolerance %">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={form.rebalancingTolerancePct}
                            onChange={(event) => setForm((current) => ({ ...current, rebalancingTolerancePct: Number(event.target.value) }))}
                            className={FIELD_CLASS_NAME}
                          />
                        </Field>
                        <Field label="Cash buffer target (planning base, CAD)">
                          <input
                            type="number"
                            min={0}
                            value={form.cashBufferTargetCad}
                            onChange={(event) => setForm((current) => ({ ...current, cashBufferTargetCad: Number(event.target.value) }))}
                            className={FIELD_CLASS_NAME}
                          />
                        </Field>
                        <label className="flex items-center gap-3 rounded-[22px] border border-white/55 bg-white/38 px-4 py-3 text-sm font-medium backdrop-blur-md">
                          <input
                            type="checkbox"
                            checked={form.taxAwarePlacement}
                            onChange={(event) => setForm((current) => ({ ...current, taxAwarePlacement: event.target.checked }))}
                          />
                          Tax-aware asset placement
                        </label>
                      </div>
                    ) : null}

                    {section.id === "allocation" ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-[color:var(--muted-foreground)]">The total must sum to 100. Current total: {currentTargetTotal}%.</p>
                          <Badge variant={currentTargetTotal === 100 ? "success" : "warning"}>{currentTargetTotal}%</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {form.targetAllocation.map((target) => (
                            <Field key={target.assetClass} label={target.assetClass}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={target.targetPct}
                                onChange={(event) => updateAllocation(target.assetClass, Number(event.target.value))}
                                className={FIELD_CLASS_NAME}
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {section.id === "priority" ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                          <Field key={index} label={`Priority ${index + 1}`}>
                            <select
                              value={form.accountFundingPriority[index] ?? "Taxable"}
                              onChange={(event) => updatePriority(index, event.target.value as PreferenceProfile["accountFundingPriority"][number])}
                              className={FIELD_CLASS_NAME}
                            >
                              <option value="TFSA">TFSA</option>
                              <option value="RRSP">RRSP</option>
                              <option value="FHSA">FHSA</option>
                              <option value="Taxable">Taxable</option>
                            </select>
                          </Field>
                        ))}
                      </div>
                    ) : null}

                    {section.id === "tax" ? (
                      <div className="rounded-[22px] border border-white/55 bg-white/34 px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
                        Province and marginal tax bracket remain collapsed until the product needs deeper tax modeling. For now this toggle controls whether the engine favors tax-aware placement heuristics.
                      </div>
                    ) : null}

                    {section.id === "watchlist" ? (
                      <Field label="Watchlist symbols">
                        <input
                          type="text"
                          value={form.watchlistSymbols}
                          onChange={(event) => setForm((current) => ({ ...current, watchlistSymbols: event.target.value }))}
                          placeholder="XEF, VCN, CASH"
                          className={FIELD_CLASS_NAME}
                        />
                      </Field>
                    ) : null}
                  </ManualSection>
                );
              })}
            </div>

            <Button type="button" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />} onClick={saveProfile} disabled={isPending}>
              {isPending ? "Saving..." : "Save preference profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuidedStepPanel({
  step,
  guidedQuestions,
  guidedAnswers,
  setGuidedAnswers,
  guidedDraft,
  onNext,
  onPrevious,
  onApplyToManual,
  onSaveDraft,
  onApplyAndSave,
  isPending
}: {
  step: number;
  guidedQuestions: string[];
  guidedAnswers: GuidedAllocationAnswers;
  setGuidedAnswers: React.Dispatch<React.SetStateAction<GuidedAllocationAnswers>>;
  guidedDraft: GuidedDraft;
  onNext: () => void;
  onPrevious: () => void;
  onApplyToManual: () => void;
  onSaveDraft: () => void;
  onApplyAndSave: () => void;
  isPending: boolean;
}) {
  const onFinalReview = step === GUIDED_STEP_META.length - 1;

  return (
    <Card className="bg-[linear-gradient(135deg,rgba(240,143,178,0.14),rgba(111,141,246,0.1),rgba(255,255,255,0.24))]">
      <CardContent className="space-y-5 px-5 py-5">
        {!onFinalReview ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Question {step + 1} of 4</p>
              <p className="text-xl font-semibold text-[color:var(--foreground)]">{guidedQuestions[step] ?? GUIDED_STEP_META[step].label}</p>
            </div>

            {step === 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Primary goal">
                  <select
                    value={guidedAnswers.goal}
                    onChange={(event) => setGuidedAnswers((current) => ({ ...current, goal: event.target.value as GuidedAllocationAnswers["goal"] }))}
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="retirement">Retirement growth</option>
                    <option value="home">Home purchase</option>
                    <option value="wealth">General long-term wealth</option>
                    <option value="capital-preservation">Capital preservation</option>
                  </select>
                </Field>
                <Field label="Time horizon">
                  <select
                    value={guidedAnswers.horizon}
                    onChange={(event) => setGuidedAnswers((current) => ({ ...current, horizon: event.target.value as GuidedAllocationAnswers["horizon"] }))}
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="short">Under 3 years</option>
                    <option value="medium">3 to 7 years</option>
                    <option value="long">7+ years</option>
                  </select>
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <Field label="Drawdown tolerance">
                <select
                  value={guidedAnswers.volatility}
                  onChange={(event) => setGuidedAnswers((current) => ({ ...current, volatility: event.target.value as GuidedAllocationAnswers["volatility"] }))}
                  className={FIELD_CLASS_NAME}
                >
                  <option value="low">Low - avoid large swings</option>
                  <option value="medium">Medium - moderate volatility is acceptable</option>
                  <option value="high">High - comfortable with equity-heavy swings</option>
                </select>
              </Field>
            ) : null}
            {step === 2 ? (
              <Field label="What should the engine optimize for first?">
                <select
                  value={guidedAnswers.priority}
                  onChange={(event) => setGuidedAnswers((current) => ({ ...current, priority: event.target.value as GuidedAllocationAnswers["priority"] }))}
                  className={FIELD_CLASS_NAME}
                >
                  <option value="tax-efficiency">Tax efficiency first</option>
                  <option value="balanced">Balanced recommendation behavior</option>
                  <option value="stay-close">Stay closer to current holdings</option>
                </select>
              </Field>
            ) : null}

            {step === 3 ? (
              <Field label="Cash reserve target">
                <select
                  value={guidedAnswers.cashNeed}
                  onChange={(event) => setGuidedAnswers((current) => ({ ...current, cashNeed: event.target.value as GuidedAllocationAnswers["cashNeed"] }))}
                  className={FIELD_CLASS_NAME}
                >
                  <option value="low">Low - deploy most capital</option>
                  <option value="medium">Medium - keep a moderate buffer</option>
                  <option value="high">High - preserve more cash</option>
                </select>
              </Field>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-white/40 pt-2">
              <Button type="button" variant="ghost" onClick={onPrevious} disabled={step === 0} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button type="button" onClick={onNext} trailingIcon={<ArrowRight className="h-4 w-4" />}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Review guided draft</p>
                <p className="mt-2 text-xl font-semibold">Suggested starting allocation: {guidedDraft.targetMixLabel}</p>
              </div>
              <Badge variant="success">Editable draft</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {guidedDraft.targetAllocation.map((target) => (
                <div key={target.assetClass} className="rounded-[24px] border border-white/55 bg-white/42 px-4 py-3 text-sm backdrop-blur-md">
                  <span className="font-medium">{target.assetClass}</span>
                  <span className="float-right">{target.targetPct}%</span>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoBlock label="Risk profile" value={guidedDraft.riskProfile} />
              <InfoBlock label="Account priority" value={guidedDraft.accountFundingPriority.join(" -> ")} />
              <InfoBlock label="Recommendation strategy" value={guidedDraft.recommendationStrategy} />
              <InfoBlock label="Cash buffer target" value={`${guidedDraft.cashBufferTargetCad.toLocaleString("en-CA")} in planning base CAD`} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[color:var(--foreground)]">Assumptions</p>
              {guidedDraft.assumptions.map((assumption) => (
                <div key={assumption} className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                  {assumption}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[color:var(--foreground)]">Why this draft was suggested</p>
              {guidedDraft.rationale.map((item) => (
                <div key={item} className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={onApplyToManual}>
                Apply to manual configuration
              </Button>
              <Button type="button" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} onClick={onSaveDraft} disabled={isPending}>
                {isPending ? "Saving draft..." : "Save guided draft"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <Button type="button" onClick={onApplyAndSave} disabled={isPending}>
                {isPending ? "Saving guided draft..." : "Apply and save profile"}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/40 pt-2">
              <Button type="button" variant="ghost" onClick={onPrevious} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
      {children}
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/42 px-4 py-3 text-sm backdrop-blur-md">
      <p className="text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function ManualSection({
  title,
  description,
  summary,
  badge,
  open,
  onToggle,
  children
}: {
  title: string;
  description: string;
  summary: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/36 backdrop-blur-md">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{title}</p>
            {badge ? <Badge variant="neutral">{badge}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{description}</p>
          <p className="mt-3 text-sm font-medium text-[color:var(--foreground)]">{summary}</p>
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-[color:var(--muted-foreground)] transition-transform", open ? "rotate-180" : "rotate-0")} />
      </button>
      {open ? <div className="border-t border-white/40 px-5 py-5">{children}</div> : null}
    </div>
  );
}
