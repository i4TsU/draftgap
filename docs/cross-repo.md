# DraftGap + LoLMix development

Keep these Git repositories separate. DraftGap owns the SolidJS/Tauri app,
dataset pipeline and TypeScript analysis. LoLMix owns its Python engine,
CLI/GUI and local HTTP API. DraftGap sends JSON to LoLMix; it does not import
Python code or bundle the server. A submodule is not needed for cross-repo work.

## Checkouts and commands

Use sibling directories:

```text
<workspace>/
  draftgap/  # https://github.com/i4TsU/draftgap
  lolmix/    # https://github.com/i4TsU/lolmix
```

If LoLMix is elsewhere, set `LOLMIX_REPO` to its checkout before running commands.
The scripts find DraftGap relative to themselves, so they work from any shell
directory. Do not copy `.venv`, `node_modules`, credentials, browser cookies,
raw fixtures or local `.codex` settings between machines.

Use Bun **1.3.6** (the workspace package-manager version), Python **3.12**
(LoLMix's `.python-version`) and `uv`. From DraftGap:

```sh
bun run setup:all
bun run check:all
bun run dev:all
```

Setup installs all LoLMix extras (including GUI dependencies for its pandas/
matplotlib test) and DraftGap's frozen Bun
lockfile. Checks print both source SHAs, run Python tests/lint/format checks,
workspace TS typechecking, frontend Bun tests/lint/build, and the HTTP contract
test. The frontend build does not run typechecking itself.

`dev:all` starts LoLMix on `127.0.0.1:8765`, checks its health/schema, and starts
Vite on `127.0.0.1:3000` with a strict port. Stop the supervising command when
finished with Ctrl+C or by typing `stop` followed by Enter. It stops its own
child processes, and never kills existing services. The Python service has an
owned stdin shutdown channel; Vite is launched directly to avoid orphaning a
package-runner child on Windows. Use a terminal session with stdin kept open
(for example, `tty=true` in Codex's terminal tool).
Use a separate worktree per concurrent task; pytest's `.pytest-tmp` is scoped
to each LoLMix checkout. Avoid concurrent dependency installs in one checkout.

To run the contract check alone:

```sh
bun run test:integration
```

It launches LoLMix's real HTTP handlers, validation, section filtering and JSON
exporter on an OS-assigned loopback port, and calls them through DraftGap's real
request builder, HTTP client, parser and display helpers. Only the catalog and
analysis inputs are synthetic; no Lolalytics/Riot requests or personal data are
needed. It checks contextual rates, null matchup entries, warnings, observed
and optimal rune pages, field validation, schema incompatibility and CORS.

For desktop development, `bun run tauri dev` works from the root. Native builds
also need Rust and platform prerequisites; keep them separate from web checks.

## Codex Cloud environment

Create a **new combined environment**, preserving the existing migrated
LoLMix environment. Select **both** `i4TsU/lolmix` and `i4TsU/draftgap` in the
repository selector. Inspect the resulting mount paths; if they are not siblings,
set `LOLMIX_REPO` to the actual LoLMix path. Do not assume an existing environment
has a control for adding another repository.

Ask setup to install Bun 1.3.6, `uv`, and Python 3.12, then use the following
Install script after substituting the two **observed** checkout paths:

```sh
set -eu
export LOLMIX_REPO="<absolute-lolmix-checkout>"
cd "<absolute-draftgap-checkout>"
bun run setup:all
bun run check:all
```

Use this Start skill:

> Locate the DraftGap and LoLMix checkouts and set LOLMIX_REPO if they are not
> siblings. Read both AGENTS.md files and draftgap/docs/cross-repo.md. Check Bun
> 1.3.6, Python 3.12 and uv are available, and print both Git SHAs/statuses.
> Run `bun run check:all` from DraftGap after relevant changes; run
> `bun run setup:all` first if dependencies changed. For interactive web/service
> development, use `bun run dev:all` in a managed terminal with stdin kept open
> (tty=true for Codex terminal tools), only when the existing network policy
> permits DDragon metadata requests. Confirm
> `/health` reports app=lolmix and schema_version=1, and Vite is ready on
> 127.0.0.1:3000. Stop only the services started by this task. Keep changes in
> each repository and report both diffs/tests; commit/push independently only
> when authorized. If live-service startup is blocked by network access, use the
> deterministic integration check; do not change the network policy. Do not run
> dataset publishing or update publishing scripts.

Keep the environment private and retain existing network/auth settings. The
deterministic check requires package-install access, but no production secrets,
S3 publishing credentials, Riot keys, browser clearance files or new recipients.
Live external data checks are optional and may need separately approved access.
Real service startup loads DDragon metadata from `ddragon.leagueoflegends.com`
unless it is cached. Frontend data comes from `bucket.draftgap.com`; live build
requests involve Lolalytics. These destinations are not needed by the contract
test. Do not silently add them to the environment's allowed domains.

Review setup results, publish the prepared environment, and launch a **fresh**
task to verify both repos are present and writable and `check:all` passes. Existing
tasks retain their own state; environment setup is not a backup of local dirty
files. Commit/review intended local source before expecting it in cloud checkouts.
Official guidance: https://learn.chatgpt.com/docs/environments/cloud-environments

## Validation limits and coordinated changes

Linux cloud can validate Python math/parser tests, TypeScript behavior, builds,
and the HTTP boundary. It cannot establish Windows desktop/WebView2 acceptance,
DPAPI browser-cookie access, or interaction with a local League client. Run those
on Windows when relevant. The current CORS policy allows localhost/Tauri origins,
not arbitrary remote previews; do not broaden it just to make a preview work.
Live Lolalytics fetches can still be affected by network policy or Cloudflare.

Record the tested commit pair in coordinated PR descriptions. Source history
remains independent: changes to both projects need two commits/PRs. The current
contract is schema version 1; schema changes require compatibility decisions and
the contract check in both directions before rollout. A package version shown in
health does not prove which source commit a running server uses.
