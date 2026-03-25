'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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
  headerActions
}: {
  title: string;
  description: string;
  data: DonutDatum[];
  activeId?: string;
  headerActions?: React.ReactNode;
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
      <CardContent className="grid gap-6 xl:grid-cols-1 2xl:grid-cols-[minmax(220px,0.9fr)_minmax(210px,1.1fr)]">
        <div className="h-[220px] min-w-0">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={4}>
                  {data.map((entry, index) => {
                    const entryId = entry.id ?? entry.name;
                    const isActive = entryId === activeId;
                    return (
                      <Cell
                        key={entryId}
                        fill={COLORS[index % COLORS.length]}
                        stroke={isActive ? 'rgba(232,121,249,0.88)' : 'rgba(255,255,255,0.75)'}
                        strokeWidth={isActive ? 4 : 1.5}
                        opacity={activeId && !isActive ? 0.38 : 1}
                      />
                    );
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-[24px] bg-[color:var(--card-muted)] px-6 text-center text-sm text-[color:var(--muted-foreground)]">
              No allocation data yet. Import accounts to populate this chart.
            </div>
          )}
        </div>
        <div className="space-y-3">
          {hasData ? (
            data.map((entry, index) => {
              const entryId = entry.id ?? entry.name;
              const isActive = entryId === activeId;
              return (
                <div key={entryId} className="group relative" tabIndex={0}>
                  <div
                    className={isActive
                      ? 'flex items-center justify-between rounded-2xl border border-[rgba(232,121,249,0.35)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,214,235,0.42),rgba(212,226,255,0.32))] px-4 py-3'
                      : 'flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-white/22 px-4 py-3'}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{entry.name}</p>
                        {entry.detail ? <p className="truncate text-xs text-[color:var(--muted-foreground)]">{entry.detail}</p> : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-[color:var(--muted-foreground)]">{entry.value}%</span>
                  </div>
                  <div className="pointer-events-none absolute inset-x-3 top-full z-30 mt-2 hidden rounded-[22px] border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(245,214,235,0.78),rgba(212,226,255,0.72))] p-4 text-sm shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl group-hover:block group-focus-within:block">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <p className="font-semibold text-[color:var(--foreground)]">{entry.name}</p>
                    </div>
                    {entry.detail ? <p className="mt-3 text-[color:var(--muted-foreground)]">{entry.detail}</p> : null}
                    <p className="mt-3 text-[color:var(--foreground)]">{entry.value}%</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
              No category breakdown is available yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
