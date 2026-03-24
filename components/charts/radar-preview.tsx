"use client";

import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RadarPreviewCard({
  title,
  status,
  description,
  data,
  href = "/portfolio",
  ctaLabel = "Preview analysis"
}: {
  title: string;
  status: string;
  description: string;
  data: Array<{ dimension: string; value: number }>;
  href?: string;
  ctaLabel?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
        </div>
        <Badge variant="neutral">{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[240px]">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="rgba(91,100,114,0.18)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: "#5b6472", fontSize: 12 }} />
                <Radar dataKey="value" stroke="#1947E5" fill="#1947E5" fillOpacity={0.16} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-full bg-[color:var(--card-muted)]" />
          )}
        </div>
        <Button href={href} variant="secondary" className="w-full">
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
