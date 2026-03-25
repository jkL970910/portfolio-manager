'use client';

import { useMemo } from 'react';
import { DonutChartCard } from '@/components/charts/donut-chart';
import type { DisplayLanguage } from '@/lib/i18n/ui';
import { pick } from '@/lib/i18n/ui';

type AllocationRow = {
  id: string;
  name: string;
  value: number;
  detail?: string;
};

export function AccountBreakdownPanel({
  language,
  accountInstanceAllocation,
  activeAccountId
}: {
  language: DisplayLanguage;
  accountInstanceAllocation: AllocationRow[];
  activeAccountId?: string;
}) {
  const config = useMemo(
    () => ({
      title: pick(language, '钱现在具体分散在哪些账户里', 'Which specific accounts currently hold the money'),
      description: activeAccountId
        ? pick(language, '你当前锁定的账户会在图里高亮，其他账户会淡下去。', 'The account you locked onto stays highlighted while the rest fade back.')
        : pick(language, '这里直接按真实账户实例来分，不再把多个 TFSA 或 FHSA 混在一起。', 'This chart always uses real account instances so multiple TFSAs or FHSAs do not blur together.'),
      data: accountInstanceAllocation,
      activeId: activeAccountId
    }),
    [activeAccountId, accountInstanceAllocation, language]
  );

  return (
    <DonutChartCard
      title={config.title}
      description={config.description}
      data={config.data}
      activeId={config.activeId}
    />
  );
}
