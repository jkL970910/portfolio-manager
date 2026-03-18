import type { Route } from "next";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-[color:var(--primary)] text-white hover:bg-[#1039c5]",
        secondary: "bg-[color:var(--card-muted)] text-[color:var(--foreground)] hover:bg-[#e8edf6]",
        ghost: "bg-transparent text-[color:var(--foreground)] hover:bg-[color:var(--card-muted)]"
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
