"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function LooTermsDialog({
  language = "zh",
  triggerLabel
}: {
  language?: DisplayLanguage;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[color:var(--secondary)] underline-offset-4 hover:underline"
      >
        {triggerLabel ?? pick(language, "查看 Loo国条例", "View Loo terms")}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,24,45,0.28)] px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/62 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(250,239,246,0.82),rgba(234,241,255,0.82))] p-6 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {pick(language, "Loo国条例", "Loo Terms")}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
              {pick(language, "加入宝库前，请先认清 Loo皇的规矩。", "Read the rules before entering the vault.")}
            </h3>
            <p className="mt-4 text-sm leading-7 text-[color:var(--foreground)]">
              {pick(
                language,
                "我自愿加入 Loo国，同意成为 Loo国子民，谨遵 Loo皇的英明领导，誓为 Loo国做大做强添砖加瓦。",
                "This oath is only shown in Chinese mode."
              )}
            </p>
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {pick(language, "我已知晓", "Close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
