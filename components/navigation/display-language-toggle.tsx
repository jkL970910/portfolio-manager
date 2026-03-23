"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  language: DisplayLanguage;
  shortLabel: string;
  label: string;
}> = [
  { language: "zh", shortLabel: "CN", label: "中文" },
  { language: "en", shortLabel: "US", label: "English" }
];

export function DisplayLanguageToggle({ language }: { language: DisplayLanguage }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error"; message: string }>({
    type: "idle",
    message: ""
  });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const currentOption = OPTIONS.find((option) => option.language === language) ?? OPTIONS[0];

  function updateLanguage(nextLanguage: DisplayLanguage) {
    if (nextLanguage === language) {
      setIsOpen(false);
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

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        disabled={isPending}
        className="inline-flex items-center gap-3 rounded-full border border-white/58 bg-white/52 px-4 py-2.5 text-sm font-medium text-[color:var(--foreground)] shadow-[var(--shadow-card)] backdrop-blur-xl transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-white/68"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="inline-flex min-w-[44px] items-center justify-center rounded-full border border-white/62 bg-white/78 px-2 py-1 text-xs font-semibold tracking-[0.12em] text-[color:var(--foreground)]">
          {currentOption.shortLabel}
        </span>
        <span>{language === "zh" ? "界面语言" : "Interface"}</span>
        <ChevronDown className={cn("h-4 w-4 text-[color:var(--muted-foreground)] transition-transform", isOpen ? "rotate-180" : "")} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 min-w-[180px] rounded-[24px] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,244,251,0.84))] p-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
          {OPTIONS.map((option) => {
            const active = option.language === language;
            return (
              <button
                key={option.language}
                type="button"
                onClick={() => updateLanguage(option.language)}
                disabled={isPending}
                className={cn(
                  "flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,240,246,0.86))] text-[color:var(--foreground)]"
                    : "text-[color:var(--foreground)]/82 hover:bg-white/58"
                )}
                role="menuitem"
              >
                <span>{option.label}</span>
                <span className="rounded-full border border-white/62 bg-white/72 px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--muted-foreground)]">
                  {option.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {status.type === "error" ? (
        <div className="absolute right-0 top-[calc(100%+72px)] z-20 min-w-[220px] rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-xs text-[#8e2433] shadow-[var(--shadow-card)]">
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
