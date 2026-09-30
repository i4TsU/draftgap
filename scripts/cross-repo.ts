import { resolve } from "node:path";
import { createServer } from "node:net";
import manifest from "../package.json";
import {
  draftgapRepo,
  lolmixRepo,
  requireRepositories,
  run,
} from "./lib/cross-repo";
import { ownedSpawnOptions, stopOwned } from "./lib/owned-process";
import { waitReady } from "./lib/wait-ready";

requireRepositories();
const requiredBun = manifest.packageManager.replace("bun@", "");
if (Bun.version !== requiredBun) {
  throw new Error(
    `Use Bun ${requiredBun} from packageManager; found ${Bun.version}.`,
  );
}
const bun = process.execPath;
const frontend = resolve(draftgapRepo, "apps/frontend");
const action = process.argv[2];

if (action === "setup") {
  run(["uv", "sync", "--locked", "--all-extras"], lolmixRepo);
  run([bun, "install", "--frozen-lockfile"], draftgapRepo);
} else if (action === "check") {
  for (const repo of [lolmixRepo, draftgapRepo]) {
    run(
      [
        "git",
        "-c",
        `safe.directory=${repo.replaceAll("\\", "/")}`,
        "rev-parse",
        "HEAD",
      ],
      repo,
    );
  }
  const checks: [string[], string][] = [
    [["uv", "run", "--locked", "pytest"], lolmixRepo],
    [["uv", "run", "--locked", "ruff", "check", "."], lolmixRepo],
    [["uv", "run", "--locked", "ruff", "format", "--check", "."], lolmixRepo],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "check",
        resolve(import.meta.dir, "integration"),
      ],
      lolmixRepo,
    ],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "format",
        "--check",
        resolve(import.meta.dir, "integration"),
      ],
      lolmixRepo,
    ],
    [[bun, "run", "--bun", "typecheck"], draftgapRepo],
    [
      [
        bun,
        "run",
        "--bun",
        "typecheck",
        "--project",
        "../../scripts/tsconfig.json",
      ],
      frontend,
    ],
    [[bun, "run", "--bun", "test"], frontend],
    [[bun, "run", "--bun", "lint"], frontend],
    [[bun, "run", "--bun", "build"], frontend],
    [[bun, "run", "--bun", "test:integration"], draftgapRepo],
    [[bun, "run", "--bun", "test:orchestration"], draftgapRepo],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "check",
        resolve(import.meta.dir, "lib/lolmix-service.py"),
      ],
      lolmixRepo,
    ],
    [
      [
        "uv",
        "run",
        "--locked",
        "ruff",
        "format",
        "--check",
        resolve(import.meta.dir, "lib/lolmix-service.py"),
      ],
      lolmixRepo,
    ],
  ];
  const failures: unknown[] = [];
  for (const [command, cwd] of checks) {
    try {
      run(command, cwd);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      `${failures.length} validation command(s) failed; see output above.`,
    );
} else if (action === "dev") {
  const develop = async () => {
    for (const port of [8765, 3000]) {
      await new Promise<void>((resolve, reject) => {
        const probe = createServer();
        probe.once("error", () =>
          reject(
            new Error(
              `127.0.0.1:${port} is in use; stop your own service or use a separate task.`,
            ),
          ),
        );
        probe.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
          probe.close(() => resolve()),
        );
      });
    }
    const children: ReturnType<typeof Bun.spawn>[] = [];
    let server: Bun.Subprocess<"pipe", "inherit", "inherit"> | undefined;
    let stopping = false;
    const interrupted = new AbortController();
    let cleanup: Promise<void> | undefined;
    const stop = () => {
      if (cleanup) return cleanup;
      stopping = true;
      interrupted.abort(new Error("Development startup interrupted."));
      cleanup = Promise.all(
        children.map((child) =>
          stopOwned(
            child,
            child === server ? () => server!.stdin.end() : undefined,
          ),
        ),
      ).then(() => {});
      // Signal/input handlers cannot await; finally reports cleanup errors.
      void cleanup.catch(() => {});
      return cleanup;
    };
    const stopOnInput = (text: Buffer) => {
      if (text.toString().trim() === "stop") stop();
    };
    process.stdin.on("data", stopOnInput);
    process.stdin.on("end", stop);
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    try {
      server = Bun.spawn(
        [
          "uv",
          "run",
          "--locked",
          "--no-sync",
          "python",
          resolve(import.meta.dir, "lib/lolmix-service.py"),
        ],
        {
          ...ownedSpawnOptions,
          cwd: lolmixRepo,
          stdin: "pipe",
          stdout: "inherit",
          stderr: "inherit",
        },
      );
      children.push(server);
      const serverReady = async () => {
        for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
          if (server!.exitCode !== null)
            throw new Error("LoLMix server exited before becoming ready.");
          try {
            const response = await fetch("http://127.0.0.1:8765/health", {
              signal: AbortSignal.timeout(500),
            });
            const health = await response.json();
            const ready =
              response.ok &&
              typeof health === "object" &&
              health !== null &&
              "app" in health &&
              health.app === "lolmix" &&
              "schema_version" in health &&
              health.schema_version === 1;
            if (ready) return;
          } catch {
            /* The owned server is still starting. */
          }
          await Bun.sleep(100);
        }
        throw new Error("LoLMix did not become ready on 127.0.0.1:8765.");
      };
      try {
        await waitReady(
          serverReady(),
          interrupted.signal,
          60_000,
          "LoLMix startup timed out.",
        );
      } catch (error) {
        if (stopping) return;
        throw error;
      }
      const web = Bun.spawn(
        [
          bun,
          resolve(frontend, "node_modules/vite/bin/vite.js"),
          "--host",
          "127.0.0.1",
          "--port",
          "3000",
          "--strictPort",
        ],
        {
          ...ownedSpawnOptions,
          cwd: frontend,
          stdout: "inherit",
          stderr: "inherit",
          env: { ...process.env, npm_package_version: manifest.version },
        },
      );
      children.push(web);
      const webReady = async () => {
        for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
          if (web.exitCode !== null)
            throw new Error("Vite exited before becoming ready.");
          try {
            const ready = (
              await fetch("http://127.0.0.1:3000", {
                signal: AbortSignal.timeout(500),
              })
            ).ok;
            if (ready) return;
          } catch {
            /* Vite is still starting. */
          }
          await Bun.sleep(100);
        }
        throw new Error("Vite did not become ready on 127.0.0.1:3000.");
      };
      try {
        await waitReady(
          webReady(),
          interrupted.signal,
          60_000,
          "Vite startup timed out.",
        );
      } catch (error) {
        if (stopping) return;
        throw error;
      }
      console.log(
        "LoLMix is ready at http://127.0.0.1:8765; Vite is ready at http://127.0.0.1:3000.",
      );
      const code = await Promise.race(children.map((child) => child.exited));
      if (!stopping && code !== 0)
        throw new Error(`Development service exited (${code}).`);
    } finally {
      try {
        await stop();
      } finally {
        process.stdin.off("data", stopOnInput);
        process.stdin.off("end", stop);
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
        process.stdin.pause();
      }
    }
  };
  await develop();
} else {
  throw new Error("Usage: bun scripts/cross-repo.ts setup|check|dev");
}
