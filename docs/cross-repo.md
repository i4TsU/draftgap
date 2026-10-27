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
bun run --bun setup:all
bun run --bun check:all
bun run --bun dev:all
```

Setup installs all LoLMix extras (including GUI dependencies for its pandas/
matplotlib test) and DraftGap's frozen Bun
lockfile. Checks print both source SHAs, run Python tests/lint/format checks,
workspace TS typechecking, frontend Bun tests/lint/build, and the HTTP contract
test. The frontend build does not run typechecking itself.
The `--bun` flag keeps nested package scripts on the selected Bun executable,
including when a different Bun installation is also on PATH.

`dev:all` starts LoLMix on `127.0.0.1:8765`, checks its health/schema, and starts
Vite on `127.0.0.1:3000` with a strict port. Stop the supervising command when
finished with Ctrl+C or by typing `stop` followed by Enter. It stops its own
child processes, and never kills existing services. The Python service has an
owned stdin shutdown channel; Vite is launched directly to avoid orphaning a
package-runner child on Windows. Shutdown has a short grace period, followed
by bounded termination of only the owned Windows process tree or Unix process
group. Typing `stop`, Ctrl+C, or closing stdin initiates the same cleanup.
Use a terminal session with stdin kept open
(for example, `tty=true` in Codex's terminal tool).
Use a separate worktree per concurrent task; pytest's `.pytest-tmp` is scoped
to each LoLMix checkout. Avoid concurrent dependency installs in one checkout.

To run the contract check alone:

```sh
bun run --bun test:integration
```

It launches LoLMix's real HTTP handlers, validation, section filtering and JSON
exporter on an OS-assigned loopback port, and calls them through DraftGap's real
request builder, HTTP client, parser and display helpers. Only the catalog and
analysis inputs are synthetic; no Lolalytics/Riot requests or personal data are
needed. It checks contextual rates, null matchup entries, warnings, observed
and optimal rune pages, field validation, schema incompatibility and CORS.

`bun run --bun test:orchestration` additionally checks repeated cleanup,
startup timeout/interruption, child-process/listener cleanup, existing-service
ownership and Bun runtime selection. `check:all` runs these regression tests.
On Linux, the cleanup assertions distinguish exited zombies from running
processes and still verify that owned listeners close. Minimal containers whose
PID 1 does not reap orphaned children can retain zombie process-table entries
after forced shutdown; these are not running services.

For desktop development, `bun run --bun tauri dev` works from the root. Native builds
also need Rust and platform prerequisites; keep them separate from web checks.

## Windows desktop LoLMix lifecycle

Opening DraftGap automatically starts LoLMix for `127.0.0.1` or `localhost`
using the port in Settings (default `8765`). The connection waits for startup
and verifies the HTTP health/schema. Retry reports startup errors and can retry
after they are fixed. Remote hosts and other platforms still use an external server.

Run `setup:all` once to prepare the sibling LoLMix checkout and its `.venv`.
The EXE runs that environment's Python directly, without a terminal, `uv`,
dependency installation, or a package-runner process. LoLMix remains a separate
checkout; Python and its dependencies are not bundled into the EXE. Discovery
uses `LOLMIX_REPO` if set (an absolute path), a `lolmix` sibling beside/above the
EXE, then the build-time sibling checkout for a copied local EXE.

Only one DraftGap instance runs; opening the EXE again focuses the existing
window. Native startup requests are serialized. An already-running compatible
server is reused and remains externally owned: DraftGap never stops it. An
occupied port with an incompatible service produces an error instead of spawning.

Each owned server tree is placed in a Windows Job Object **during process
creation**, including the Windows Python venv launcher and any descendants.
On close/restart, EOF asks LoLMix to shut down; after a bounded grace period,
the job is terminated and its processes are awaited. Windows also kills the
job on a DraftGap crash/forced termination. Changing the host or port stops the
previous owned server before starting another. Logs go to `lolmix-server.log`
in Tauri's app log directory; startup errors show the full path.

Native regression tests: `cargo test --manifest-path apps/frontend/src-tauri/Cargo.toml`.
These require the prepared LoLMix `.venv` on Windows, use synthetic catalog
data, and exercise real process/HTTP cleanup without live League or Lolalytics.
Also run `check:all`, rebuild the EXE and verify open, duplicate open, close,
reopen and forced termination on Windows. Native checks are separate from the
portable cloud checks.

## Codex Cloud environment

### Reproducible bootstrap for the combined saved environment

The two `main` branches do not yet contain coordinated setup. For the reviewed
3.2.2 integration, select DraftGap branch
`codex/integrate-draftgap-v3.2.2-20261014` **after it has been pushed**, and LoLMix
branch `codex/cloud-cross-repo-setup-20260930` at
`c2b870b0053362e7dc649411b869727f96b96800`. The latter already exists remotely.
Do not substitute a local-only companion branch in saved selectors.

With mounts `/workspace/draftgap` and `/workspace/lolmix`, set the saved Install
script to:

```sh
bash /workspace/draftgap/scripts/cloud-install.sh
```

This tracked bootstrap requires Git, npm, uv and Python 3.12 availability. It
installs pinned Bun into the sibling `.cloud-tools` directory, creates writable
caches and a non-secret `.cloud-setup/env.sh`, installs both locked dependency
sets, and runs the complete checks under the tracked Linux child subreaper.
It preserves selected revisions and dirty files; it never fetches, switches
branches, changes authentication/network policy or publishes. A LoLMix revision
without locked setup fails explicitly. No old untracked `install.sh` or
`run-reaped.py` is required.

Replace the saved Start instructions that force September branches with:

> Keep the selected repository revisions. Read both AGENTS.md files and
> draftgap/docs/cross-repo.md. Source /workspace/.cloud-setup/env.sh in every
> Bash shell. If it or dependencies are missing, run
> bash /workspace/draftgap/scripts/cloud-install.sh. Print both source SHAs and
> statuses. Run bun run --bun setup:all when dependencies change. From DraftGap,
> run uv run --project "$LOLMIX_REPO" --locked --no-sync python
> scripts/lib/run-reaped.py bun run --bun check:all after relevant changes.
> Never automatically switch back to a setup branch. Preserve network/auth
> settings. Do not run publishing scripts. Windows runtime checks remain separate.

Save/publish these product settings, then launch a fresh task and verify the
selected source pair and bootstrap exit status. Updating files in one running
task does not update the saved environment. Until the integration branch is
delivered and these settings are applied, fresh-launch reproducibility is not
verified. Selecting `main` would omit the coordinated scripts and Python lockfile;
the former untracked installer instead forced older setup revisions and would
omit the latest user/upstream integration.

### General environment guidance

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
bun run --bun setup:all
bun run --bun check:all
```

Use this Start skill:

> Locate the DraftGap and LoLMix checkouts and set LOLMIX_REPO if they are not
> siblings. Read both AGENTS.md files and draftgap/docs/cross-repo.md. Check Bun
> 1.3.6, Python 3.12 and uv are available, and print both Git SHAs/statuses.
> Run `bun run --bun check:all` from DraftGap after relevant changes; run
> `bun run --bun setup:all` first if dependencies changed. For interactive web/service
> development, use `bun run --bun dev:all` in a managed terminal with stdin kept open
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
