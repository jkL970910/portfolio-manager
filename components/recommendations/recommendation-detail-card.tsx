'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
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
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    whyThis: string[];
    whyNot: string[];
    constraints: {
      label: string;
      detail: string;
      variant: 'success' | 'warning' | 'neutral';
    }[];
    execution: {
      label: string;
      value: string;
    }[];
    relatedLinks?: {
      label: string;
      href: string;
    }[];
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
    return pick(language, '放对账户', 'Right account');
  }
  if (text.includes('风险') || text.includes('集中') || normalized.includes('risk') || normalized.includes('concentration')) {
    return pick(language, '先别继续加重', 'Reduce concentration');
  }
  if (text.includes('标的') || text.includes('候选') || normalized.includes('security') || normalized.includes('candidate')) {
    return pick(language, '主标的更顺手', 'Best security');
  }
  if (text.includes('FX') || text.includes('换汇') || normalized.includes('currency') || normalized.includes('fx')) {
    return pick(language, '少一点换汇成本', 'Less FX drag');
  }
  if (text.includes('目标') || text.includes('缺口') || normalized.includes('target') || normalized.includes('gap')) {
    return pick(language, '先补最大缺口', 'Close the biggest gap');
  }

  return tone === 'positive'
    ? pick(language, '这点在帮它排前面', 'Helps it rank first')
    : pick(language, '这点在压低别的路', 'Pushes other paths back');
}

function getHelpTerms(language: DisplayLanguage): HelpTerm[] {
  return [
    {
      label: pick(language, '什么叫放对账户', 'What “right account” means'),
      detail: pick(
        language,
        '系统会一起看账户类别、可用额度和放置效率，挑一个更适合接这笔钱的位置。',
        'The system checks account type, usable room, and placement efficiency before choosing the better home.'
      )
    },
    {
      label: pick(language, '为什么会提到换汇成本', 'Why FX cost matters'),
      detail: pick(
        language,
        '如果某条路会多触发明显换汇，系统通常会把它往后排，除非它真的更值得。',
        'If a path adds noticeable FX drag, the system usually pushes it back unless the trade-off is clearly worth it.'
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
      title: pick(language, '这条路为什么站得住', 'Why this path still holds up'),
      description: pick(
        language,
        '这些点说明它不是碰巧排在前面，而是真的比较顺手。',
        'These checks explain why it is not randomly first and still looks workable.'
      ),
      items: confirmed
    },
    {
      id: 'watch',
      title: pick(language, '执行前要留意什么', 'What to watch before acting'),
      description: pick(
        language,
        '这些点不一定会拦住你，但最好先知道。',
        'These do not always block the idea, but they are worth checking first.'
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
        label: pick(language, '系统为什么先选这条路', 'Why this path comes first'),
        shortTag: getShortDecisionTag(language, item, 'positive'),
        text: item
      })),
      ...priority.whyNot.map((item) => ({
        tone: 'caution' as const,
        label: pick(language, '系统为什么没先选别的', 'Why other paths were not first'),
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

            <div className="rounded-[24px] border border-white/55 bg-white/38 px-5 py-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                {pick(language, '这次优先买它', 'Lead security')}
              </p>
              <p className="mt-3 text-lg font-semibold leading-8 text-[color:var(--foreground)]">{priority.security}</p>
            </div>

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
                : pick(language, '看这条建议为什么排第一', 'Why this recommendation ranks first')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <SummaryBlock label={pick(language, '这笔是在补什么', 'What this is fixing')} value={priority.gapSummary} />
          <SummaryBlock label={pick(language, '先放去哪', 'Best account home')} value={priority.accountFit} />
          <SummaryBlock label={pick(language, '系统怎么看这条建议', 'How the system sees it')} value={priority.scoreline} />
          <SummaryBlock label={pick(language, '还有哪些能选', 'Other usable tickers')} value={alternativesText} />
        </div>

        {isExpanded ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <DetailBlock
                  label={pick(language, '如果按这条建议去投', 'If you follow this path')}
                  value={priority.security}
                  detail={priority.gapSummary}
                />
                <DetailBlock
                  label={pick(language, '还有哪些可以替代它', 'What could replace it')}
                  value={alternativesText}
                  detail={pick(language, '这些也能做同样的事，只是系统暂时没把它们排到最前面。', 'These can do a similar job, but the system did not rank them first this time.')}
                />
              </div>

              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, '系统是怎么想到这条路的', 'How the system got here')}</p>
                      <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                        {pick(
                          language,
                          '顺着看下面这几步，你就能知道系统为什么先选它、为什么别的路排在后面。',
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
                            ? pick(language, '在加分', 'Adds support')
                            : pick(language, '在压低别的路', 'Pushes others back')}
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
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, '如果你真的要执行，先看这些', 'Before you act, check this')}</p>
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

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-base font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{detail}</p> : null}
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
