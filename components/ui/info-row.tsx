import { cn } from "@/lib/utils";

type InfoRowProps = {
  icon: React.ReactNode;
  text: string;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
};

const toneClasses: Record<NonNullable<InfoRowProps["tone"]>, string> = {
  default: "border-[color:var(--border)] bg-white/42 text-[color:var(--muted-foreground)]",
  success: "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]",
  warning: "border-[#e8d6a8] bg-[#fff9e8] text-[#8b6325]",
  danger: "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"
};

export function InfoRow({ icon, text, tone = "default", className }: InfoRowProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[22px] border px-4 py-4 text-sm leading-6 backdrop-blur-md",
        toneClasses[tone],
        className
      )}
    >
      <div className="pt-0.5">{icon}</div>
      <p>{text}</p>
    </div>
  );
}
