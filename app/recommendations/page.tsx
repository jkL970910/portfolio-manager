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
    <AppShell viewer={viewer} title="藏宝路线" description="推荐页负责给出更完整的资金配置路径。输入、理由、账户放置和风险说明都保持可见。">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">Loo 的藏宝路线</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                先把假设摆在台面上，再给出下一笔钱怎么走。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                这里不追求黑箱式结论。目标配置、账户优先级、ticker 备选和说明会一起出现，方便你判断这条路线值不值得采纳。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecommendationSignal title="输入层" detail="目标、账户、金额与偏好" />
            <RecommendationSignal title="输出层" detail="资产类优先级、账户匹配与说明" />
          </div>
        </CardContent>
      </Card>

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
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">Contribution amount</p>
                <p className="mt-2 text-3xl font-semibold">{data.contributionAmount}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.inputs.map((input) => (
                  <div key={input.label} className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
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
                <div key={point} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
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
                <div key={priority.assetClass} className="rounded-[24px] border border-white/55 bg-white/42 p-5 backdrop-blur-md">
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
                    <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Ticker options</p>
                      <p className="mt-2 font-medium">{priority.tickers}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Account fit</p>
                      <p className="mt-2 font-medium">{priority.accountFit}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.priorities.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/60 bg-white/32 p-5 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
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
                <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    Confidence: medium-high
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    Based on your configured preferences, current drift, and account room.
                  </p>
                </div>
                {data.notes.map((note) => (
                  <div key={note} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
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
          <Card className="border-white/55 bg-[linear-gradient(135deg,rgba(240,143,178,0.14),rgba(111,141,246,0.1),rgba(255,255,255,0.26))]">
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

function RecommendationSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
