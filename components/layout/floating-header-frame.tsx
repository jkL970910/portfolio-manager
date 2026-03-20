"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function FloatingHeaderFrame({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-scrolled={isScrolled}
      className={cn(
        "group/header sticky top-4 z-40 mx-auto max-w-[1440px] overflow-visible rounded-[28px] border border-[color:var(--border)] bg-white/92 backdrop-blur-md shadow-[var(--shadow-soft)] transition-[transform,box-shadow,background-color] duration-200",
        isScrolled ? "shadow-[0_16px_40px_rgba(15,23,42,0.12)]" : "",
        className
      )}
    >
      {children}
    </header>
  );
}
