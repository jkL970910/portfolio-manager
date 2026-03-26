'use client';

import { cn } from '@/lib/utils';

const TONES: Record<string, string> = {
  'Canadian Equity': 'bg-[linear-gradient(135deg,#7aa9ff,#5b8cff)] text-white',
  'US Equity': 'bg-[linear-gradient(135deg,#6f8df6,#3f63f0)] text-white',
  'International Equity': 'bg-[linear-gradient(135deg,#1db58b,#0f9f6e)] text-white',
  'Fixed Income': 'bg-[linear-gradient(135deg,#f1d8a1,#d4933d)] text-[color:var(--foreground)]',
  Cash: 'bg-[linear-gradient(135deg,#f5c7da,#f08fb2)] text-[color:var(--foreground)]'
};

function getLetters(symbol: string) {
  return symbol.replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() || '?';
}

export function SecurityMark({
  symbol,
  assetClass,
  className
}: {
  symbol: string;
  assetClass?: string;
  className?: string;
}) {
  const tone = (assetClass && TONES[assetClass]) || 'bg-[linear-gradient(135deg,#d9e4ff,#f5d6eb)] text-[color:var(--foreground)]';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/70 text-xs font-semibold tracking-[0.14em] shadow-[var(--shadow-card)]',
        tone,
        className
      )}
    >
      {getLetters(symbol)}
    </div>
  );
}
