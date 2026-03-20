"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, SlidersHorizontal } from "lucide-react";
import type { AccountType, GuidedAllocationAnswers, GuidedAllocationDraft, PreferenceProfile } from "@/lib/backend/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";

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

  const currentTargetTotal = useMemo(
    () => form.targetAllocation.reduce((sum, target) => sum + Number(target.targetPct || 0), 0),
    [form.targetAllocation]
  );
  const guidedDraft = useMemo(() => buildGuidedDraft(guidedAnswers), [guidedAnswers]);

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
    setStatus({ type: "success", message: "Guided allocation draft loaded into manual configuration. Review and save when ready." });
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

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Guided Allocation Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
            <Badge variant="primary">For newer users</Badge>
            <p className="mt-3 text-lg font-semibold">Help me build my allocation</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              This guided flow now produces a real portfolio draft. You can apply it to manual configuration first or save it directly as your live preference profile.
            </p>
            <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
              Last saved draft: {formatDraftSavedAt(guidedDraftSavedAt)}
            </p>
          </div>

          <div className="grid gap-4">
            <QuestionCard
              label={guidedQuestions[0] ?? "Primary goal and time horizon"}
              control={(
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Primary goal">
                    <select
                      value={guidedAnswers.goal}
                      onChange={(event) => setGuidedAnswers((current) => ({ ...current, goal: event.target.value as GuidedAllocationAnswers["goal"] }))}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
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
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="short">Under 3 years</option>
                      <option value="medium">3 to 7 years</option>
                      <option value="long">7+ years</option>
                    </select>
                  </Field>
                </div>
              )}
            />

            <QuestionCard
              label={guidedQuestions[1] ?? "Volatility comfort"}
              control={(
                <Field label="Drawdown tolerance">
                  <select
                    value={guidedAnswers.volatility}
                    onChange={(event) => setGuidedAnswers((current) => ({ ...current, volatility: event.target.value as GuidedAllocationAnswers["volatility"] }))}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="low">Low - avoid large swings</option>
                    <option value="medium">Medium - moderate volatility is acceptable</option>
                    <option value="high">High - comfortable with equity-heavy swings</option>
                  </select>
                </Field>
              )}
            />

            <QuestionCard
              label={guidedQuestions[2] ?? "Engine priority"}
              control={(
                <Field label="What should the engine optimize for first?">
                  <select
                    value={guidedAnswers.priority}
                    onChange={(event) => setGuidedAnswers((current) => ({ ...current, priority: event.target.value as GuidedAllocationAnswers["priority"] }))}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="tax-efficiency">Tax efficiency first</option>
                    <option value="balanced">Balanced recommendation behavior</option>
                    <option value="stay-close">Stay closer to current holdings</option>
                  </select>
                </Field>
              )}
            />

            <QuestionCard
              label={guidedQuestions[3] ?? "Cash reserve preference"}
              control={(
                <Field label="Cash reserve target">
                  <select
                    value={guidedAnswers.cashNeed}
                    onChange={(event) => setGuidedAnswers((current) => ({ ...current, cashNeed: event.target.value as GuidedAllocationAnswers["cashNeed"] }))}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="low">Low - deploy most capital</option>
                    <option value="medium">Medium - keep a moderate buffer</option>
                    <option value="high">High - preserve more cash</option>
                  </select>
                </Field>
              )}
            />
          </div>

          <Card className="bg-[linear-gradient(135deg,rgba(25,71,229,0.06),rgba(25,71,229,0.02))]">
            <CardContent className="space-y-4 px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[color:var(--muted-foreground)]">Suggested starting allocation</p>
                  <p className="mt-1 text-xl font-semibold">{guidedDraft.targetMixLabel}</p>
                </div>
                <Badge variant="success">Editable draft</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {guidedDraft.targetAllocation.map((target) => (
                  <div key={target.assetClass} className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm">
                    <span className="font-medium">{target.assetClass}</span>
                    <span className="float-right">{target.targetPct}%</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock label="Risk profile" value={guidedDraft.riskProfile} />
                <InfoBlock label="Account priority" value={guidedDraft.accountFundingPriority.join(" -> ")} />
                <InfoBlock label="Recommendation strategy" value={guidedDraft.recommendationStrategy} />
                <InfoBlock label="Cash buffer target" value={`${guidedDraft.cashBufferTargetCad.toLocaleString("en-CA")} CAD`} />
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
                <Button type="button" variant="secondary" onClick={applyGuidedDraftToForm}>
                  Apply to manual configuration
                </Button>
                <Button type="button" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} onClick={saveGuidedDraft} disabled={isPending}>
                  {isPending ? "Saving draft..." : "Save guided draft"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-1">
                <Button type="button" onClick={applyAndSaveGuidedDraft} disabled={isPending}>
                  {isPending ? "Saving guided draft..." : "Apply and save profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
            <p className="font-semibold">Current profile</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {form.riskProfile} risk, {form.transitionPreference} transition, {form.recommendationStrategy} recommendation strategy.
            </p>
          </div>
          {manualGroups.map((group) => (
            <div key={group.title} className="rounded-[24px] border border-[color:var(--border)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{group.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{group.description}</p>
                </div>
                {group.badge ? <Badge variant="neutral">{group.badge}</Badge> : null}
              </div>
            </div>
          ))}

          <div className="grid gap-4 rounded-[24px] border border-[color:var(--border)] p-5 md:grid-cols-2">
            <Field label="Risk profile">
              <select
                value={form.riskProfile}
                onChange={(event) => setForm((current) => ({ ...current, riskProfile: event.target.value as PreferenceProfile["riskProfile"] }))}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="Cash buffer target (CAD)">
              <input
                type="number"
                min={0}
                value={form.cashBufferTargetCad}
                onChange={(event) => setForm((current) => ({ ...current, cashBufferTargetCad: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
              />
            </Field>
            <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.taxAwarePlacement}
                onChange={(event) => setForm((current) => ({ ...current, taxAwarePlacement: event.target.checked }))}
              />
              Tax-aware asset placement
            </label>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Target allocation</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">The total must sum to 100. Current total: {currentTargetTotal}%.</p>
              </div>
              <Badge variant={currentTargetTotal === 100 ? "success" : "warning"}>{currentTargetTotal}%</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {form.targetAllocation.map((target) => (
                <Field key={target.assetClass} label={target.assetClass}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={target.targetPct}
                    onChange={(event) => updateAllocation(target.assetClass, Number(event.target.value))}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] p-5">
            <p className="font-semibold">Account funding priorities</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Set the contribution ladder used by the recommendation engine.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Field key={index} label={`Priority ${index + 1}`}>
                  <select
                    value={form.accountFundingPriority[index] ?? "Taxable"}
                    onChange={(event) => updatePriority(index, event.target.value as PreferenceProfile["accountFundingPriority"][number])}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="TFSA">TFSA</option>
                    <option value="RRSP">RRSP</option>
                    <option value="FHSA">FHSA</option>
                    <option value="Taxable">Taxable</option>
                  </select>
                </Field>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Advanced tax settings</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Province and marginal tax bracket are hidden until the user opts into tax-aware placement details.
                </p>
              </div>
              <SlidersHorizontal className="h-5 w-5 text-[color:var(--secondary)]" />
            </div>
          </div>

          <Field label="Watchlist symbols">
            <input
              type="text"
              value={form.watchlistSymbols}
              onChange={(event) => setForm((current) => ({ ...current, watchlistSymbols: event.target.value }))}
              placeholder="XEF, VCN, CASH"
              className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
            />
          </Field>

          {status.type !== "idle" ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
              {status.message}
            </div>
          ) : null}

          <Button type="button" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />} onClick={saveProfile} disabled={isPending}>
            {isPending ? "Saving..." : "Save preference profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
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

function QuestionCard({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--border)] p-5">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
      <div className="mt-3">{control}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm">
      <p className="text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
