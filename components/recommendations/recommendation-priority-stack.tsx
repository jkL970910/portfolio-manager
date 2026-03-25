"use client";

import { useState } from "react";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { RecommendationDetailCard } from "@/components/recommendations/recommendation-detail-card";

type RecommendationPriorityStackProps = {
  language: DisplayLanguage;
  priorities: {
    id: string;
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    security: string;
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    whyThis: string[];
    whyNot: string[];
    constraints: {
      label: string;
      detail: string;
      variant: "success" | "warning" | "neutral";
    }[];
    execution: {
      label: string;
      value: string;
    }[];
  }[];
};

export function RecommendationPriorityStack({ language, priorities }: RecommendationPriorityStackProps) {
  const [expandedId, setExpandedId] = useState<string | null>(priorities[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {priorities.map((priority, index) => {
        const isExpanded = priority.id === expandedId;

        return (
          <RecommendationDetailCard
            key={priority.id}
            language={language}
            index={index}
            priority={priority}
            expanded={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : priority.id)}
          />
        );
      })}
    </div>
  );
}
