"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#1947E5", "#2563EB", "#5B8CFF", "#0F9F6E", "#C98412"];

export function DonutChartCard({
  title,
  description,
  data
}: {
  title: string;
  description: string;
  data: Array<{ name: string; value: number }>;
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
      </CardHeader>
      <CardContent className="grid gap-6 2xl:grid-cols-[minmax(240px,0.92fr)_minmax(220px,1.08fr)]">
        <div className="h-[240px] min-w-0">
          {isMounted && hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={4}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
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
            <div key={entry.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-sm font-medium">{entry.name}</span>
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
