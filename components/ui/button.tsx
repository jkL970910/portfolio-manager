import type { Route } from "next";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white/40",
  {
    variants: {
      variant: {
        primary: "border-white/48 bg-[linear-gradient(135deg,rgba(240,143,178,0.9),rgba(111,141,246,0.84))] text-white shadow-[0_14px_30px_rgba(111,141,246,0.14)] hover:-translate-y-0.5 hover:border-white/62 hover:opacity-95 hover:shadow-[0_18px_34px_rgba(111,141,246,0.16)]",
        secondary: "border-white/60 bg-white/46 text-[color:var(--foreground)] backdrop-blur-xl shadow-[0_10px_24px_rgba(110,103,130,0.06)] hover:-translate-y-0.5 hover:bg-white/58 hover:shadow-[0_14px_28px_rgba(110,103,130,0.08)]",
        ghost: "border-transparent bg-transparent text-[color:var(--foreground)] hover:bg-white/32 hover:backdrop-blur-lg"
      }
    },
    defaultVariants: {
      variant: "primary"
    }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    href?: Route;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
  };

export function Button({
  className,
  variant,
  href,
  children,
  leadingIcon,
  trailingIcon,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant }), className);

  const content = (
    <>
      {leadingIcon}
      {children}
      {trailingIcon}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {content}
    </button>
  );
}
