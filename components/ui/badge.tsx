import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        primary: "bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
        success: "bg-[rgba(15,159,110,0.12)] text-[color:var(--success)]",
        warning: "bg-[rgba(201,132,18,0.12)] text-[color:var(--warning)]",
        neutral: "bg-[color:var(--card-muted)] text-[color:var(--muted-foreground)]"
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
