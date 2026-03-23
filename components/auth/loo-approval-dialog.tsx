"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function LooApprovalDialog({
  open,
  title,
  description,
  tone = "success",
  children,
  primaryAction,
  secondaryAction
}: {
  open: boolean;
  title: string;
  description: string;
  tone?: "success" | "error";
  children?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,24,45,0.36)] px-4">
      <div className="w-full max-w-4xl rounded-[32px] border border-white/65 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(248,236,244,0.88),rgba(233,241,255,0.84))] p-6 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
        <div className="grid gap-6 md:grid-cols-[1fr_180px] md:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {tone === "success" ? "Loo国颁证处" : "Loo皇审查处"}
            </p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">{description}</p>
          </div>
          <div className="justify-self-start md:justify-self-end">
            <Image
              src="/mascot/Loo_King.jpg"
              alt={tone === "success" ? "Loo Emperor approval" : "Loo Emperor review"}
              width={180}
              height={180}
              className="h-[180px] w-[180px] rounded-[28px] object-cover shadow-[var(--shadow-card)]"
              unoptimized
            />
          </div>
        </div>

        {children ? <div className="mt-6">{children}</div> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {secondaryAction ? (
            <Button type="button" variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {primaryAction ? (
            <Button type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
