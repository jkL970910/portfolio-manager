'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleGauge, RotateCcw, ShieldAlert } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PortfolioData } from '@/lib/contracts';
import type { DisplayLanguage } from '@/lib/i18n/ui';
import { pick } from '@/lib/i18n/ui';
import { LineChartCard } from '@/components/charts/line-chart';
import { RadarPreviewCard } from '@/components/charts/radar-preview';
import { AccountOverviewCard } from '@/components/portfolio/account-overview-card';
import { AccountBreakdownPanel } from '@/components/portfolio/account-breakdown-panel';
import { HoldingTable } from '@/components/portfolio/holding-table';
import { StickyRail } from '@/components/layout/sticky-rail';
import { RefreshPricesPanel } from '@/components/portfolio/refresh-prices-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';

type PortfolioWorkspaceProps = {
  data: PortfolioData;
  language: DisplayLanguage;
  initialFilters?: {
    account?: string;
    accountType?: string;
    holding?: string;
  };
};

export function PortfolioWorkspace({ data, language, initialFilters }: PortfolioWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const holdingsRef = useRef<HTMLDivElement | null>(null);
  const initialHolding = initialFilters?.holding
    ? data.holdings.find((holding) => holding.id === initialFilters.holding) ?? null
    : null;

  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    initialFilters?.account ?? initialHolding?.accountId ?? null
  );
  const [activeAccountTypeId, setActiveAccountTypeId] = useState<string | null>(
    initialFilters?.accountType ?? initialHolding?.accountType ?? null
  );
  const [activeHoldingId, setActiveHoldingId] = useState<string | null>(initialFilters?.holding ?? null);

  const activeAccount = useMemo(
    () => (activeAccountId ? data.accountCards.find((account) => account.id === activeAccountId) ?? null : null),
    [activeAccountId, data.accountCards]
  );
  const activeAccountContext = useMemo(
    () => (activeAccountId ? data.accountContexts.find((account) => account.id === activeAccountId) ?? null : null),
    [activeAccountId, data.accountContexts]
  );

  const filteredHoldings = useMemo(() => {
    const base = activeHoldingId
      ? data.holdings.filter((holding) => holding.id === activeHoldingId)
      : activeAccountId
        ? data.holdings.filter((holding) => holding.accountId === activeAccountId)
        : activeAccountTypeId
          ? data.holdings.filter((holding) => holding.accountType === activeAccountTypeId)
          : data.holdings;

    return base.map((holding) => ({
      ...holding,
      highlighted: Boolean(activeHoldingId || activeAccountId || activeAccountTypeId),
      highlightLabel: activeHoldingId
        ? pick(language, '这是健康页重点点名的一笔', 'Highlighted from health detail')
        : activeAccountId
          ? pick(language, '这是当前账户里的持仓', 'Holding inside the current account')
          : activeAccountTypeId
            ? pick(language, '这是当前账户类别里的持仓', 'Holding inside the current account type')
            : undefined
    }));
  }, [activeAccountId, activeAccountTypeId, activeHoldingId, data.holdings, language]);

  const currentPerformance = activeAccountContext?.performance ?? data.performance;
  const currentHealth = activeAccountContext?.healthScore ?? data.healthScore;
  const currentSummaryPoints = activeAccountContext?.summaryPoints ?? data.summaryPoints;
  const currentHealthHref = activeAccountId ? `/portfolio/health?account=${activeAccountId}` : '/portfolio/health';
  const currentStatusTitle = activeAccountContext
    ? pick(language, `${activeAccountContext.name} 现在大概是什么状态`, `How ${activeAccountContext.name} looks right now`)
    : pick(language, '组合现在大概稳不稳', 'How stable the portfolio looks right now');
  const currentStatusDescription = activeAccountContext
    ? pick(
        language,
        `现在做得最好的是 ${activeAccountContext.healthScore.strongestDimension}，最该先修的是 ${activeAccountContext.healthScore.weakestDimension}。`,
        `Best area right now: ${activeAccountContext.healthScore.strongestDimension}. First area to fix: ${activeAccountContext.healthScore.weakestDimension}.`
      )
    : pick(
        language,
        `现在做得最好的是 ${data.healthScore.strongestDimension}，最需要先修的是 ${data.healthScore.weakestDimension}。`,
        `Best area right now: ${data.healthScore.strongestDimension}. The area that needs attention first: ${data.healthScore.weakestDimension}.`
      );

  function syncUrl(next: { account?: string | null; accountType?: string | null; holding?: string | null }) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    ['account', 'accountType', 'holding'].forEach((key) => params.delete(key));
    if (next.account) params.set('account', next.account);
    if (next.accountType) params.set('accountType', next.accountType);
    if (next.holding) params.set('holding', next.holding);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleSelectOverall() {
    setActiveAccountId(null);
    setActiveAccountTypeId(null);
    setActiveHoldingId(null);
    syncUrl({ account: null, accountType: null, holding: null });
  }

  function handleSelectAccount(accountId: string, accountTypeId: string) {
    if (activeAccountId === accountId && !activeHoldingId) {
      handleSelectOverall();
      return;
    }
    setActiveAccountId(accountId);
    setActiveAccountTypeId(accountTypeId);
    setActiveHoldingId(null);
    syncUrl({ account: accountId, accountType: null, holding: null });
  }

  function handleFocusHoldings(accountId: string, accountTypeId: string) {
    setActiveAccountId(accountId);
    setActiveAccountTypeId(accountTypeId);
    setActiveHoldingId(null);
    syncUrl({ account: accountId, accountType: null, holding: null });
    requestAnimationFrame(() => {
      holdingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <LineChartCard
          title={
            activeAccountContext
              ? pick(language, `${activeAccountContext.name} 近 6 个月大概怎么走`, `How ${activeAccountContext.name} has moved over the last 6 months`)
              : pick(language, '近 6 个月大概怎么走', 'How it has moved over the last 6 months')
          }
          description={
            activeAccountContext
              ? pick(language, '这里先看这个账户自己大概是稳着往上，还是波动比较大。', 'Start by checking whether this account has been moving steadily or swinging around more than expected.')
              : pick(language, '先看整体是稳着往上，还是波动比较大。', 'Use this to see whether the portfolio has been moving steadily or swinging around more than you expected.')
          }
          data={currentPerformance}
          dataKey="value"
          color="#152238"
        />

        <SectionHeading
          title={pick(language, '再看账户结构', 'Then look at the account structure')}
          description={pick(language, '点账户卡本身会切换整页上下文；卡片按钮只负责把你带到下面的持仓表。', 'Clicking an account card switches the whole page context; the card button only jumps you down to the holdings table.')}
        />
        <div className="space-y-4">
          {data.accountCards.map((account) => (
            <AccountOverviewCard
              key={account.id}
              language={language}
              name={account.name}
              typeLabel={account.typeLabel}
              institution={account.institution}
              currency={account.currency}
              value={account.value}
              share={account.share}
              room={account.room}
              topHoldings={account.topHoldings}
              detailHref={`/portfolio/account/${account.id}`}
              highlighted={Boolean((activeAccountId && account.id === activeAccountId) || (!activeAccountId && activeAccountTypeId && account.typeId === activeAccountTypeId))}
              onSelect={() => handleSelectAccount(account.id, account.typeId)}
              onViewHoldings={() => handleFocusHoldings(account.id, account.typeId)}
            />
          ))}
        </div>

        <SectionHeading
          title={pick(language, '最后再看持仓明细', 'Finally drill into the holdings')}
          description={pick(language, '这里会跟着你当前选中的整体或账户一起变化。', 'This table follows the overall or account context you have selected above.')}
        />
        <div ref={holdingsRef}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeAccount
                  ? pick(language, `${activeAccount.name} 里的持仓`, `Holdings inside ${activeAccount.name}`)
                  : pick(language, '全部持仓', 'All holdings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeHoldingId || activeAccountId || activeAccountTypeId ? (
                <div className="mb-4 flex flex-col gap-3 rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {activeHoldingId
                        ? pick(language, '当前只显示一笔重点持仓。', 'Currently focused on one holding.')
                        : activeAccount
                          ? pick(language, `当前只显示 ${activeAccount.name} 里的持仓。`, `Currently focused on holdings inside ${activeAccount.name}.`)
                          : activeAccountTypeId
                            ? pick(language, '当前只显示这一类账户里的持仓。', 'Currently focused on holdings inside this account type.')
                            : null}
                    </p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {pick(language, '如果想回到整体，点右侧栏里的“回到整体组合”就行。', 'Use the button in the right sidebar to go back to the full portfolio.')}
                    </p>
                  </div>
                </div>
              ) : null}
              <HoldingTable holdings={filteredHoldings} language={language} />
            </CardContent>
          </Card>
        </div>
      </div>

      <StickyRail>
        <Card>
          <CardHeader>
            <CardTitle>
              {activeAccountId
                ? pick(language, '你现在正在看这个账户', 'You are now looking at this account')
                : pick(language, '你现在正在看整体组合', 'You are now looking at the full portfolio')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAccount ? (
              <>
                <div className="rounded-[22px] border border-white/55 bg-white/40 p-4 text-sm text-[color:var(--muted-foreground)]">
                  <p className="font-semibold text-[color:var(--foreground)]">{activeAccount.name}</p>
                  <p className="mt-2">{activeAccount.share}</p>
                </div>
                <Button type="button" variant="secondary" className="w-full" leadingIcon={<RotateCcw className="h-4 w-4" />} onClick={handleSelectOverall}>
                  {pick(language, '回到整体组合', 'Back to full portfolio')}
                </Button>
              </>
            ) : (
              <div className="rounded-[22px] border border-white/55 bg-white/40 p-4 text-sm text-[color:var(--muted-foreground)]">
                {pick(language, '现在看到的是所有账户加总后的整体情况。想单独看某个账户时，直接点左侧的账户卡。', 'You are looking at the full portfolio. Click an account card on the left if you want to focus on one account.')}
              </div>
            )}
            {currentSummaryPoints.map((point) => (
              <div key={point} className="rounded-[22px] border border-white/55 bg-white/40 p-4 text-sm text-[color:var(--muted-foreground)]">
                {point}
              </div>
            ))}
          </CardContent>
        </Card>

        <RadarPreviewCard
          title={currentStatusTitle}
          status={`${currentHealth.score}/100 · ${currentHealth.status}`}
          description={currentStatusDescription}
          data={currentHealth.radar}
          href={currentHealthHref}
          ctaLabel={
            activeAccountId
              ? pick(language, '去看这个账户哪里需要先修', 'See what this account needs first')
              : pick(language, '去看组合哪里需要先修', 'See what needs attention first')
          }
        />

        <AccountBreakdownPanel
          language={language}
          accountInstanceAllocation={data.accountInstanceAllocation}
          activeAccountId={activeAccountId ?? undefined}
        />

        <Card>
          <CardHeader>
            <CardTitle>{pick(language, '你现在可以继续打开这些地方', 'From here, you can open these next')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RefreshPricesPanel
              language={language}
              lastRefreshed={data.quoteStatus.lastRefreshed}
              freshness={data.quoteStatus.freshness}
              coverage={data.quoteStatus.coverage}
            />
            <Button href={currentHealthHref} variant="secondary" className="w-full" leadingIcon={<ShieldAlert className="h-4 w-4" />}>
              {activeAccountId
                ? pick(language, '看这个账户的健康详情', 'Open this account health report')
                : pick(language, '看组合健康详情', 'Open portfolio health report')}
            </Button>
            <Button href="/recommendations" variant="secondary" className="w-full" leadingIcon={<CircleGauge className="h-4 w-4" />}>
              {activeAccountId
                ? pick(language, '看看这个账户会怎样影响下一笔建议', 'See how this account affects the next recommendation')
                : pick(language, '看看下一笔钱怎么投', 'See where the next contribution should go')}
            </Button>
            <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
              {pick(language, '打开推荐页', 'Open recommendations')}
            </Button>
          </CardContent>
        </Card>
      </StickyRail>
    </div>
  );
}
