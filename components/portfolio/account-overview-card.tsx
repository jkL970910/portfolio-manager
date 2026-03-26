'use client';

import { ArrowUpRight, Landmark, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DisplayLanguage } from '@/lib/i18n/ui';
import { pick } from '@/lib/i18n/ui';

type AccountOverviewCardProps = {
  language: DisplayLanguage;
  name: string;
  typeLabel: string;
  institution: string;
  currency: string;
  value: string;
  share: string;
  room: string;
  topHoldings: string[];
  highlighted?: boolean;
  detailHref?: `/portfolio/account/${string}`;
  onSelect?: () => void;
  onViewHoldings?: () => void;
};

export function AccountOverviewCard({
  language,
  name,
  typeLabel,
  institution,
  currency,
  value,
  share,
  room,
  topHoldings,
  highlighted,
  detailHref,
  onSelect,
  onViewHoldings
}: AccountOverviewCardProps) {
  return (
    <Card className={highlighted ? 'border-[rgba(232,121,249,0.34)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(245,214,235,0.44),rgba(212,226,255,0.34))]' : undefined}>
      <CardContent className="px-5 py-5">
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect?.();
            }
          }}
          className="cursor-pointer rounded-[22px] p-1 transition hover:bg-white/24 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_auto] xl:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/52 px-3 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                <Landmark className="h-3.5 w-3.5" />
                {typeLabel}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{name}</h3>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{institution} · {currency}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[20px] border border-white/55 bg-white/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{pick(language, '主要持仓', 'Top holdings')}</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                  {topHoldings.length > 0 ? topHoldings.join(' · ') : pick(language, '这个账户里还没有持仓', 'No holdings in this account yet')}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/55 bg-white/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{pick(language, '额度和状态', 'Room & status')}</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{room}</p>
              </div>
            </div>

            <div className="space-y-3 xl:min-w-[220px]">
              <div className="rounded-[20px] border border-white/55 bg-white/40 p-4 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{pick(language, '当前总值', 'Current value')}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{value}</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{share}</p>
              </div>
              <div className="grid gap-2">
                {detailHref ? (
                  <Button
                    href={detailHref}
                    variant="secondary"
                    className="w-full"
                    leadingIcon={<ArrowUpRight className="h-4 w-4" />}
                  >
                    {pick(language, '打开这个账户详情', 'Open account detail')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  leadingIcon={<Wallet className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewHoldings?.();
                  }}
                >
                  {pick(language, '查看账户里的持仓列表', "Jump to this account's holdings")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
