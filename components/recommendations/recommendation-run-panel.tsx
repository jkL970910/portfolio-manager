"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RecommendationRunPanel({ initialContributionAmount }: { initialContributionAmount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contributionAmount, setContributionAmount] = useState(initialContributionAmount || 5000);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  function generateRun() {
    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/recommendations/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionAmountCad: Number(contributionAmount) })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Failed to generate recommendation run." });
        return;
      }
      setStatus({ type: "success", message: `Recommendation run generated for ${Number(contributionAmount).toLocaleString("en-CA")} CAD.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Generate new recommendation run</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">This recomputes ranked funding priorities from current holdings and saved preferences.</p>
        </div>
        <Badge variant="primary">POST /api/recommendations/runs</Badge>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">Contribution amount (CAD)</span>
        <input
          type="number"
          min={1}
          value={contributionAmount}
          onChange={(event) => setContributionAmount(Number(event.target.value))}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
        />
      </label>
      {status.type !== "idle" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          {status.message}
        </div>
      ) : null}
      <Button type="button" onClick={generateRun} disabled={isPending} leadingIcon={<Wand2 className="h-4 w-4" />}>
        {isPending ? "Generating..." : "Generate recommendation run"}
      </Button>
    </div>
  );
}
