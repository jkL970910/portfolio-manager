'use client';

import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#1947E5', '#2563EB', '#5B8CFF', '#0F9F6E', '#C98412', '#F08FB2', '#6F8DF6'];

type DonutDatum = {
  id?: string;
  name: string;
  value: number;
  detail?: string;
};

export function DonutChartCard({
  title,
  description,
  data,
  activeId,
  headerActions,
  helperText,
  noDataText,
  className,
  legendMode = 'none',
  legendMaxItems = 6,
  chartHeight = 280,
  chartMaxWidth = 320,
  innerRadius = 72,
  outerRadius = 104
}: {
  title: string;
  description?: string;
  data: DonutDatum[];
  activeId?: string;
  headerActions?: ReactNode;
  helperText?: string;
  noDataText?: string;
  className?: string;
  legendMode?: 'none' | 'side';
  legendMaxItems?: number;
  chartHeight?: number;
  chartMaxWidth?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const hasData = data.length > 0;
  const legendItems = data.slice(0, legendMaxItems);

  return (
    <Card className={`overflow-visible ${className ?? ''}`.trim()}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{description}</p>
            ) : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className={legendMode === 'side' && hasData ? 'grid gap-3 md:grid-cols-[156px_minmax(0,1fr)] md:items-center' : ''}>
          <div className="mx-auto w-full" style={{ height: `${chartHeight}px`, width: `${chartMaxWidth}px`, maxWidth: '100%' }}>
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={5}
                    label={false}
                    labelLine={false}
                    isAnimationActive={false}
                  >
                    {data.map((entry, index) => {
                      const entryId = entry.id ?? entry.name;
                      const isActive = entryId === activeId;
                      return (
                        <Cell
                          key={entryId}
                          fill={COLORS[index % COLORS.length]}
                          stroke={isActive ? 'rgba(232,121,249,0.88)' : 'rgba(255,255,255,0.8)'}
                          strokeWidth={isActive ? 5 : 2}
                          opacity={activeId && !isActive ? 0.42 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip cursor={false} content={<DonutTooltip data={data} activeId={activeId} />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[24px] bg-[color:var(--card-muted)] px-6 text-center text-sm text-[color:var(--muted-foreground)]">
                {noDataText ?? 'No allocation data yet. Import accounts to populate this chart.'}
              </div>
            )}
          </div>

          {legendMode === 'side' && hasData ? (
            <div className="grid gap-2">
              {legendItems.map((entry, index) => {
                const entryId = entry.id ?? entry.name;
                const isActive = entryId === activeId;
                return (
                  <div
                    key={`legend-${entryId}`}
                    className={`flex items-center justify-between rounded-[16px] border px-3 py-2 text-sm backdrop-blur-md transition ${
                      isActive
                        ? 'border-[rgba(232,121,249,0.45)] bg-[rgba(255,255,255,0.52)]'
                        : 'border-white/55 bg-white/34'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <p className="truncate font-medium text-[color:var(--foreground)]">{entry.name}</p>
                      </div>
                      {entry.detail ? <p className="mt-1 truncate text-xs text-[color:var(--muted-foreground)]">{entry.detail}</p> : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[color:var(--foreground)]">{entry.value}%</p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {hasData && helperText ? (
          <div className="rounded-[20px] border border-white/55 bg-white/30 px-4 py-2 text-xs leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
            {helperText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DonutTooltip(
  props: TooltipProps<ValueType, NameType> & { data: DonutDatum[]; activeId?: string }
) {
  const { active, data } = props;
  const payload = (props as TooltipProps<ValueType, NameType> & { payload?: Array<{ payload?: DonutDatum }> }).payload;

  if (!active || !payload?.length) {
    return null;
  }

  const raw = payload[0]?.payload as DonutDatum | undefined;
  if (!raw) {
    return null;
  }

  const entryId = raw.id ?? raw.name;
  const colorIndex = data.findIndex((item) => (item.id ?? item.name) === entryId);
  const color = COLORS[(colorIndex >= 0 ? colorIndex : 0) % COLORS.length];
  return (
    <div className="w-[260px] rounded-[22px] border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,214,235,0.82),rgba(212,226,255,0.76))] p-4 text-sm shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <p className="font-semibold text-[color:var(--foreground)]">{raw.name}</p>
      </div>
      {raw.detail ? <p className="mt-3 text-[color:var(--muted-foreground)]">{raw.detail}</p> : null}
      <p className="mt-3 text-[color:var(--foreground)]">{raw.value}%</p>
    </div>
  );
}
