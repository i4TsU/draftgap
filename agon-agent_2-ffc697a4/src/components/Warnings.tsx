import { useState } from 'react';
import type { Warning } from '../lolmix/types';
import { AlertTriangle, X } from 'lucide-react';

// Compact, dismissible warning band. Never hides recommendations.
export function Warnings({ warnings }: { warnings: Warning[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!warnings.length || dismissed) return null;
  const first = warnings[0];
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
            {warnings.length > 1 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[10px] text-amber-400/80 underline-offset-2 hover:underline"
              >
                {expanded ? 'collapse' : 'show all'}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-100/80">
            {first.enemy_name ? <span className="font-medium">{first.enemy_name}: </span> : null}
            {first.message}
          </p>
          {expanded && warnings.length > 1 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {warnings.slice(1).map((w, i) => (
                <li key={i} className="text-[11px] leading-snug text-amber-100/70">
                  {w.enemy_name ? <span className="font-medium">{w.enemy_name}: </span> : null}
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="shrink-0 text-amber-400/70 hover:text-amber-300" aria-label="Dismiss warnings">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
