"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LineChartCard({
  title,
  description,
  data,
  dataKey,
  color
}: {
  title: string;
  description: string;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
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
      <CardContent className="h-[320px]">
        {isMounted && hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(91,100,114,0.14)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#5b6472" fontSize={12} />
              <YAxis tickLine={false} axisLine={false} stroke="#5b6472" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl bg-[color:var(--card-muted)] px-6 text-center text-sm text-[color:var(--muted-foreground)]">
            {hasData ? "Loading chart..." : "Not enough history yet. Import more data to unlock trend analysis."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
