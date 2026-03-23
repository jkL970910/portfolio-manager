import type { Route } from "next";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getRecommendationView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationRunPanel } from "@/components/recommendations/recommendation-run-panel";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { pick } from "@/lib/i18n/ui";

export default async function RecommendationsPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getRecommendationView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "藏宝路线", "Recommendations")}
      description={pick(language, "推荐页负责给出更完整的资金配置路径。输入、理由、账户放置和风险说明都保持可见。", "This page carries the full funding path. Inputs, rationale, account placement, and risk notes stay visible.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">{pick(language, "Loo 的藏宝路线", "Loo's recommendation desk")}</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先把假设摆在台面上，再给出下一笔钱怎么走。", "Show the assumptions first, then decide where the next contribution should go.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "这里不追求黑箱式结论。目标配置、账户优先级、ticker 备选和说明会一起出现，方便你判断这条路线值不值得采纳。", "This surface avoids black-box output. Target allocation, account order, ticker candidates, and rationale stay visible so you can judge the plan directly.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecommendationSignal title={pick(language, "输入层", "Inputs")} detail={pick(language, "目标、账户、金额与偏好", "Targets, accounts, amount, and preferences")} />
            <RecommendationSignal title={pick(language, "输出层", "Outputs")} detail={pick(language, "资产类优先级、账户匹配与说明", "Asset priorities, account fit, and rationale")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "输入与假设", "Inputs and assumptions")}
            description={pick(language, "推荐结果会锚定到用户保存的偏好、账户优先级和目标配置。", "Recommendations are anchored to the user's configured preferences, account priorities, and allocation targets.")}
          />
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "投入设置", "Contribution Setup")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "投入金额", "Contribution amount")}</p>
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
              <CardTitle>{pick(language, "计算方式", "How this is calculated")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.explainer.map((point) => (
                <div key={point} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {point}
                </div>
              ))}
            </CardContent>
          </Card>
          <RecommendationRunPanel initialContributionAmount={data.run.contributionAmountCad || 5000} language={language} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "资金配置优先级", "Ranked Funding Priorities")}</CardTitle>
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
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "Ticker 备选", "Ticker options")}</p>
                      <p className="mt-2 font-medium">{priority.tickers}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "账户匹配", "Account fit")}</p>
                      <p className="mt-2 font-medium">{priority.accountFit}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.priorities.length === 0 ? (
                <EmptyStatePanel
                  title={pick(language, "还没有推荐结果", "No recommendation run is available yet")}
                  text={pick(language, "先保存偏好、导入持仓，再生成第一条资金配置建议。", "Save your preferences, import holdings, then generate the first funding plan.")}
                />
              ) : null}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{pick(language, "置信度与说明", "Confidence and notes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    {pick(language, "置信度：中高", "Confidence: medium-high")}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {pick(language, "基于你当前保存的偏好、组合偏离和账户空间生成。", "Based on your configured preferences, current drift, and account room.")}
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
                <CardTitle>{pick(language, "下一步动作", "Next actions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ActionRow label={pick(language, "查看组合驱动因素", "Review portfolio drivers")} href="/portfolio" />
                <ActionRow label={pick(language, "调整投资偏好", "Adjust investment preferences")} href="/settings" />
                <ActionRow label={pick(language, "回到首页摘要", "Revisit dashboard summary")} href="/dashboard" />
              </CardContent>
            </Card>
          </div>
          <Card className="border-white/55 bg-[linear-gradient(135deg,rgba(240,143,178,0.14),rgba(111,141,246,0.1),rgba(255,255,255,0.26))]">
            <CardContent className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 text-[color:var(--primary)]" />
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {pick(language, "这一层是规划支持，不是黑箱执行器。后端组合逻辑以后可以升级，但不需要推翻当前 UI 合约。", "This workflow is planning support. Backend portfolio logic can later replace these rules without changing the UI contracts.")}
                </p>
              </div>
              <Button variant="secondary">{pick(language, "准备执行交接", "Prepare execution handoff")}</Button>
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
