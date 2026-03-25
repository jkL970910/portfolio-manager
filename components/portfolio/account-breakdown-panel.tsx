"use client";

import { useEffect, useMemo, useState } from "react";
import { DonutChartCard } from "@/components/charts/donut-chart";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

type AllocationRow = {
  id: string;
  name: string;
  value: number;
  detail?: string;
};

export function AccountBreakdownPanel({
  language,
  accountTypeAllocation,
  accountInstanceAllocation,
  activeAccountTypeId,
  activeAccountId
}: {
  language: DisplayLanguage;
  accountTypeAllocation: AllocationRow[];
  accountInstanceAllocation: AllocationRow[];
  activeAccountTypeId?: string;
  activeAccountId?: string;
}) {
  const [mode, setMode] = useState<"type" | "instance">(activeAccountId ? "instance" : "type");

  useEffect(() => {
    if (activeAccountId) {
      setMode("instance");
      return;
    }
    if (activeAccountTypeId) {
      setMode("type");
    }
  }, [activeAccountId, activeAccountTypeId]);

  const config = useMemo(() => {
    if (mode === "instance") {
      return {
        title: pick(language, "钱分散在具体哪些账户里", "Which specific accounts currently hold the money"),
        description: pick(language, "先看每一个真实账户各装了多少钱，避免多个 TFSA 或 FHSA 混在一起看不清。", "Use this to see each real account separately so multiple TFSAs or FHSAs do not blur together."),
        data: accountInstanceAllocation,
        activeId: activeAccountId,
        activeLabel: activeAccountId ? pick(language, "当前命中的账户", "Matched account") : undefined
      };
    }

    return {
      title: pick(language, "钱先按账户类别分在哪些篮子里", "How the money is split across account types"),
      description: pick(language, "先看 TFSA、RRSP、FHSA、应税账户哪一类装得最重，再决定要不要往下看具体账户。", "Start with TFSA, RRSP, FHSA, and taxable buckets before drilling into individual accounts."),
      data: accountTypeAllocation,
      activeId: activeAccountTypeId,
      activeLabel: activeAccountTypeId ? pick(language, "当前命中的类别", "Matched type") : undefined
    };
  }, [activeAccountId, activeAccountTypeId, accountInstanceAllocation, accountTypeAllocation, language, mode]);

  return (
    <DonutChartCard
      title={config.title}
      description={config.description}
      data={config.data}
      activeId={config.activeId}
      activeLabel={config.activeLabel}
      headerActions={
        <div className="inline-flex rounded-full border border-white/60 bg-white/44 p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMode("type")}
            className={mode === "type"
              ? "rounded-full bg-white px-3 py-2 text-xs font-semibold text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(110,103,130,0.08)]"
              : "rounded-full px-3 py-2 text-xs font-semibold text-[color:var(--muted-foreground)]"}
          >
            {pick(language, "按类别看", "By type")}
          </button>
          <button
            type="button"
            onClick={() => setMode("instance")}
            className={mode === "instance"
              ? "rounded-full bg-white px-3 py-2 text-xs font-semibold text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(110,103,130,0.08)]"
              : "rounded-full px-3 py-2 text-xs font-semibold text-[color:var(--muted-foreground)]"}
          >
            {pick(language, "按账户看", "By account")}
          </button>
        </div>
      }
    />
  );
}
