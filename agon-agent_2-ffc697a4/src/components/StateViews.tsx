import type { LolmixState } from '../lolmix/types';
import { PlugZap, Loader2, ServerCrash, AlertCircle, Settings, Inbox } from 'lucide-react';

const HOST = 'http://127.0.0.1:8765';

function StateShell({
  icon,
  title,
  children,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  tone?: 'neutral' | 'warn' | 'error';
}) {
  const ring =
    tone === 'error' ? 'ring-red-500/30' : tone === 'warn' ? 'ring-amber-500/30' : 'ring-neutral-800';
  return (
    <div className={`flex items-start gap-3 rounded-md bg-neutral-900/40 px-3.5 py-3 ring-1 ${ring}`}>
      <div className="mt-0.5 shrink-0 text-neutral-400">{icon}</div>
      <div className="min-w-0">
        <h4 className="text-[13px] font-semibold text-neutral-100">{title}</h4>
        <div className="mt-1 text-[12px] leading-relaxed text-neutral-400">{children}</div>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12px] text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Fetching recommendations…
      </div>
      {/* skeleton preserving layout */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-md bg-neutral-900/50 p-3">
            <div className="mb-2 h-3 w-24 rounded bg-neutral-800" />
            <div className="mb-1.5 h-8 rounded bg-neutral-800/70" />
            <div className="h-8 rounded bg-neutral-800/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NonSuccessState({ state, champ }: { state: LolmixState; champ?: string }) {
  switch (state) {
    case 'not-configured':
      return (
        <StateShell icon={<Settings className="h-4 w-4" />} title="lolmix is not configured">
          Optional. DraftGap’s native build analysis still works below. To enable lolmix
          recommendations, set the server host in settings (default <code className="text-neutral-300">{HOST}</code>).
        </StateShell>
      );
    case 'unavailable':
      return (
        <StateShell icon={<ServerCrash className="h-4 w-4" />} title="lolmix server unreachable" tone="warn">
          Could not reach <code className="text-neutral-300">{HOST}</code>. Start the local server, then refresh:
          <pre className="mt-1.5 overflow-x-auto rounded bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300">lolmix serve --port 8765</pre>
        </StateShell>
      );
    case 'invalid-draft':
      return (
        <StateShell icon={<AlertCircle className="h-4 w-4" />} title="Not enough draft info" tone="warn">
          Select a locked champion{champ ? '' : ' and role'} with at least one locked enemy to get build
          recommendations. lolmix only uses locked picks, not hovers.
        </StateShell>
      );
    case 'validation-error':
      return (
        <StateShell icon={<AlertCircle className="h-4 w-4" />} title="Request rejected" tone="error">
          The lolmix server rejected the analysis request.
          <div className="mt-1 rounded bg-neutral-950 px-2 py-1 font-mono text-[11px] text-red-300">
            field <span className="text-neutral-400">lane</span>: unsupported value
          </div>
        </StateShell>
      );
    case 'unexpected-error':
      return (
        <StateShell icon={<ServerCrash className="h-4 w-4" />} title="Unexpected response" tone="error">
          lolmix returned an unexpected shape. DraftGap’s native build analysis below is unaffected.
        </StateShell>
      );
    case 'idle':
      return (
        <StateShell icon={<PlugZap className="h-4 w-4" />} title="Ready">
          Connected. Recommendations will load for the selected champion.
        </StateShell>
      );
    default:
      return (
        <StateShell icon={<Inbox className="h-4 w-4" />} title="No recommendations">
          Nothing to show yet.
        </StateShell>
      );
  }
}
