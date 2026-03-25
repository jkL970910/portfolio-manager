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
      activeId: activeAccountId,
      helperText: activeAccountId
        ? pick(language, '把鼠标放到圆环切片上，就能看这个账户的大致占比。', 'Hover a slice to see how much of the portfolio this account represents.')
        : pick(language, '把鼠标放到圆环切片上，就能看到具体是哪个账户以及它的大致占比。', 'Hover a slice to see which account it is and roughly how much of the portfolio sits there.'),
      noDataText: pick(language, '还没有账户分布数据。先导入账户，图里才会有内容。', 'No allocation data yet. Import accounts to populate this chart.'),
      activeFocusLabel: pick(language, '当前正在看的账户', 'Current account focus')
    }),
    [activeAccountId, accountInstanceAllocation, language]
  );

  return (
    <DonutChartCard
      title={config.title}
      description={config.description}
      data={config.data}
      activeId={config.activeId}
      helperText={config.helperText}
      noDataText={config.noDataText}
      activeFocusLabel={config.activeFocusLabel}
    />
  );
}
