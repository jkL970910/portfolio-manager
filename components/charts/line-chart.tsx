"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LineChartCard({
  title,
  description,
  data,
  dataKey,
  color,
  actions,
  rangeControls = false,
  valueFormat = "raw",
  currencyCode = "CAD",
  tooltipLabel = "value",
  tooltipValueFormatter
}: {
  title: string;
  description: string;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
  actions?: React.ReactNode;
  rangeControls?: boolean;
  valueFormat?: "raw" | "currency" | "percent";
  currencyCode?: string;
  tooltipLabel?: string;
  tooltipValueFormatter?: (value: number) => string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedRange, setSelectedRange] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL">("6M");
  const hasData = data.length > 0;

  const filteredData = useMemo(() => {
    if (!rangeControls) {
      return data;
    }

    const datedSeries = data.filter((point): point is typeof point & { rawDate: string } => typeof point.rawDate === "string");
    if (datedSeries.length < 2) {
      return data;
    }

    const end = new Date(datedSeries[datedSeries.length - 1].rawDate);
    const daysByRange: Record<Exclude<typeof selectedRange, "ALL">, number> = {
      "1D": 2,
      "1W": 8,
      "1M": 31,
      "3M": 92,
      "6M": 183,
      "1Y": 366
    };

    let filtered = selectedRange === "ALL"
      ? datedSeries
      : datedSeries.filter((point) => {
          const date = new Date(point.rawDate);
          const diffDays = (end.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= daysByRange[selectedRange];
        });

    if (filtered.length < 2) {
      filtered = datedSeries.slice(-Math.min(30, datedSeries.length));
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: selectedRange === "ALL" || selectedRange === "1Y" || selectedRange === "6M" ? undefined : "numeric",
      year: selectedRange === "ALL" ? "2-digit" : undefined
    });

    return filtered.map((point) => ({
      ...point,
      label: formatter.format(new Date(point.rawDate))
    }));
  }, [data, rangeControls, selectedRange]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function formatValue(value: number) {
    if (tooltipValueFormatter) {
      return tooltipValueFormatter(value);
    }
    if (valueFormat === "currency") {
      return `${currencyCode} $${value.toFixed(2)}`;
    }
    if (valueFormat === "percent") {
      return `${value.toFixed(1)}%`;
    }
    return value;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {rangeControls ? (
              <div className="inline-flex flex-wrap rounded-full border border-white/60 bg-white/56 p-1 backdrop-blur-md">
                {(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedRange(range)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      selectedRange === range
                        ? "bg-[linear-gradient(135deg,rgba(240,143,178,0.88),rgba(111,141,246,0.82))] text-white"
                        : "text-[color:var(--foreground)] hover:bg-white/72"
                    ].join(" ")}
                  >
                    {range === "ALL" ? "All" : range}
                  </button>
                ))}
              </div>
            ) : null}
            {actions}
          </div>
        </div>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
      </CardHeader>
      <CardContent className="h-[320px]">
        {isMounted && hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(91,100,114,0.14)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#5b6472" fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#5b6472"
                fontSize={12}
                tickFormatter={(value) => {
                  if (typeof value !== "number") {
                    return String(value);
                  }
                  if (valueFormat === "currency") {
                    return `${currencyCode} $${Math.round(value)}`;
                  }
                  if (valueFormat === "percent") {
                    return `${Math.round(value)}%`;
                  }
                  return String(value);
                }}
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value !== "number") {
                    return [value, tooltipLabel];
                  }
                  return [formatValue(value), tooltipLabel];
                }}
              />
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
