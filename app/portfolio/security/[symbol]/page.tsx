import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioSecurityDetailView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { LineChartCard } from "@/components/charts/line-chart";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Badge } from "@/components/ui/badge";
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
        "这里专门看推荐标的或已持有标的的说明，帮你确认它是什么、现在大概在哪个位置，以及它和你组合的关系。",
        "This page focuses on a recommended or already-held security so you can confirm what it is, where it roughly trades, and how it fits the portfolio."
      )}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/recommendations" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "回推荐页", "Back to recommendations")}
              </Button>
              <Link href="/portfolio" className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/56">
                {pick(language, "回组合页", "Back to portfolio")}
              </Link>
            </div>
            <div className="flex items-start gap-4">
              <SecurityMark
                symbol={detail.security.symbol}
                assetClass={detail.security.assetClass}
                hint={detail.security.securityType === "Unknown" ? undefined : detail.security.securityType.slice(0, 3).toUpperCase()}
                className="h-16 w-16 rounded-[20px] text-sm"
              />
              <div className="space-y-2">
                <div>
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">{detail.security.symbol}</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.security.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.assetClass}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.sector}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.securityType}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.exchange}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detail.facts.map((fact, index) => (
              <StatBlock key={`security-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <LineChartCard
            title={pick(language, `${detail.security.symbol} 近 6 个月参考走势`, `Reference 6-month view for ${detail.security.symbol}`)}
            description={pick(
              language,
              "这里先给你一个参考走势，帮助你判断这支标的最近大概是稳着走还是波动更明显。完整历史回放后面再补。",
              "This gives you a reference trend so you can judge whether the security has looked steadier or more volatile lately. Full historical replay comes later."
            )}
            data={detail.performance}
            dataKey="value"
            color="#152238"
          />

          <SectionHeading
            title={pick(language, "先把这支标的认清楚", "Start by identifying this security")}
            description={pick(
              language,
              "先看它是什么、在哪个市场、价格大概在哪，再决定要不要真的把它放进组合里。",
              "Start with what it is, where it trades, and where the quote roughly sits before deciding whether it belongs in the portfolio."
            )}
          />
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
                title={pick(language, "你现在在哪些账户里持有它", "Where you currently hold it")}
                description={pick(
                  language,
                  "这里会把这支标的在不同账户里的分布拆开，方便你判断它是不是已经太重。",
                  "This breaks the symbol out across accounts so you can judge whether it is already too large."
                )}
              />
              <div className="grid gap-4">
                {detail.relatedHoldings.map((holding) => (
                  <Card key={holding.id}>
                    <CardContent className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-[color:var(--foreground)]">{holding.account}</p>
                        <p className="text-sm text-[color:var(--muted-foreground)]">
                          {holding.symbol} · {holding.name}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "当前估值", "Current value")} value={holding.value} />
                        <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "占整个组合多少", "Share of total portfolio")} value={holding.portfolioShare} />
                        <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "占这个账户多少", "Share inside this account")} value={holding.accountShare} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[color:var(--foreground)]">{holding.gainLoss}</span>
                        <Button href={holding.href} variant="secondary" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                          {pick(language, "打开这笔持仓详情", "Open holding detail")}
                        </Button>
                      </div>
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "这页适合拿来确认什么", "What this page is best for")}</p>
                <Badge variant={detail.security.freshnessVariant}>
                  {detail.relatedHoldings.length > 0 ? pick(language, "已持有", "Already held") : pick(language, "候选标的", "Candidate")}
                </Badge>
              </div>
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {pick(
                  language,
                  detail.relatedHoldings.length > 0
                    ? "先确认它现在值多少、放在哪些账户里，再决定要不要继续加。"
                    : "先确认它是什么、在哪个市场、最近价格大概在哪，再决定要不要真的买它。",
                  detail.relatedHoldings.length > 0
                    ? "Use this page to confirm current value, account placement, and whether adding more still makes sense."
                    : "Use this page to confirm what the security is, where it trades, and roughly where it is pricing before you buy."
                )}
              </div>
              <Button href="/recommendations" variant="secondary" className="w-full" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "回推荐页继续看", "Back to recommendations")}
              </Button>
              <Button href="/portfolio" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "去组合页对照着看", "Compare it inside the portfolio")}
              </Button>
            </CardContent>
          </Card>
        </StickyRail>
      </div>
    </AppShell>
  );
}
