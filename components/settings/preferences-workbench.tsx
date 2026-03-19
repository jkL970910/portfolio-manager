"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import type { PreferenceProfile } from "@/lib/backend/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function getTargetMixLabel(targetAllocation: PreferenceProfile["targetAllocation"]) {
  const equity = targetAllocation
    .filter((target) => target.assetClass !== "Fixed Income" && target.assetClass !== "Cash")
    .reduce((sum, target) => sum + target.targetPct, 0);
  const fixedIncome = targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const cash = targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;
  return `${equity} / ${fixedIncome} / ${cash}`;
}

export function PreferencesWorkbench({
  initialProfile,
  guidedQuestions,
  manualGroups
}: {
  initialProfile: PreferenceProfile;
  guidedQuestions: string[];
  manualGroups: Array<{ title: string; description: string; badge?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [form, setForm] = useState({
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

  const suggestedTargetMix = useMemo(() => getTargetMixLabel(RISK_PRESETS[form.riskProfile]), [form.riskProfile]);
  const currentTargetTotal = useMemo(
    () => form.targetAllocation.reduce((sum, target) => sum + Number(target.targetPct || 0), 0),
    [form.targetAllocation]
  );

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

  function applyGuidedAllocation() {
    setForm((current) => ({
      ...current,
      targetAllocation: RISK_PRESETS[current.riskProfile]
    }));
    setStatus({ type: "success", message: "Suggested allocation loaded into manual configuration. Review and save when ready." });
  }

  function saveProfile() {
    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
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
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Failed to save preference profile." });
        return;
      }

      setStatus({ type: "success", message: "Preference profile saved to PostgreSQL." });
      router.refresh();
    });
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
              A short questionnaire that produces an editable starting allocation with assumptions and rationale.
            </p>
          </div>
          <div className="space-y-3">
            {guidedQuestions.map((question) => (
              <div key={question} className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
                {question}
              </div>
            ))}
          </div>
          <Card className="bg-[linear-gradient(135deg,rgba(25,71,229,0.06),rgba(25,71,229,0.02))]">
            <CardContent className="space-y-4 px-5 py-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--foreground)]">Risk profile for guided draft</span>
                <select
                  value={form.riskProfile}
                  onChange={(event) => setForm((current) => ({ ...current, riskProfile: event.target.value as PreferenceProfile["riskProfile"] }))}
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Growth">Growth</option>
                </select>
              </label>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[color:var(--muted-foreground)]">Suggested starting allocation</p>
                  <p className="mt-1 text-xl font-semibold">{suggestedTargetMix}</p>
                </div>
                <Badge variant="success">Editable draft</Badge>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Generated from time horizon, volatility comfort, account mix, and tax-efficiency preference.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" onClick={applyGuidedAllocation}>Use this allocation</Button>
                <Button type="button" variant="secondary">Edit manually</Button>
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
