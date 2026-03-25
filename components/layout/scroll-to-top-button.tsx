'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 320);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(245,214,235,0.72),rgba(212,226,255,0.68))] text-[color:var(--foreground)] shadow-[0_16px_34px_rgba(110,103,130,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(110,103,130,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
