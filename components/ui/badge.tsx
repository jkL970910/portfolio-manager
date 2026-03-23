import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_8px_18px_rgba(110,103,130,0.04)] backdrop-blur-lg",
  {
    variants: {
      variant: {
        primary: "border-white/52 bg-[rgba(240,143,178,0.14)] text-[#b4547c]",
        success: "border-white/52 bg-[rgba(58,164,122,0.12)] text-[color:var(--success)]",
        warning: "border-white/52 bg-[rgba(212,147,61,0.14)] text-[color:var(--warning)]",
        neutral: "border-white/52 bg-white/40 text-[color:var(--muted-foreground)]"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export function Badge({
  className,
  variant,
  children
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
