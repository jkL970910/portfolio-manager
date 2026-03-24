import { ArrowRight } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RadarPreviewCard } from "@/components/charts/radar-preview";
import { HealthDimensionCard } from "@/components/portfolio/health-dimension-card";
import { HealthActionQueue } from "@/components/portfolio/health-action-queue";
import { HealthDrilldownCard } from "@/components/portfolio/health-drilldown-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioHealthPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPortfolioView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "健康评分详情", "Portfolio Health")}
      description={pick(
        language,
        "这一页把健康评分拆成可解释的维度、账户级证据和持仓级证据，方便你判断下一步先修哪里。",
        "This page breaks the health score into explainable dimensions, account-level evidence, and holding-level evidence so you can decide what to fix first."
      )}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">
              {pick(language, "组合健康诊断台", "Portfolio health lab")}
            </div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(
                  language,
                  "先看组合哪里失衡，再决定推荐值不值得执行。",
                  "Inspect what is out of shape before deciding whether the recommendation path is worth following."
                )}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "健康评分不是一个装饰数字。它拆成配置贴合、分散度、账户效率、集中度和风险平衡五个维度，并进一步落到账户和持仓明细。",
                  "The health score is not a decorative number. It is broken into allocation fit, diversification, account efficiency, concentration, and risk balance, then traced into account and holding detail."
                )}
              </p>
            </div>
          </div>
          <RadarPreviewCard
            title={pick(language, "当前雷达图", "Current radar")}
            status={`${data.healthScore.score}/100 · ${data.healthScore.status}`}
            description={pick(
              language,
              `当前最强维度是 ${data.healthScore.strongestDimension}，最弱维度是 ${data.healthScore.weakestDimension}。`,
              `Strongest dimension: ${data.healthScore.strongestDimension}. Weakest dimension: ${data.healthScore.weakestDimension}.`
            )}
            data={data.healthScore.radar}
            href="/portfolio"
            ctaLabel={pick(language, "返回组合页", "Back to portfolio")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "总分与行动队列", "Overall score and action queue")}
            description={pick(
              language,
              "先看总分，再看最应该优先处理的三件事。",
              "Start with the total score, then work through the three actions that matter most."
            )}
          />
          <Card>
            <CardContent className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "总分", "Overall score")}</p>
                <p className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">{data.healthScore.score}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{data.healthScore.status}</p>
              </div>
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "当前最弱维度", "Weakest dimension")}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{data.healthScore.weakestDimension}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {pick(language, "这一维最值得优先修整。", "This is the dimension to improve first.")}
                </p>
              </div>
            </CardContent>
          </Card>
          <HealthActionQueue
            title={pick(language, "优先行动队列", "Priority action queue")}
            items={data.healthScore.actionQueue}
          />
          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              {data.healthScore.highlights.map((highlight, index) => (
                <div
                  key={`health-highlight-${index}`}
                  className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md"
                >
                  {highlight}
                </div>
              ))}
              <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "用这些诊断去看推荐页", "Use these diagnostics in recommendations")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "维度拆解", "Dimension breakdown")}
            description={pick(
              language,
              "每张卡都会展示分数、驱动项和下一步动作，避免健康评分停留在抽象数字。",
              "Each card shows score, drivers, and next actions so the health score does not stay abstract."
            )}
          />
          {data.healthScore.dimensions.map((dimension) => (
            <HealthDimensionCard
              key={dimension.id}
              dimension={dimension}
              driversLabel={pick(language, "驱动因素", "Drivers")}
              actionsLabel={pick(language, "下一步动作", "Actions")}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HealthDrilldownCard
          title={pick(language, "按账户拆解", "Account drill-down")}
          description={pick(
            language,
            "先找出哪个账户最不高效、最拥挤，再决定新增资金应该绕开什么。",
            "Find the least efficient or most crowded account first, then decide where new money should avoid piling in."
          )}
          items={data.healthScore.accountDrilldown}
          openLabel={pick(language, "在组合页中查看", "Open in portfolio")}
          driversLabel={pick(language, "账户现状", "Account evidence")}
          actionsLabel={pick(language, "优先处理", "Recommended action")}
          scenarioLabel={pick(language, "模拟下一笔投入（规划基准 CAD）", "Simulate next contribution (planning-base CAD)")}
        />
        <HealthDrilldownCard
          title={pick(language, "按持仓拆解", "Holding drill-down")}
          description={pick(
            language,
            "这里展示当前最值得盯住的持仓，不只是看谁涨得多，而是看谁最影响组合结构。",
            "This section highlights the holdings worth watching most closely, based on portfolio structure rather than performance alone."
          )}
          items={data.healthScore.holdingDrilldown}
          openLabel={pick(language, "在组合页中查看", "Open in portfolio")}
          driversLabel={pick(language, "持仓现状", "Holding evidence")}
          actionsLabel={pick(language, "优先处理", "Recommended action")}
          scenarioLabel={pick(language, "模拟下一笔投入（规划基准 CAD）", "Simulate next contribution (planning-base CAD)")}
        />
      </div>
    </AppShell>
  );
}
