"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MascotAsset, type MascotAssetName } from "@/components/brand/mascot-asset";
import { cn } from "@/lib/utils";

type CitizenField = {
  label: string;
  value: string;
};

export function CitizenIdentityCard({
  title,
  subtitle,
  fields,
  idCode,
  mascotName,
  badge,
  className,
  children
}: {
  title: string;
  subtitle?: string;
  fields: CitizenField[];
  idCode: string;
  mascotName: MascotAssetName;
  badge?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-white/65 bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(238,245,255,0.58),rgba(255,232,242,0.56))] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)]",
        className
      )}
    >
      <div className="pointer-events-none absolute left-[-28px] top-[-34px] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(139,168,255,0.18),rgba(139,168,255,0))] blur-3xl" />
      <div className="pointer-events-none absolute right-[-24px] top-[18px] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(240,143,178,0.22),rgba(240,143,178,0))] blur-3xl" />

      <div className="relative z-10 grid gap-5 md:grid-cols-[1.1fr_180px] md:items-start">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{subtitle}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">{title}</h3>
            </div>
            {badge ? <Badge variant="primary">{badge}</Badge> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="rounded-[20px] border border-white/58 bg-white/46 px-4 py-3 backdrop-blur-xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{field.label}</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{field.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[22px] border border-white/58 bg-[linear-gradient(180deg,rgba(215,235,255,0.72),rgba(255,241,247,0.56))] px-4 py-3 backdrop-blur-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">ID</p>
            <p className="mt-2 text-base font-semibold tracking-[0.14em] text-[color:var(--foreground)]">{idCode}</p>
          </div>

          {children ? <div className="pt-2">{children}</div> : null}
        </div>

        <div className="justify-self-start md:justify-self-end">
          <MascotAsset name={mascotName} className="h-[180px] w-[180px] rounded-[26px]" sizes="180px" />
        </div>
      </div>
    </div>
  );
}
