import type { Route } from "next";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getRecommendationView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationRunPanel } from "@/components/recommendations/recommendation-run-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function RecommendationsPage() {
  const viewer = await requireViewer();
  const { data } = await getRecommendationView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title="Recommendations"
      description="Transparent, editable funding guidance. Inputs stay visible so the workflow feels explainable rather than black-box."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SectionHeading
            title="Inputs and assumptions"
            description="Recommendations are anchored to the user's configured preferences, account priorities, and allocation targets."
          />
          <Card>
            <CardHeader>
              <CardTitle>Contribution Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
                <p className="text-sm text-[color:var(--muted-foreground)]">Contribution amount</p>
                <p className="mt-2 text-3xl font-semibold">{data.contributionAmount}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.inputs.map((input) => (
                  <div key={input.label} className="rounded-2xl border border-[color:var(--border)] p-4">
                    <p className="text-sm text-[color:var(--muted-foreground)]">{input.label}</p>
                    <p className="mt-2 font-semibold">{input.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>How this is calculated</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.explainer.map((point) => (
                <div key={point} className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
                  {point}
                </div>
              ))}
            </CardContent>
          </Card>
          <RecommendationRunPanel initialContributionAmount={data.run.contributionAmountCad || 5000} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ranked Funding Priorities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.priorities.map((priority, index) => (
                <div key={priority.assetClass} className="rounded-[24px] border border-[color:var(--border)] bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Badge variant="primary">#{index + 1}</Badge>
                        <p className="text-lg font-semibold">{priority.assetClass}</p>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{priority.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">{priority.amount}</p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">{priority.account}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Ticker options</p>
                      <p className="mt-2 font-medium">{priority.tickers}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Account fit</p>
                      <p className="mt-2 font-medium">{priority.accountFit}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.priorities.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] p-5 text-sm text-[color:var(--muted-foreground)]">
                  No recommendation run is available yet. Save your preferences, import holdings, then generate the first funding plan.
                </div>
              ) : null}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Confidence and notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--border)] p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    Confidence: medium-high
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    Based on your configured preferences, current drift, and account room.
                  </p>
                </div>
                {data.notes.map((note) => (
                  <div key={note} className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
                    {note}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Next actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ActionRow label="Review portfolio drivers" href="/portfolio" />
                <ActionRow label="Adjust investment preferences" href="/settings" />
                <ActionRow label="Revisit dashboard summary" href="/dashboard" />
              </CardContent>
            </Card>
          </div>
          <Card className="border-[color:var(--primary)]/20">
            <CardContent className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 text-[color:var(--primary)]" />
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  This workflow is planning support. Backend portfolio logic can later replace these mock rules without changing the UI contracts.
                </p>
              </div>
              <Button variant="secondary">Prepare execution handoff</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ActionRow({ label, href }: { label: string; href: Route }) {
  return (
    <Button href={href} variant="ghost" className="w-full justify-between">
      {label}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
