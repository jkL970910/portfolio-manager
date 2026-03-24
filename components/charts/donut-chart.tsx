"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#1947E5", "#2563EB", "#5B8CFF", "#0F9F6E", "#C98412"];

export function DonutChartCard({
  title,
  description,
  data,
  activeName,
  activeLabel
}: {
  title: string;
  description: string;
  data: Array<{ name: string; value: number }>;
  activeName?: string;
  activeLabel?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const hasData = data.length > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
        {activeName && activeLabel ? (
          <div className="mt-3 inline-flex w-fit rounded-full border border-[rgba(232,121,249,0.24)] bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(245,214,235,0.34),rgba(212,226,255,0.28))] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]">
            {activeLabel}: {activeName}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6 2xl:grid-cols-[minmax(240px,0.92fr)_minmax(220px,1.08fr)]">
        <div className="h-[240px] min-w-0">
          {isMounted && hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={4}>
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                      stroke={entry.name === activeName ? "rgba(232,121,249,0.88)" : "rgba(255,255,255,0.75)"}
                      strokeWidth={entry.name === activeName ? 4 : 1.5}
                      opacity={activeName && entry.name !== activeName ? 0.38 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-[24px] bg-[color:var(--card-muted)] px-6 text-center text-sm text-[color:var(--muted-foreground)]">
              {hasData ? "Loading chart..." : "No allocation data yet. Import accounts to populate this chart."}
            </div>
          )}
        </div>
        <div className="space-y-3">
          {hasData ? data.map((entry, index) => (
            <div
              key={entry.name}
              className={entry.name === activeName
                ? "flex items-center justify-between rounded-2xl border border-[rgba(232,121,249,0.35)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,214,235,0.42),rgba(212,226,255,0.32))] p-4"
                : "flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4"}
            >
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{entry.name}</span>
                  {entry.name === activeName && activeLabel ? (
                    <span className="inline-flex w-fit rounded-full border border-[rgba(232,121,249,0.2)] bg-white/78 px-2 py-0.5 text-[11px] font-medium text-[color:var(--foreground)]">
                      {activeLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="text-sm text-[color:var(--muted-foreground)]">{entry.value}%</span>
            </div>
          )) : (
            <div className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
              No category breakdown is available yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
