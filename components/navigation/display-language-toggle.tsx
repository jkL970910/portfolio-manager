"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  language: DisplayLanguage;
  flag: string;
  label: string;
  title: string;
}> = [
  { language: "zh", flag: "🇨🇳", label: "中文", title: "切换到中文" },
  { language: "en", flag: "🇺🇸", label: "EN", title: "Switch to English" }
];

export function DisplayLanguageToggle({ language }: { language: DisplayLanguage }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "error"; message: string }>({
    type: "idle",
    message: ""
  });

  function updateLanguage(nextLanguage: DisplayLanguage) {
    if (nextLanguage === language) {
      return;
    }

    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/settings/display-language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLanguage })
      });
      const payload = await safeJson(response);

      if (!response.ok) {
        setStatus({
          type: "error",
          message: getApiErrorMessage(payload, language === "zh" ? "切换界面语言失败。" : "Failed to switch display language.")
        });
        return;
      }

      try {
        assertApiData<{ displayLanguage?: DisplayLanguage }>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null,
          language === "zh" ? "语言切换成功，但返回结果缺少可用数据。" : "Display language update succeeded but returned no usable payload."
        );
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : language === "zh" ? "切换界面语言失败。" : "Failed to switch display language."
        });
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-white/58 bg-white/52 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl">
        {OPTIONS.map((option) => {
          const active = option.language === language;
          return (
            <button
              key={option.language}
              type="button"
              onClick={() => updateLanguage(option.language)}
              disabled={isPending}
              title={option.title}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border text-lg transition-[background-color,border-color,transform,box-shadow]",
                active
                  ? "border-white/70 bg-white/84 shadow-[0_12px_22px_rgba(110,103,130,0.08)]"
                  : "border-transparent bg-white/18 hover:-translate-y-0.5 hover:border-white/34 hover:bg-white/34"
              )}
              aria-pressed={active}
              aria-label={option.label}
            >
              <span aria-hidden="true">{option.flag}</span>
            </button>
          );
        })}
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-white/45 bg-white/36 px-3 py-2 text-xs text-[color:var(--muted-foreground)] shadow-[var(--shadow-card)] backdrop-blur-xl xl:flex">
        <Languages className="h-3.5 w-3.5" />
        <span>{language === "zh" ? "界面语言" : "Interface language"}</span>
      </div>
      {status.type === "error" ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-xs text-[#8e2433] shadow-[var(--shadow-card)]">
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
