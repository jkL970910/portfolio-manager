import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioSecurityDetailView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { LineChartCard } from "@/components/charts/line-chart";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioSecurityDetailPage({
  params
}: {
  params: Promise<{ symbol: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { symbol } = await params;
  const response = await getPortfolioSecurityDetailView(viewer.id, decodeURIComponent(symbol));
  const detail = response.data.data;

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      viewer={viewer}
      title={detail.security.symbol}
      description={pick(
        language,
        "先看这支标的的关键数字，再往下看报价、说明和它与你组合的关系。",
        "Start with the key facts for this security, then move into the quote, context, and portfolio relationship."
      )}
      compactHeader
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/recommendations" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            {pick(language, "回推荐页", "Back to recommendations")}
          </Button>
          <Link href="/portfolio" className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/56">
            {pick(language, "回组合页", "Back to portfolio")}
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <Card className="bg-white/34">
            <CardContent className="space-y-5 px-5 py-5">
              <div className="flex items-start gap-2.5">
                <SecurityMark
                  symbol={detail.security.symbol}
                  assetClass={detail.security.assetClass}
                  hint={detail.security.securityType === "Unknown" ? undefined : detail.security.securityType.slice(0, 3).toUpperCase()}
                  className="h-6 w-6 rounded-[9px] text-[9px]"
                />
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[22px]">{detail.security.symbol}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.assetClass}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.sector}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.securityType}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.exchange}</span>
                    </div>
                  </div>
                  <div>
                    {detail.security.name.trim().toUpperCase() === detail.security.symbol.trim().toUpperCase() ? null : (
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.security.name}</p>
                    )}
                  </div>
                </div>
              </div>
              <LineChartCard
                title={pick(language, `${detail.security.symbol} 近 6 个月参考走势`, `Reference 6-month view for ${detail.security.symbol}`)}
                description={pick(language, "先看这支标的最近大概是稳着走，还是波动更明显。", "Use this to gauge whether the security has looked steadier or more volatile lately.")}
                data={detail.performance}
                dataKey="value"
                color="#152238"
              />
            </CardContent>
          </Card>
          <Card className="h-full bg-white/34">
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.facts.map((fact, index) => (
                  <CompactMetric key={`security-fact-${index}`} label={fact.label} value={compactMetricValue(fact.value)} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {detail.marketData.summary}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {detail.marketData.facts.map((fact, index) => (
                  <StatBlock key={`security-market-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
                ))}
              </div>
              <div className="grid gap-3">
                {detail.marketData.notes.map((note, index) => (
                  <div key={`security-market-note-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {note}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <SectionHeading
            title={pick(language, "它和你的组合现在是什么关系", "How it currently relates to your portfolio")}
            description={pick(
              language,
              "如果你已经持有它，这里会告诉你它分散在哪些账户里；如果还没持有，这里就把它当候选标的来理解。",
              "If you already hold it, this section shows where it sits across accounts. If not, it treats the symbol as a candidate security."
            )}
          />
          <div className="grid gap-4">
            {detail.summaryPoints.map((item, index) => (
              <Card key={`security-role-${index}`}>
                <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{item}</CardContent>
              </Card>
            ))}
          </div>

          {detail.relatedHoldings.length > 0 ? (
            <>
              <SectionHeading
                title={pick(language, "你已经持有的相关仓位", "Related holdings you already own")}
                description={pick(language, "如果你已经在别的账户里持有它，这里会列出来，方便直接点回持仓详情。", "If you already hold the symbol in another account, the related positions are listed here for quick drill-down.")}
              />
              <div className="grid gap-4">
                {detail.relatedHoldings.map((holding) => (
                  <Card key={holding.id}>
                    <CardContent className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-[color:var(--foreground)]">{holding.account}</p>
                        <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, `当前估值 ${holding.value} · 占整个组合 ${holding.portfolioShare}`, `Current value ${holding.value} · Of portfolio ${holding.portfolioShare}`)}</p>
                      </div>
                      <Button href={holding.href} variant="secondary" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                        {pick(language, "打开这笔持仓详情", "Open holding detail")}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <StickyRail>
          <Card>
            <CardContent className="space-y-4 px-6 py-6">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "如果你把它当候选标的来看", "If you are evaluating it as a candidate")}</p>
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {detail.marketData.summary}
              </div>
              {detail.marketData.notes.map((note, index) => (
                <div key={`security-rail-note-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {note}
                </div>
              ))}
              <Button href="/recommendations" variant="secondary" className="w-full" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "回推荐页继续比对", "Back to recommendations")}
              </Button>
              <Button href="/portfolio" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "回组合页继续看整体", "Back to portfolio")}
              </Button>
            </CardContent>
          </Card>
        </StickyRail>
      </div>
    </AppShell>
  );
}

function compactMetricValue(value: string) {
  const percentMatch = value.match(/-?\d+(?:\.\d+)?%/);
  if (percentMatch) {
    return percentMatch[0];
  }

  const moneyMatch = value.match(/(?:CAD|USD|JPY|EUR|GBP)\s*\$?[\d,]+(?:\.\d+)?|[$¥€£]\s?[\d,]+(?:\.\d+)?/);
  if (moneyMatch) {
    return moneyMatch[0].replace(/\s+/g, " ");
  }

  return value;
}

function CompactMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/55 bg-white/42 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm leading-6 font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
