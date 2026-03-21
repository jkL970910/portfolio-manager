import type { Route } from "next";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white/40",
  {
    variants: {
      variant: {
        primary: "border-white/45 bg-[linear-gradient(135deg,rgba(240,143,178,0.92),rgba(111,141,246,0.88))] text-white shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-white/60 hover:opacity-95 hover:shadow-[0_16px_32px_rgba(111,141,246,0.18)]",
        secondary: "border-white/55 bg-white/42 text-[color:var(--foreground)] backdrop-blur-xl hover:-translate-y-0.5 hover:bg-white/56 hover:shadow-[var(--shadow-card)]",
        ghost: "border-transparent bg-transparent text-[color:var(--foreground)] hover:bg-white/36 hover:backdrop-blur-lg"
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
