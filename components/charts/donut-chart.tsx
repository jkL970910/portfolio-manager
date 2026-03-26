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
  noDataText
}: {
  title: string;
  description: string;
  data: DonutDatum[];
  activeId?: string;
  headerActions?: ReactNode;
  helperText?: string;
  noDataText?: string;
}) {
  const hasData = data.length > 0;

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mx-auto h-[280px] max-w-[320px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={104}
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

        {hasData ? (
          <div className="rounded-[20px] border border-white/55 bg-white/30 px-4 py-3 text-xs leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
            {helperText ?? 'Hover a slice to see which account it represents and roughly how much of the portfolio sits there.'}
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
