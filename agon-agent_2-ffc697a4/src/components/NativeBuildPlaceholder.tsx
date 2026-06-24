// Represents DraftGap's existing native build tables. The lolmix panel is
// ADDITIVE — this stays present and useful regardless of lolmix state.
export function NativeBuildPlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      {(['Pre-game', 'In-game'] as const).map((label) => (
        <section key={label} className="rounded-md bg-[#191919] p-3 ring-1 ring-neutral-800/80">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-300">
              DraftGap — {label} analysis
            </h3>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-neutral-600">native</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded bg-neutral-900/50 p-2">
                <div className="h-8 w-8 rounded bg-neutral-800" />
                <div className="h-2 w-8 rounded bg-neutral-800/70" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-600">
            Existing DraftGap build tables (unchanged). lolmix complements these, it does not replace them.
          </p>
        </section>
      ))}
    </div>
  );
}
