import type { ReactNode } from 'react';

// A flat panel band (no card-in-card). Uses bg-primary-ish neutral.
export function PanelSection({
  title,
  kicker,
  headline,
  children,
}: {
  title: string;
  kicker?: string;
  headline?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md bg-[#191919] p-3 ring-1 ring-neutral-800/80">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {kicker && (
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-600">{kicker}</span>
          )}
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-200">{title}</h3>
        </div>
        {headline && <div className="text-[11px] text-neutral-500">{headline}</div>}
      </div>
      {children}
    </section>
  );
}
