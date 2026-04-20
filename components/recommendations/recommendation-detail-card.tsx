'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { pick, type DisplayLanguage } from '@/lib/i18n/ui';

type RecommendationDetailCardProps = {
  language: DisplayLanguage;
  index: number;
  priority: {
    id: string;
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    security: string;
    securityHref?: string;
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    alternativeLinks?: { label: string; href: string }[];
    whyThis: string[];
    whyNot: string[];
    constraints: {
      label: string;
      detail: string;
      variant: 'success' | 'warning' | 'neutral';
    }[];
    execution: { label: string; value: string }[];
    relatedLinks?: { label: string; href: string }[];
  };
  expanded?: boolean;
  onToggle?: () => void;
};

type DecisionStep = {
  tone: 'positive' | 'caution';
  label: string;
  shortTag: string;
  text: string;
};

type HelpTerm = {
  label: string;
  detail: string;
};

function getShortDecisionTag(language: DisplayLanguage, text: string, tone: 'positive' | 'caution') {
  const normalized = text.toLowerCase();

  if (text.includes('账户') || normalized.includes('account')) {
    return pick(language, '找对账户', 'Right account');
  }
  if (text.includes('风险') || text.includes('集中') || normalized.includes('risk') || normalized.includes('concentration')) {
    return pick(language, '分散风险', 'Spread risk');
  }
  if (text.includes('标的') || text.includes('候选') || normalized.includes('security') || normalized.includes('candidate')) {
    return pick(language, '挑对标的', 'Best security');
  }
  if (text.includes('FX') || text.includes('换汇') || normalized.includes('currency') || normalized.includes('fx')) {
    return pick(language, '少吃换汇', 'Less FX drag');
  }
  if (text.includes('目标') || text.includes('缺口') || normalized.includes('target') || normalized.includes('gap')) {
    return pick(language, '先补缺口', 'Close the gap');
  }

  return tone === 'positive'
    ? pick(language, '给这条路加分', 'Supports this path')
    : pick(language, '把别的路往后压', 'Pushes other paths back');
}

function getHelpTerms(language: DisplayLanguage): HelpTerm[] {
  return [
    {
      label: pick(language, '什么叫账户更顺手', 'What “better account fit” means'),
      detail: pick(
        language,
        'Loo皇会一起看账户类型、剩余额度和放进去以后是否更顺手，然后再决定这笔钱先落在哪个账户。',
        'The system checks account type, usable room, and placement fit before choosing the better account home.'
      )
    },
    {
      label: pick(language, '为什么要看换汇成本', 'Why FX friction matters'),
      detail: pick(
        language,
        '如果一条路要额外换汇，Loo皇会把这部分摩擦一起算进去；除非值得，不然通常不会让它排太前。',
        'If a path adds extra FX friction, the system factors that in and usually pushes it back unless the trade-off is clearly worth it.'
      )
    }
  ];
}

function groupConstraints(
  constraints: RecommendationDetailCardProps['priority']['constraints'],
  language: DisplayLanguage
) {
  const confirmed = constraints.filter((item) => item.variant !== 'warning');
  const watch = constraints.filter((item) => item.variant === 'warning');

  return [
    {
      id: 'confirmed',
      title: pick(language, '这条路为什么还站得住', 'Why this path still holds up'),
      description: pick(
        language,
        '这些点说明它不是碰巧排在前面，而是真的比较顺。',
        'These checks explain why the path still looks workable instead of randomly ending up first.'
      ),
      items: confirmed
    },
    {
      id: 'watch',
      title: pick(language, 'Loo皇还要你留意什么', 'What still needs your judgment'),
      description: pick(
        language,
        '这些不一定会直接拦住这条路，但动手前最好先看一眼。',
        'These do not always block the idea, but they are worth checking before you act.'
      ),
      items: watch
    }
  ].filter((group) => group.items.length > 0);
}

export function RecommendationDetailCard({
  language,
  index,
  priority,
  expanded,
  onToggle
}: RecommendationDetailCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);

  const isExpanded = expanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded((current) => !current));

  const decisionTrace = useMemo<DecisionStep[]>(
    () => [
      ...priority.whyThis.map((item) => ({
        tone: 'positive' as const,
        label: pick(language, 'Loo皇为什么先点这条路', 'Why this path comes first'),
        shortTag: getShortDecisionTag(language, item, 'positive'),
        text: item
      })),
      ...priority.whyNot.map((item) => ({
        tone: 'caution' as const,
        label: pick(language, 'Loo皇为什么没先点别的', 'Why other paths were not first'),
        shortTag: getShortDecisionTag(language, item, 'caution'),
        text: item
      }))
    ],
    [language, priority.whyNot, priority.whyThis]
  );

  const helpTerms = useMemo(() => getHelpTerms(language), [language]);
  const constraintGroups = useMemo(() => groupConstraints(priority.constraints, language), [language, priority.constraints]);
  const shouldCollapseTrace = decisionTrace.length > 3;
  const visibleTrace = shouldCollapseTrace && !isTraceExpanded ? decisionTrace.slice(0, 3) : decisionTrace;
  const alternativesText = priority.alternatives.length > 0 ? priority.alternatives.join(' · ') : priority.tickers;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 px-5 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="primary">#{index + 1}</Badge>
              <h3 className="text-2xl font-semibold text-[color:var(--foreground)]">{priority.assetClass}</h3>
            </div>

            {priority.securityHref ? (
              <Link
                href={priority.securityHref}
                className="group block rounded-[24px] border border-white/55 bg-white/38 px-5 py-4 backdrop-blur-md transition hover:border-[rgba(240,143,178,0.32)] hover:bg-white/56"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {pick(language, 'Loo皇这次先看它', 'Lead security')}
                </p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <p className="text-lg font-semibold leading-8 text-[color:var(--foreground)]">{priority.security}</p>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--primary)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{pick(language, '点开看看这支标的的完整说明', 'Open the full security brief')}</p>
              </Link>
            ) : (
              <div className="rounded-[24px] border border-white/55 bg-white/38 px-5 py-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {pick(language, 'Loo皇这次先看它', 'Lead security')}
                </p>
                <p className="mt-3 text-lg font-semibold leading-8 text-[color:var(--foreground)]">{priority.security}</p>
              </div>
            )}

            <p className="text-base leading-8 text-[color:var(--muted-foreground)]">{priority.description}</p>
          </div>

          <div className="rounded-[24px] border border-white/55 bg-white/42 p-5 text-right backdrop-blur-md">
            <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, '这笔建议投多少', 'Suggested amount')}</p>
            <p className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">{priority.amount}</p>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{priority.account}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleToggle}
              className="mt-5 w-full justify-between"
              trailingIcon={isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            >
              {isExpanded
                ? pick(language, '收起这条建议的细节', 'Hide recommendation detail')
                : pick(language, '看看 Loo皇为什么先点它', 'Why this recommendation ranks first')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <SummaryBlock label={pick(language, '这笔是在补什么', 'What this is fixing')} value={priority.gapSummary} />
          <SummaryBlock label={pick(language, '先放去哪', 'Best account home')} value={priority.accountFit} />
          <SummaryBlock label={pick(language, 'Loo皇怎么看这条建议', 'How the system sees it')} value={priority.scoreline} />
          <SummaryBlock
            label={pick(language, '还有哪些能选', 'Other usable tickers')}
            value={alternativesText}
            footer={priority.alternativeLinks?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {priority.alternativeLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/52 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[rgba(240,143,178,0.32)] hover:bg-white/72"
                  >
                    {item.label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                  </Link>
                ))}
              </div>
            ) : null}
          />
        </div>

        {isExpanded ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <DetailBlock
                  label={pick(language, '如果照这条路去做', 'If you follow this path')}
                  value={priority.security}
                  detail={priority.gapSummary}
                  href={priority.securityHref}
                  hrefLabel={priority.securityHref ? pick(language, '打开这支标的', 'Open this security') : undefined}
                />
                <DetailBlock
                  label={pick(language, '还有哪些可以替它', 'What could replace it')}
                  value={alternativesText}
                  detail={pick(language, '这些也能做差不多的事，只是这次没排到最前。', 'These can do a similar job, but the system did not rank them first this time.')}
                  footer={priority.alternativeLinks?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {priority.alternativeLinks.map((item) => (
                        <Link
                          key={`${priority.id}-${item.href}`}
                          href={item.href}
                          className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/52 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[rgba(240,143,178,0.32)] hover:bg-white/72"
                        >
                          {item.label}
                          <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                />
              </div>

              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, 'Loo皇是怎么想到这条路的', 'How the system got here')}</p>
                      <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                        {pick(
                          language,
                          '把这几步顺着看下来，你就会明白 Loo皇为什么先点这条路、为什么把别的方案往后放。',
                          'Read the steps below in order and you will see why this path moved ahead of the others.'
                        )}
                      </p>
                    </div>
                    {shouldCollapseTrace ? (
                      <Button type="button" variant="ghost" onClick={() => setIsTraceExpanded((current) => !current)} className="shrink-0">
                        {isTraceExpanded
                          ? pick(language, '收起完整解释', 'Collapse full explanation')
                          : pick(language, '展开完整解释', 'Show full explanation')}
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {helpTerms.map((term) => (
                      <HelpChip key={term.label} label={term.label} detail={term.detail} />
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {visibleTrace.map((step, traceIndex) => (
                    <div key={`${priority.id}-trace-${traceIndex}`} className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-semibold text-[color:var(--foreground)]">
                            {traceIndex + 1}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.label}</p>
                              <Badge variant={step.tone === 'positive' ? 'success' : 'warning'}>{step.shortTag}</Badge>
                            </div>
                            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{step.text}</p>
                          </div>
                        </div>
                        <Badge variant={step.tone === 'positive' ? 'success' : 'warning'}>
                          {step.tone === 'positive'
                            ? pick(language, '在给这条路加分', 'Adds support')
                            : pick(language, '在把别的路往后压', 'Pushes others back')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {constraintGroups.map((group) => (
                <div key={`${priority.id}-${group.id}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{group.title}</p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{group.description}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {group.items.map((constraint) => (
                      <div key={`${priority.id}-${group.id}-${constraint.label}`} className="rounded-[20px] border border-white/55 bg-white/42 px-4 py-3 backdrop-blur-md">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[color:var(--foreground)]">{constraint.label}</p>
                            <p className="mt-1 text-sm leading-7 text-[color:var(--muted-foreground)]">{constraint.detail}</p>
                          </div>
                          <Badge variant={constraint.variant}>
                            {constraint.variant === 'success'
                              ? pick(language, '看起来没问题', 'Looks fine')
                              : constraint.variant === 'warning'
                                ? pick(language, '这里要留意', 'Watch this')
                                : pick(language, '补充背景', 'Extra context')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, '真要动手前，Loo皇还想提醒你这些', 'Before you act, check this')}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {priority.execution.map((item) => (
                    <DetailBlock key={`${priority.id}-${item.label}`} label={item.label} value={item.value} />
                  ))}
                </div>
                {priority.relatedLinks?.length ? (
                  <div className="mt-4 space-y-2">
                    {priority.relatedLinks.map((link) => (
                      <Button key={`${priority.id}-${link.href}`} href={link.href} variant="secondary" className="w-full">
                        {link.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryBlock({ label, value, footer }: { label: string; value: string; footer?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-base font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
      {footer}
    </div>
  );
}

function DetailBlock({
  label,
  value,
  detail,
  href,
  hrefLabel,
  footer
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{detail}</p> : null}
      {href && hrefLabel ? (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--primary)] transition hover:opacity-80">
          {hrefLabel}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
      {footer}
    </div>
  );
}

function HelpChip({ label, detail }: HelpTerm) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/44 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] backdrop-blur-md"
      >
        <Info className="h-3.5 w-3.5 text-[color:var(--primary)]" />
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-[18px] border border-white/55 bg-white/92 p-3 text-xs leading-6 text-[color:var(--muted-foreground)] shadow-[var(--shadow-card)] backdrop-blur-md">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
